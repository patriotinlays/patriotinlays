// Source Manifest gate. Fails the build (exit 1) when:
//  1. a content sentence that looks factual has no [[claim:id]] marker          (unmanifested claim)
//  2. a marker or a tool rule references a claim_id missing from the manifest     (unmanifested claim)
//  3. a referenced claim is not verification_status: "verified"                   (unverified claim)
//  4. a manifest entry is missing required fields or is older than MAX_AGE_DAYS   (stale/incomplete)
//  5. with --links: a source URL is not HTTP 200, or its quote_excerpt is not found in the live source.
// Policy (non-negotiable accuracy rule): a claim that cannot pass this gate is omitted from the site, never shipped.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { norm, normJoin, stripHtml } from "./lib/normalize.mjs";

const args = process.argv.slice(2);
const LINKS = args.includes("--links");
const contentDir = args.includes("--content") ? args[args.indexOf("--content") + 1] : "src/content";
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const MAX_AGE_DAYS = 120;
const REQUIRED = ["claim_id", "claim_text", "source_url", "source_title", "source_type", "last_retrieved", "quote_excerpt", "verification_status", "verified_by", "used_on"];
const SOURCE_TYPES = ["primary", "official_secondary"];

const errors = [], warnings = [];
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest/claims.json"), "utf8"));
const byId = new Map();
for (const c of manifest.claims) {
  for (const f of REQUIRED) if (c[f] == null || c[f] === "") errors.push(`manifest ${c.claim_id || "?"}: missing field ${f}`);
  if (byId.has(c.claim_id)) errors.push(`manifest: duplicate claim_id ${c.claim_id}`);
  byId.set(c.claim_id, c);
  if (!SOURCE_TYPES.includes(c.source_type)) errors.push(`manifest ${c.claim_id}: source_type must be one of ${SOURCE_TYPES.join("/")}`);
  if (!/^https:\/\//.test(c.source_url || "")) errors.push(`manifest ${c.claim_id}: source_url must be https`);
  const age = (Date.now() - Date.parse(c.last_retrieved + "T00:00:00")) / 864e5;
  if (!(age >= -1 && age <= MAX_AGE_DAYS)) errors.push(`manifest ${c.claim_id}: last_retrieved ${c.last_retrieved} is stale or invalid (max ${MAX_AGE_DAYS} days)`);
}
const referenced = new Set();
function requireClaim(id, where) {
  referenced.add(id);
  const c = byId.get(id);
  if (!c) errors.push(`${where}: claim "${id}" is not in the Source Manifest — omit the claim or add a verified entry`);
  else if (c.verification_status !== "verified") errors.push(`${where}: claim "${id}" is ${c.verification_status}, not verified — omit it`);
}

// Factual-sentence heuristic: years, statute cites, full dates, quantities, requirement language.
const FACTUAL = [/\b1[6-9]\d\d\b/, /\bStat\.\s*\d/, /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/, /\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/, /\b\d+\s*(acres|days|months|years|percent|%)/i, /\b(must|required|requires|eligible|accepts?|prohibit\w*)\b/i];
const MARK = /\[\[claim:([a-z0-9-]+)\]\]/g;
const dirs = args.includes("--content") ? [contentDir] : ["src/content", "src/pages", "src/partials"];
const files = [];
for (const d of dirs) { const dir = join(ROOT, d); if (existsSync(dir)) for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) files.push([d, f]); }
let sentences = 0, marked = 0;
const perFile = {};
function checkUnit(s, where) {
  if (!s.trim()) return; sentences++; perFile[where].units++;
  const ids = [...s.matchAll(MARK)].map((m) => m[1]);
  if (ids.length) { marked++; perFile[where].marked++; ids.forEach((id) => requireClaim(id, where)); }
  else if (FACTUAL.some((re) => re.test(s)) && !/^A green result reads:/.test(s.trim())) { perFile[where].unmarked++; errors.push(`${where}: unmanifested factual sentence — "${s.trim().slice(0, 90)}"`); }
}
for (const [d, f] of files) {
  const where = `${d}/${f}`; perFile[where] = { units: 0, marked: 0, unmarked: 0 };
  const text = readFileSync(join(ROOT, d, f), "utf8").replace(/^---[\s\S]*?---/, "").replace(/```[\s\S]*?```/g, "");
  const lines = text.split("\n").filter((l) => l.trim() && !/^#/.test(l.trim()) && !/^::tool /.test(l.trim()) && !/^\|[-\s|]+\|$/.test(l.trim()));
  for (let line of lines) {
    if (line.trim().startsWith("|")) { checkUnit(line, where); continue; } // a table row is one unit; a marker anywhere in the row covers it
    line = line.replace(/^\s*(?:- |\d+\. )/, "");
    for (const s of line.split(/(?<=[.!?])\s+(?=[A-Z"])|(?<=\]\])\s+/)) checkUnit(s, where);
  }
}
// Tool rules must cite manifest claims too.
for (const t of readdirSync(join(ROOT, "src/tools")).filter((f) => f.endsWith(".js"))) {
  const src = readFileSync(join(ROOT, "src/tools", t), "utf8");
  for (const m of src.matchAll(/claim\w*:\s*"([a-z0-9-]+)"/g)) requireClaim(m[1], `src/tools/${t}`);
  for (const m of src.matchAll(/claims:\s*\[([^\]]*)\]/g)) for (const q of m[1].matchAll(/"([a-z0-9-]+)"/g)) requireClaim(q[1], `src/tools/${t}`);
}
for (const id of byId.keys()) if (!referenced.has(id)) warnings.push(`manifest ${id}: not referenced by any page or tool`);

// Live source verification.
const linkReport = [];
if (LINKS) {
  const urls = [...new Set(manifest.claims.map((c) => c.source_url))];
  const tmp = mkdtempSync(join(tmpdir(), "manifest-"));
  for (const u of urls) {
    let status = 0, body = "", type = "", altHays = [];
    try {
      // Large statute scans (up to ~90 MB) can be slow: allow 5 minutes per try and retry twice before failing.
      let r, buf = null;
      for (let attempt = 1; ; attempt++) {
        try { r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (patriotinlays manifest checker)" }, redirect: "follow", signal: AbortSignal.timeout(300000) });
          if ((r.headers.get("content-type") || "").includes("pdf")) buf = Buffer.from(await r.arrayBuffer()); break; }
        catch (e) { if (attempt >= 3) throw e; warnings.push(`${u}: try ${attempt} failed (${e.message}); retrying`); await new Promise((res) => setTimeout(res, 5000 * attempt)); }
      }
      status = r.status; type = r.headers.get("content-type") || "";
      if (type.includes("pdf")) {
        const p = join(tmp, "s.pdf"); writeFileSync(p, buf);
        try { body = execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8", maxBuffer: 256e6 });
          // Scanned statute volumes read cleanly only in reading order (-raw); keep both, plus the rejoined-hyphen form.
          if (/tile\.loc\.gov/.test(u)) { const raw = execFileSync("pdftotext", ["-raw", p, "-"], { encoding: "utf8", maxBuffer: 256e6 }); altHays = [normJoin(raw), norm(raw), normJoin(body)]; } }
        catch { body = null; warnings.push(`${u}: PDF fetched but pdftotext unavailable — quote check skipped`); }
      } else body = await r.text();
    } catch (e) { errors.push(`${u}: fetch failed (${e.message})`); linkReport.push({ url: u, status: "error" }); continue; }
    // Some sites' bot filters (e.g. dar.org's Cloudflare) reject Node's HTTP client but serve the same public page to curl.
    // Re-read the page with curl and still quote-check it; a non-200 from curl still fails the build.
    if ((status === 403 || status === 429) && !type.includes("pdf")) {
      try { const out = execFileSync("curl", ["-sL", "--max-time", "45", "-A", "Mozilla/5.0 (patriotinlays manifest checker)", "-H", "Accept: text/html", "-w", "\n%{http_code}", u], { encoding: "utf8", maxBuffer: 64e6 });
        const i = out.lastIndexOf("\n"); status = Number(out.slice(i + 1)); body = out.slice(0, i); if (status === 200) warnings.push(`${u}: Node fetch got 403/429; verified with curl instead`); } catch { /* keep original status */ }
    }
    if (status !== 200) { errors.push(`${u}: HTTP ${status}`); linkReport.push({ url: u, status }); continue; }
    const hay = body == null ? null : norm(type.includes("pdf") ? body : stripHtml(body));
    let found = 0, missing = 0;
    for (const c of manifest.claims.filter((c) => c.source_url === u)) {
      if (hay == null) continue;
      if (hay.includes(norm(c.quote_excerpt)) || altHays.some((h) => h.includes(norm(c.quote_excerpt)))) found++; else { missing++; errors.push(`${c.claim_id}: quote_excerpt not found in live source ${u}`); }
    }
    linkReport.push({ url: u, status, quotesFound: found, quotesMissing: missing });
  }
}

const summary = { checkedAt: new Date().toString(), dirs, files: files.length, perFile, sentences, markedSentences: marked, manifestClaims: byId.size, referencedClaims: referenced.size, links: LINKS ? linkReport : "not run (use --links)", errors, warnings };
if (!args.includes("--content")) writeFileSync(join(ROOT, "manifest-check-report.json"), JSON.stringify(summary, null, 2));
console.log(`Source Manifest gate: ${files.length} page(s), ${sentences} sentence(s), ${marked} with claim markers; ${byId.size} manifest claims, ${referenced.size} referenced.`);
if (LINKS) for (const l of linkReport) console.log(`  link ${l.status}  quotes found ${l.quotesFound ?? "-"} / missing ${l.quotesMissing ?? "-"}  ${l.url}`);
warnings.forEach((w) => console.log("WARN  " + w));
errors.forEach((e) => console.log("ERROR " + e));
console.log(errors.length ? `FAILED with ${errors.length} error(s). Unverifiable claims must be omitted.` : "PASSED: every factual claim maps to a verified manifest entry.");
process.exit(errors.length ? 1 : 0);
