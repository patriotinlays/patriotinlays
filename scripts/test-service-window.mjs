// Service Window Checker suite: original 25 scenarios + 9 punch-list scenarios (34). Exits non-zero unless all pass. Wired into `npm test` / `prebuild`.
import { checkServiceWindow, checkWidowActs, MSG } from "../src/tools/tool-a.js";
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
  [34, "Widow claim: UI note", "1836 act result carries the note that 1832 service-category rules are not evaluated", "true",
    () => { const r = checkWidowActs({ marriage: "1780-05-01", serviceEnd: "1781-10-19", serviceMonths: 24 }).find((x) => x.act === "act1836");
      return String(!!r.uiNote && /1832/.test(r.uiNote) && /not evaluated/i.test(r.uiNote) && /Continental Line/.test(r.uiNote)); }],
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
const qual = /qualif/i.test(allText(sweep)) || /qualif/i.test(allText(Object.values(MSG)));
console.log(`Wording guard ("Qualif*" never appears in any output): ${qual ? "FAIL" : "PASS"}`);
if (S.length !== EXPECTED_TOTAL) { console.error(`Expected exactly ${EXPECTED_TOTAL} scenarios, found ${S.length}`); process.exit(1); }
console.log(`\nService Window Checker: ${pass}/${S.length} scenarios passed.`);
writeFileSync(new URL("../test-results-service-window.json", import.meta.url), JSON.stringify({ ranAt: new Date().toString(), node: process.version, pass, total: S.length, wordingGuard: qual ? "FAIL" : "PASS", rows }, null, 2));
process.exit(pass === S.length && S.length === EXPECTED_TOTAL && !qual ? 0 : 1);
