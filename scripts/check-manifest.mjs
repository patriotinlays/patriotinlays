// Source Manifest gate. Fails the build (exit 1) when:
//  1. a content sentence that looks factual has no [[claim:id]] marker          (unmanifested claim)
//  2. a marker or a tool rule references a claim_id missing from the manifest     (unmanifested claim)
//  3. a referenced claim is not verification_status: "verified"                   (unverified claim)
//  4. a manifest entry is missing required fields or is older than MAX_AGE_DAYS   (stale/incomplete)
//  5. with --links: live-check every source URL; 404/410 and quote mismatches always fail; 403/5xx/timeouts/certificate errors may use a last-pass under 30 days (loud warning).
// Policy (non-negotiable accuracy rule): a claim that cannot pass this gate is omitted from the site, never shipped.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { norm, normJoin, stripHtml } from "./lib/normalize.mjs";
import { decideSourceCheck, loadLastPassed, recordPass } from "./lib/source-pass.mjs";
import { loadClaimMatches, recordClaimMatches, checkFallbackClaims } from "./lib/claim-match.mjs";
import { isNysedHost, nysedGet, nysedAvailable } from "./lib/nysed-tls.mjs";
import { SCOPES, scopeFlags } from "./lib/source-scope.mjs";

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
  if (!SCOPES.includes(c.source_scope)) errors.push(`manifest ${c.claim_id}: source_scope must be one of ${SCOPES.join("/")} (t127u rule 7)`);
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
// ::quote / ::figure lines on the job-aid pages are verified a different way: the build only accepts output text
// captured by running the real tools (qa/walkthroughs/texts.json), so the sentence heuristic would double-count them.
const walkTexts = new Set(existsSync(join(ROOT, "qa/walkthroughs/texts.json")) ? JSON.parse(readFileSync(join(ROOT, "qa/walkthroughs/texts.json"), "utf8")).texts : []);
// On the walkthrough page, sentences describing the labeled example family's own inputs are UI descriptions, not
// historical claims: the tools' source code is their source of truth, and the output quotes are checked separately.
const inExample = (where, s) => where.endsWith("walkthroughs.md") && /^(It fills in a made-up couple|In the marriage box|If your own record only says)/.test(s.trim());
const files = [];
for (const d of dirs) { const dir = join(ROOT, d); if (existsSync(dir)) for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) files.push([d, f]); }
let sentences = 0, marked = 0;
const perFile = {};
// t127u rule 7: society-wide wording needs that society's national source (scripts/lib/source-scope.mjs).
const scopeFlagged = [];
function scopeCheck(s, ids, where) {
  for (const f of scopeFlags(s, ids, byId)) { scopeFlagged.push(`${where}: "${s.replace(MARK, "").trim().slice(0, 90)}" — ${f}`); errors.push(`${where}: source scope (rule 7): "${s.replace(MARK, "").trim().slice(0, 90)}" ${f}`); }
}
function checkUnit(s, where) {
  if (!s.trim()) return; sentences++; perFile[where].units++;
  const ids = [...s.matchAll(MARK)].map((m) => m[1]);
  if (ids.length) { marked++; perFile[where].marked++; ids.forEach((id) => requireClaim(id, where)); scopeCheck(s, ids, where); }
  else if (FACTUAL.some((re) => re.test(s)) && !/^A green result reads:/.test(s.trim()) && !inExample(where, s)) { perFile[where].unmarked++; errors.push(`${where}: unmanifested factual sentence — "${s.trim().slice(0, 90)}"`); }
}
for (const [d, f] of files) {
  const where = `${d}/${f}`; perFile[where] = { units: 0, marked: 0, unmarked: 0 };
  const text = readFileSync(join(ROOT, d, f), "utf8").replace(/^---[\s\S]*?---/, "").replace(/```[\s\S]*?```/g, "");
  const lines = text.split("\n").filter((l) => l.trim() && !/^#/.test(l.trim()) && !/^::tool /.test(l.trim()) && !/^\|[-\s|]+\|$/.test(l.trim()));
  for (let line of lines) {
    if (/^::(quote|figure) /.test(line.trim())) {
      if (line.trim().startsWith("::quote ") && !walkTexts.has(line.trim().slice(8).replace(/^\S+ /, ""))) errors.push(`${where}: walkthrough quote is not in the captured tool outputs`);
      perFile[where].units++; sentences++; marked++; perFile[where].marked++; continue;
    }
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
  // Rule 7 for tool text: an object literal's text with its claim / claims.
  for (const m of src.matchAll(/\b(?:text|indirect|direct):\s*"((?:[^"\\]|\\.)*)",?[^{}]*?\bclaims?:\s*(\[[^\]]*\]|"[a-z0-9-]+")/g)) {
    const ids = [...m[2].matchAll(/"([a-z0-9-]+)"/g)].map((q) => q[1]); if (ids.length) scopeCheck(m[1], ids, `src/tools/${t}`);
  }
}
for (const id of byId.keys()) if (!referenced.has(id)) warnings.push(`manifest ${id}: not referenced by any page or tool`);

