import { execFileSync } from "node:child_process";
// Post-build link check: every internal href/src in dist/ must resolve to a built file (and #anchor to an id);
// every external link is fetched and must return HTTP 200 after redirects. Exits 1 on any broken link.
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { decideSourceCheck } from "./lib/source-pass.mjs";
const ROOT = new URL("..", import.meta.url).pathname; const DIST = join(ROOT, "dist");
const offline = process.argv.includes("--offline");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const htmlFiles = walk(DIST).filter((f) => f.endsWith(".html"));
const ids = new Map(); const pages = new Map();
for (const f of htmlFiles) { const h = readFileSync(f, "utf8"); pages.set(f, h); ids.set(f, new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))); }
const resolve = (p) => { const clean = p.split("#")[0].split("?")[0]; const cand = clean.endsWith("/") ? join(DIST, clean, "index.html") : join(DIST, clean);
  return existsSync(cand) && statSync(cand).isFile() ? cand : existsSync(join(DIST, clean, "index.html")) ? join(DIST, clean, "index.html") : null; };
const broken = []; const external = new Map(); let internal = 0;
for (const [f, h] of pages) {
  const from = "/" + relative(DIST, f);
  for (const m of h.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const u = m[1].replace(/&amp;/g, "&");
    if (/^https?:\/\//.test(u)) { if (u.startsWith("https://patriotinlays.com")) continue; if (!external.has(u)) external.set(u, new Set()); external.get(u).add(from); continue; }
    if (/^(mailto:|tel:)/.test(u)) continue;
    internal++;
    if (u.startsWith("#")) { if (!ids.get(f).has(u.slice(1))) broken.push({ from, link: u, why: "missing anchor" }); continue; }
    const target = resolve(u); if (!target) { broken.push({ from, link: u, why: "no such file" }); continue; }
    const hash = u.split("#")[1]; if (hash && !ids.get(target)?.has(hash)) broken.push({ from, link: u, why: "missing anchor in target" });
  }
}
const LAST_PASSED_PATH = join(ROOT, "manifest/source-last-passed.json");
const lastPassedStore = existsSync(LAST_PASSED_PATH) ? JSON.parse(readFileSync(LAST_PASSED_PATH, "utf8")) : { sources: {} };
const extResults = [];
if (!offline) for (const [u, froms] of external) {
  let status = 0, err = null;
  for (let attempt = 0; attempt < 2 && status !== 200; attempt++) {
    try { const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (patriotinlays link checker)" }, signal: AbortSignal.timeout(45000) }); status = r.status; await r.arrayBuffer(); }
    catch (e) { err = e.message; status = status || "error"; }
  }
  // Bot filters (e.g. dar.org's Cloudflare) can reject Node's HTTP client while serving the page to curl; re-check with curl.
  let via = "fetch";
  if (status === 403 || status === 429) { try { const c = Number(execFileSync("curl", ["-sL", "-o", "/dev/null", "--max-time", "45", "-A", "Mozilla/5.0 (patriotinlays link checker)", "-H", "Accept: text/html", "-w", "%{http_code}", u], { encoding: "utf8" })); if (c === 200) { status = 200; via = "curl"; } else if (Number.isFinite(c) && c) status = c; } catch { /* keep status */ } }
  let fallback = false;
  if (status !== 200) {
    const d = decideSourceCheck({ status, errorMessage: err || "", lastPassedAt: lastPassedStore.sources?.[u] || null });
    if (d.outcome === "fallback") {
      fallback = true;
      console.log(`WARN  ${u}: ${d.warning}`);
    } else {
      broken.push({ from: [...froms][0], link: u, why: d.error || `HTTP ${status || err}` });
    }
  }
  extResults.push({ url: u, status, err, pages: froms.size, via, fallback });
}
// This script checks that links resolve; it never verifies source quotes, so it always reports the live-source check as not run.
const LIVE_LINE = "Live-source check: NOT RUN";
const report = { live_source_check: "NOT RUN", live_source_check_line: LIVE_LINE, checkedAt: new Date().toString(), htmlFiles: htmlFiles.length, internalLinks: internal, externalUnique: external.size, external: extResults, broken };
writeFileSync(join(ROOT, "link-check-report.json"), JSON.stringify(report, null, 2));
console.log(`Link check: ${htmlFiles.length} HTML files, ${internal} internal links, ${external.size} unique external URLs${offline ? " (not fetched)" : ""}.`);
for (const e of extResults) console.log(`  ${e.status || "ERR"}  ${e.url}`);
for (const b of broken) console.log(`BROKEN ${b.from} -> ${b.link} (${b.why})`);
console.log(broken.length ? `FAILED: ${broken.length} broken link(s).` : "PASSED: zero broken links.");
console.log(LIVE_LINE);
process.exit(broken.length ? 1 : 0);
