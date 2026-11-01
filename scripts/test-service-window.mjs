// Service Window Checker suite: original 25 scenarios + 9 punch-list scenarios (34). Exits non-zero unless all pass. Wired into `npm test` / `prebuild`.
import { checkServiceWindow, checkWidowActs, MSG, WIDOW_MSG, FIELD_HELP, NEXT_STEP_LINKS, nextSteps, plural } from "../src/tools/tool-a.js";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync(new URL("../manifest/claims.json", import.meta.url), "utf8"));
const manifestUrls = new Set(manifest.claims.map((c) => c.source_url));
const verified = new Set(manifest.claims.filter((c) => c.verification_status === "verified").map((c) => c.claim_id));
import { writeFileSync } from "node:fs";

const sw = (serviceType, start, end) => checkServiceWindow({ serviceType, start, end });
const act = (res, id) => res.find((r) => r.act === id)?.status;
const S = [
  // id, group, description, expected (string), run() -> actual (string)
  [1, "Boundary 1775", "Core: 18 Apr 1775 (day before Lexington)", "inconsistent", () => sw("core", "1775-04-18").status],
  [2, "Boundary 1775", "Core: 19 Apr 1775 (first day of window)", "consistent", () => sw("core", "1775-04-19").status],
  [3, "Boundary 1775", "Core: 18 Apr – 19 Apr 1775 (straddles start)", "partial", () => sw("core", "1775-04-18", "1775-04-19").status],
  [4, "Boundary 1783", "Core: 26 Nov 1783 (last day of window)", "consistent", () => sw("core", "1783-11-26").status],
  [5, "Boundary 1783", "Core: 27 Nov 1783 (day after window)", "inconsistent", () => sw("core", "1783-11-27").status],
  [6, "Boundary 1783", "Core: 26 Nov – 27 Nov 1783 (straddles end)", "partial", () => sw("core", "1783-11-26", "1783-11-27").status],
  [7, "Boundary years", "Core: year-only 1775 (imprecise, straddles start)", "partial", () => sw("core", "1775").status],
  [8, "Boundary years", "Core: year-only 1783 (imprecise, straddles end)", "partial", () => sw("core", "1783").status],
  [9, "Boundary years", "Core: 1774-01 to 1774-12 (entirely before window)", "inconsistent", () => sw("core", "1774-01", "1774-12").status],
  [10, "Core", "Core: 1778-06 to 1780-12 (inside window); message is the mandated sentence", MSG.consistent, () => sw("core", "1778-06", "1780-12").message],
  [11, "Special window", "Committee service May 1774 (DAR: from April 1774)", "consistent", () => sw("committee", "1774-05").status],
  [12, "Special window", "Committee service March 1774 (before April 1774)", "inconsistent", () => sw("committee", "1774-03").status],
  [13, "Special window", "Virginia Oath of Fidelity, October 1779", "consistent", () => sw("va_oath", "1779-10").status],
  [14, "Special window", "Virginia Oath of Fidelity, September 1779", "inconsistent", () => sw("va_oath", "1779-09").status],
  [15, "Special window", "Gálvez troops, 24 Dec 1776 (not 'after')", "inconsistent", () => sw("galvez_troops", "1776-12-24").status],
  [16, "Special window", "Gálvez troops, 25 Dec 1776", "consistent", () => sw("galvez_troops", "1776-12-25").status],
  [17, "Special window", "Gálvez cattle supply, 24 Dec 1776 (not 'after')", "inconsistent", () => sw("galvez_cattle", "1776-12-24").status],
  [18, "Special window", "Gálvez cattle supply, 1779-03 to 1780-05", "consistent", () => sw("galvez_cattle", "1779-03", "1780-05").status],
  [19, "Invalid/conflicting", "End date (1777-05-01) before start (1778-02-01)", "invalid", () => sw("core", "1778-02-01", "1777-05-01").status],
  [20, "Invalid/conflicting", "Impossible calendar date 1777-02-30", "invalid", () => sw("core", "1777-02-30").status],
  [21, "Widow claim", "1836 act: married 1780-05-01, last service ended 1781-10-19, 24 months service", "consistent",
    () => act(checkWidowActs({ marriage: "1780-05-01", serviceEnd: "1781-10-19", serviceMonths: 24 }), "act1836")],
  [22, "Widow claim", "1836 act: married 1785-06-01, after last service ended 1781-10-19", "inconsistent",
    () => act(checkWidowActs({ marriage: "1785-06-01", serviceEnd: "1781-10-19", serviceMonths: 24 }), "act1836")],
  [23, "Widow claim", "1838 act: married 1793-12-31 vs 1794-01-01 (cutoff: before 1 Jan 1794)", "consistent|inconsistent",
    () => act(checkWidowActs({ marriage: "1793-12-31" }), "act1838") + "|" + act(checkWidowActs({ marriage: "1794-01-01" }), "act1838")],
  // #24 updated for punch-list item 1: 1853/1855 pension acts are now not_evaluated (full statutory terms not in source).
  [24, "Widow claim", "Married 1800-01-02: 1848 act (before 2 Jan 1800) vs 1853 & Feb 1855 acts (not evaluated)", "inconsistent|not_evaluated|not_evaluated",
    () => { const r = checkWidowActs({ marriage: "1800-01-02" }); return [act(r, "act1848"), act(r, "act1853"), act(r, "act1855pension")].join("|"); }],
  [25, "Widow claim", "1878 act & 1855 bounty land: 13 days no engagement vs 14 days", "inconsistent|inconsistent|consistent|consistent",
    () => { const a = checkWidowActs({ serviceDays: 13, engagement: false }), b = checkWidowActs({ serviceDays: 14 });
      return [act(a, "act1878"), act(a, "act1855bounty"), act(b, "act1878"), act(b, "act1855bounty")].join("|"); }],
  // ---- Punch-list item 2: exact boundary scenarios (added Oct 31, 2026) ----
  [26, "Boundary: committee", "Committee service 31 Mar 1774 (day before April 1774)", "inconsistent", () => sw("committee", "1774-03-31").status],
  [27, "Boundary: committee", "Committee service 1 Apr 1774 (first day of 'from April 1774')", "consistent", () => sw("committee", "1774-04-01").status],
  [28, "Boundary: VA oath", "Virginia Oath of Fidelity 30 Sep 1779 (day before October 1779)", "inconsistent", () => sw("va_oath", "1779-09-30").status],
  [29, "Boundary: VA oath", "Virginia Oath of Fidelity 1 Oct 1779 (first day of October 1779)", "consistent", () => sw("va_oath", "1779-10-01").status],
  [30, "Boundary: VA oath", "Virginia Oath of Fidelity 26 Nov 1783 vs 27 Nov 1783 (published end)", "consistent|inconsistent", () => sw("va_oath", "1783-11-26").status + "|" + sw("va_oath", "1783-11-27").status],
  [31, "Boundary: Gálvez end (assumed)", "Gálvez troops 26 Nov 1783 vs 27 Nov 1783", "consistent|inconsistent", () => sw("galvez_troops", "1783-11-26").status + "|" + sw("galvez_troops", "1783-11-27").status],
  [32, "Boundary: Gálvez end (assumed)", "Gálvez cattle supply 26 Nov 1783 vs 27 Nov 1783", "consistent|inconsistent", () => sw("galvez_cattle", "1783-11-26").status + "|" + sw("galvez_cattle", "1783-11-27").status],
  [33, "Boundary: Gálvez end (assumed)", "Assumed Gálvez end is disclosed: ruleNote present for troops and cattle results", "true|true",
    () => [sw("galvez_troops", "1780").ruleNote, sw("galvez_cattle", "1780").ruleNote].map((n) => String(!!n && /end date applied is the general period end/.test(n))).join("|")],
  [34, "Widow claim: UI note", "1836 act result carries the plain note that 1832 service-category rules are not checked, with a What to do line", "true",
    () => { const r = checkWidowActs({ marriage: "1780-05-01", serviceEnd: "1781-10-19", serviceMonths: 24 }).find((x) => x.act === "act1836");
      return String(!!r.uiNote && /1832/.test(r.uiNote) && /^Not checked/.test(r.uiNote) && /Continental Line/.test(r.uiNote) && /^What to do/.test(r.nextNote) && r.links.length > 0); }],
];
const EXPECTED_TOTAL = 34; // 25 original + 9 added for punch-list items 1-2