// Live source verification, with the Tim-approved 30-day unreachable fallback (see scripts/lib/source-pass.mjs).
const LAST_PASSED_PATH = join(ROOT, "manifest/source-last-passed.json");
const lastPassedStore = loadLastPassed(LAST_PASSED_PATH);
const CLAIM_MATCH_PATH = join(ROOT, "manifest/claim-last-matched.json");
const claimMatchStore = loadClaimMatches(CLAIM_MATCH_PATH);
const linkReport = [];
if (LINKS) {
  const urls = [...new Set(manifest.claims.map((c) => c.source_url))];
  const tmp = mkdtempSync(join(tmpdir(), "manifest-"));
  for (const u of urls) {
    let status = 0, body = "", type = "", altHays = [], fetchError = "";
    try {
      // New York State Library/Archives omit their intermediate certificate. Supply it for that
      // host only, verification fully on; other hosts keep Node's default path.
      const nyHost = isNysedHost(new URL(u).hostname);
      if (nyHost && nysedAvailable()) {
        const ny = await nysedGet(u);
        status = ny.status; body = ny.body; type = ny.type;
        if (status === 200) warnings.push(`${u}: verified with the official GlobalSign intermediate for nysed.gov (their server omits it)`);
      } else {
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
      }
    } catch (e) {
      fetchError = e.message || String(e);
      status = "error";
    }
    // Some sites' bot filters (e.g. dar.org's Cloudflare) reject Node's HTTP client but serve the same public page to curl.
    // Re-read the page with curl and still quote-check it; a non-200 from curl still fails unless the 30-day fallback applies.
    if ((status === 403 || status === 429) && !type.includes("pdf")) {
      try { const out = execFileSync("curl", ["-sL", "--max-time", "45", "-A", "Mozilla/5.0 (patriotinlays manifest checker)", "-H", "Accept: text/html", "-w", "\n%{http_code}", u], { encoding: "utf8", maxBuffer: 64e6 });
        const i = out.lastIndexOf("\n"); status = Number(out.slice(i + 1)); body = out.slice(0, i); if (status === 200) warnings.push(`${u}: Node fetch got 403/429; verified with curl instead`); } catch { /* keep original status */ }
    }
    // t124u: some state sites (sec.state.ma.us) sometimes answer with a tiny bot-check page instead of the article.
    // Re-read the same public page with curl a few times; if it never serves the article, the quote check fails as usual
    // (this never widens the 30-day fallback, and TLS verification stays on).
    const isChallenge = (b) => typeof b === "string" && b.length < 5000 && /_Incapsula_Resource|Request unsuccessful\. Incapsula/i.test(b);
    if (status === 200 && !type.includes("pdf") && isChallenge(body)) {
      for (let attempt = 1; attempt <= 4 && isChallenge(body); attempt++) {
        await new Promise((res) => setTimeout(res, 15000 * attempt));
        try { const out = execFileSync("curl", ["-sL", "--max-time", "45", "-A", "Mozilla/5.0 (patriotinlays manifest checker)", "-H", "Accept: text/html", "-w", "\n%{http_code}", u], { encoding: "utf8", maxBuffer: 64e6 });
          const i = out.lastIndexOf("\n"); const st = Number(out.slice(i + 1)); if (st === 200) body = out.slice(0, i); } catch { /* keep the challenge body */ }
      }
      warnings.push(`${u}: first read was a bot-check page; ${isChallenge(body) ? "every re-read was too, so its quotes cannot be found" : "re-read with curl and quote-checked"}`);
    }
    if (status !== 200) {
      const d = decideSourceCheck({ status, errorMessage: fetchError, lastPassedAt: lastPassedStore.sources[u] || null });
      if (d.outcome === "fallback") {
        warnings.push(`${u}: ${d.warning}`);
        // t128u: a fallback only covers claims whose exact quote really matched this page before, with no new uses since.
        const fc = checkFallbackClaims(manifest.claims.filter((c) => c.source_url === u), claimMatchStore);
        for (const h of fc.held) errors.push(`HELD ${h.claim_id}: ${u} is on fallback and this claim ${h.reason}. Hold it back until the source is reachable.`);
        for (const n of fc.newUses) warnings.push(`NEW USE ${n.claim_id}: ${u} is on fallback; quote matched ${n.matchedAt} but ${n.reason} were never read against the page. Review or hold back.`);
        linkReport.push({ url: u, status, quotesFound: "-", quotesMissing: "-", fallback: true, lastPassed: d.lastPassedAt, failureKind: d.failureKind, claimsCoveredByEarlierMatch: fc.ok.length, claimsHeld: fc.held.map((h) => h.claim_id), newUses: fc.newUses });
        continue;
      }
      errors.push(`${u}: ${d.error || (`HTTP ${status}` + (fetchError ? ` (${fetchError})` : ""))}`);
      linkReport.push({ url: u, status, fallback: false, failureKind: d.failureKind || null });
      continue;
    }
    const hay = body == null ? null : norm(type.includes("pdf") ? body : stripHtml(body));
    let found = 0, missing = 0;
    for (const c of manifest.claims.filter((c) => c.source_url === u)) {
      if (hay == null) continue;
      if (hay.includes(norm(c.quote_excerpt)) || altHays.some((h) => h.includes(norm(c.quote_excerpt)))) found++; else { missing++; errors.push(`${c.claim_id}: quote_excerpt not found in live source ${u}`); }
    }
    if (missing > 0) {
      // Quote mismatches always block; do not refresh last-passed.
      linkReport.push({ url: u, status, quotesFound: found, quotesMissing: missing, fallback: false, failureKind: "quote_mismatch" });
      continue;
    }
    // Record and save this source's pass right away (new URLs included), so a later failure can't drop it.
    if (hay != null) { recordPass(LAST_PASSED_PATH, lastPassedStore, u); recordClaimMatches(CLAIM_MATCH_PATH, claimMatchStore, manifest.claims.filter((c) => c.source_url === u)); }
    linkReport.push({ url: u, status, quotesFound: found, quotesMissing: missing });
  }
}