// Global guard applied to every scenario: no output may contain "qualif".
function allText(x) { return JSON.stringify(x); }
let pass = 0; const rows = [];
for (const [id, group, desc, expected, run] of S) {
  let actual, ok, err = null;
  try { actual = run(); ok = actual === expected; } catch (e) { actual = "THREW: " + e.message; ok = false; }
  rows.push({ id, group, desc, expected, actual, result: ok ? "PASS" : "FAIL" });
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"}  #${String(id).padStart(2)}  ${desc}  expected=${expected}  actual=${actual}`);
}
// "Qualifies" guard across a broad sweep of outputs
const sweep = [
  ...["core", "committee", "va_oath", "galvez_troops", "galvez_cattle"].flatMap((t) => ["1770", "1775", "1776-12-25", "1780", "1783-11-27", "1790-02-30"].map((d) => sw(t, d))),
  checkWidowActs({ marriage: "1780", serviceEnd: "1781", serviceMonths: 3, serviceDays: 90, engagement: true }),
  checkWidowActs({}),
];
// Plain-language checks (Oct 31, 2026 rework). Separate from the 34 date scenarios above.
const U = [
  ["Fitting dates say plainly that this is not a ruling", /not a ruling/.test(MSG.consistent) && /society decides/.test(MSG.consistent)],
  ["Every 'Not checked' widow result explains why and gives a next step", checkWidowActs({}).filter((r) => r.status === "not_evaluated").every((r) => r.why && r.next)],
  ["1853 / Feb-1855 acts: next step names the pension files and the society's registrar, with links", ["act1853", "act1855pension"].every((id) => { const r = checkWidowActs({ marriage: "1780" }).find((x) => x.act === id);
    return /pension/.test(r.next) && /registrar/.test(r.next) && r.links.length >= 1; })],
  ["Next-step links are all Source Manifest source URLs with verified claims", Object.values(NEXT_STEP_LINKS).every((l) => manifestUrls.has(l.url) && verified.has(l.claim))],
  ["Each widow field has a one-line 'why it matters' tied to verified claims", ["marriage", "serviceEnd", "serviceMonths", "serviceDays"].every((k) => FIELD_HELP[k]?.text.startsWith("Why it matters") && FIELD_HELP[k].claims.every((c) => verified.has(c)))],
  ["Unreadable date gets a plain hint with the 1776-07 format", /1776-07/.test(sw("core", "July 1776").message) && /couldn't read/i.test(sw("core", "July 1776").message)],
  ["No 'Not evaluated' wording remains in any visible output (all statuses, all laws, plan steps, labels)", (() => {
    const visible = []; const walk = (x, k) => { if (typeof x === "string") { if (!["status", "act", "claim", "url"].includes(k)) visible.push(x); } else if (Array.isArray(x)) x.forEach((y) => walk(y, k)); else if (x && typeof x === "object") for (const [kk, v] of Object.entries(x)) walk(v, kk); };
    const inputs = [{}, { marriage: "1780" }, { marriage: "1780-05-01", serviceEnd: "1781-10-19", serviceMonths: 24, serviceDays: 13 }, { marriage: "1800-01-02", serviceEnd: "1783", serviceMonths: 3, engagement: true }, { marriage: "x" }];
    for (const i of inputs) walk(checkWidowActs(i)); for (const d of ["1770", "1776", "1783", "1790-02-30"]) walk(sw("core", d));
    walk(MSG); walk(WIDOW_MSG); walk(FIELD_HELP); walk(nextSteps(sw("core", "1776"), checkWidowActs({ marriage: "1780" }))); walk(nextSteps(null, null));
    return visible.length > 50 && !visible.some((t) => /not evaluated/i.test(t)); })()],
  ["Next steps: dates fit -> 'Find the original records' (with National Archives links), then registrar, then application", (() => { const p = nextSteps(sw("core", "1778"), null).map((x) => x.title);
    return p[0] === "Find the original records that prove the service" && p.at(-2).includes("registrar") && p.at(-1).includes("application"); })()],
  ["Next steps: dates don't fit -> 'Double-check the dates and the type of service' first, no 'find records' step", (() => { const p = nextSteps(sw("core", "1790"), null).map((x) => x.title);
    return p[0].startsWith("Double-check") && !p.some((x) => x.startsWith("Find the original")); })()],
  ["Next steps: partly inside -> 'Pin down the exact dates' then find records", (() => { const p = nextSteps(sw("core", "1775"), null).map((x) => x.title); return p[0].startsWith("Pin down") && p[1].startsWith("Find the original"); })()],
  ["Next steps: 'Not checked' laws get their own step naming them, with the pension-files link", (() => { const st = nextSteps(sw("core", "1778"), checkWidowActs({ marriage: "1780" })).find((x) => x.title.includes("Not checked"));
    return st && /1853/.test(st.text) && /registrar/.test(st.text) && st.links.some((l) => l.url.includes("archives.gov")); })()],
  ["Next steps: unreadable dates -> 'Fix the dates' first", nextSteps(sw("core", "July 1776"), null)[0].title.startsWith("Fix the dates")],
  ["Next steps: every link is a manifest source or a site page; every claim verified; no fees or timelines", (() => { const all = [sw("core", "1778"), sw("core", "1790"), sw("core", "1775"), sw("core", "x"), null].flatMap((w) => nextSteps(w, checkWidowActs({ marriage: "1780" })));
    return all.every((x) => x.links.every((l) => manifestUrls.has(l.url) || l.url.startsWith("/")) && x.claims.every((c) => verified.has(c))) && !/\$|\bfee|\bweeks?\b/i.test(JSON.stringify(all.map((x) => [x.title, x.text]))); })()],
  ["Widow check: a law that fits -> 'Look for the widow's pension file' step citing the W-file and widow-info sources", (() => { const st = nextSteps(null, checkWidowActs({ serviceEnd: "1779", marriage: "1780", husbandDeath: "1830" })).find((x) => x.title.startsWith("Look for the widow"));
    return !!st && st.claims.includes("m804-w") && st.links.length > 0; })()],
  ["Widow check: no law fits -> no pension-file step", !nextSteps(null, checkWidowActs({ serviceEnd: "1779", marriage: "1820", husbandDeath: "1830" })).some((x) => x.title.startsWith("Look for the widow"))],
  ["Widow check: empty form -> 'Fill in the form above' first", nextSteps(null, null)[0].title.startsWith("Fill in the form above")],
  ["Site link points at the widow checker, not the retired service-date page", NEXT_STEP_LINKS === undefined || !JSON.stringify(NEXT_STEP_LINKS).includes("service-window-checker")],
  ["Audit 2: 1836 'doesn't fit' says why in plain words (her marriage date vs. the end of his service, and the rule)", (() => { const r = checkWidowActs({ serviceEnd: "1779-10", marriage: "1790", serviceMonths: 20 }).find((x) => x.act === "act1836");
    return r.status === "inconsistent" && /1790/.test(r.message) && /1779-10/.test(r.message) && /marriage came after his service ended/.test(r.message) && /came before his last period of service ended/.test(r.message); })()],
  ["Audit 2: 1836 with under 6 months says how many months were typed, singular when 1", (() => { const r = checkWidowActs({ serviceEnd: "1779", marriage: "1775", serviceMonths: 1 }).find((x) => x.act === "act1836");
    return r.status === "inconsistent" && /You typed 1 month of service/.test(r.message) && /6 months/.test(r.message); })()],
  ["Audit 2: 1838 'doesn't fit' names the typed marriage date and the cutoff", /You typed a marriage date of 1795\. This law's rule is a marriage before January 1, 1794/.test(checkWidowActs({ marriage: "1795" }).find((x) => x.act === "act1838").message)],
  ["Audit 2: 1855/1878 'doesn't fit' says the days typed and the 14-day rule", /You typed 3 days of service and did not tick the battle box\. This law's rule is at least 14 days/.test(checkWidowActs({ serviceDays: 3 }).find((x) => x.act === "act1878").message)],
  ["Audit 2: 'too rough to tell' says which dates straddle the rule", /too rough to tell which came first/.test(checkWidowActs({ serviceEnd: "1779", marriage: "1779", serviceMonths: 20 }).find((x) => x.act === "act1836").message)],
  ["Audit 2: every 'doesn't fit' or 'too rough' result carries a reason", [{ serviceEnd: "1779", marriage: "1801", serviceMonths: 20, serviceDays: 2 }, { serviceEnd: "1779", marriage: "1779", serviceMonths: 2, serviceDays: 2 }].flatMap((i) => checkWidowActs(i)).filter((r) => ["inconsistent", "partial"].includes(r.status)).every((r) => r.reason && r.message.includes(r.reason))],
  ["Audit 2: plural() reads '1 month', '2 months', '1 evidence entry', '0 evidence entries'", plural(1, "month") === "1 month" && plural(2, "month") === "2 months" && plural(1, "evidence entry", "evidence entries") === "1 evidence entry" && plural(0, "evidence entry", "evidence entries") === "0 evidence entries"],
  ["End-before-start error is plain", /end date is before the start date/.test(sw("core", "1778", "1777").message)],
];
let uPass = 0; for (const [n, ok] of U) { console.log(`${ok ? "PASS" : "FAIL"}  [plain] ${n}`); if (ok) uPass++; }
console.log(`Plain-language checks: ${uPass}/${U.length} passed.`);
const qual = /qualif/i.test(allText(sweep)) || /qualif/i.test(allText(Object.values(MSG)));
console.log(`Wording guard ("Qualif*" never appears in any output): ${qual ? "FAIL" : "PASS"}`);
if (S.length !== EXPECTED_TOTAL) { console.error(`Expected exactly ${EXPECTED_TOTAL} scenarios, found ${S.length}`); process.exit(1); }
console.log(`\nService Window Checker: ${pass}/${S.length} scenarios passed.`);
writeFileSync(new URL("../test-results-service-window.json", import.meta.url), JSON.stringify({ ranAt: new Date().toString(), node: process.version, pass, total: S.length, plainChecks: `${uPass}/${U.length}`, wordingGuard: qual ? "FAIL" : "PASS", rows }, null, 2));
process.exit(pass === S.length && S.length === EXPECTED_TOTAL && !qual && uPass === U.length ? 0 : 1);