// Every report states plainly whether sources were fetched live (Tim, Nov 5): "Live-source check: RUN" / "NOT RUN".
const LIVE_STATUS = LINKS ? "RUN" : "NOT RUN";
const LIVE_LINE = `Live-source check: ${LIVE_STATUS}`;
const LIVE_REPORT_PATH = join(ROOT, "manifest-live-check-report.json");
const summary = { live_source_check: LIVE_STATUS, live_source_check_line: LIVE_LINE, checkedAt: new Date().toString(), dirs, files: files.length, perFile, sentences, markedSentences: marked, manifestClaims: byId.size, referencedClaims: referenced.size, links: LINKS ? linkReport : "not run (use --links)", errors, warnings };
if (LINKS) {
  summary.result = errors.length ? "FAILED" : "PASSED";
  // The live run's evidence lives in its own file; a later consistency-only run never overwrites it.
  if (!args.includes("--content")) writeFileSync(LIVE_REPORT_PATH, JSON.stringify(summary, null, 2));
} else if (existsSync(LIVE_REPORT_PATH)) {
  // A consistency-only report points to the most recent live run instead of hiding it.
  try { const L = JSON.parse(readFileSync(LIVE_REPORT_PATH, "utf8")); summary.last_live_source_check = { checkedAt: L.checkedAt, result: L.result, manifestClaims: L.manifestClaims, errors: (L.errors || []).length, fallbacks: (L.links || []).filter((x) => x.fallback).map((x) => x.url), report: "manifest-live-check-report.json" }; } catch { /* ignore */ }
}
if (!args.includes("--content")) writeFileSync(join(ROOT, "manifest-check-report.json"), JSON.stringify(summary, null, 2));
console.log(LIVE_LINE);
console.log(`Source Manifest gate: ${files.length} page(s), ${sentences} sentence(s), ${marked} with claim markers; ${byId.size} manifest claims, ${referenced.size} referenced.`);
if (LINKS) for (const l of linkReport) console.log(`  link ${l.status}${l.fallback ? " FALLBACK" : ""}  quotes found ${l.quotesFound ?? "-"} / missing ${l.quotesMissing ?? "-"}${l.fallback ? `  (claims covered by earlier match ${l.claimsCoveredByEarlierMatch} / held ${l.claimsHeld.length})` : ""}  ${l.url}`);
warnings.forEach((w) => console.log("WARN  " + w));
errors.forEach((e) => console.log("ERROR " + e));
console.log(`Source scope (rule 7): ${scopeFlagged.length} flagged`);
console.log(errors.length ? `FAILED with ${errors.length} error(s). Unverifiable claims must be omitted.` : "PASSED: every factual claim maps to a verified manifest entry.");
console.log(LIVE_LINE);
process.exit(errors.length ? 1 : 0);
