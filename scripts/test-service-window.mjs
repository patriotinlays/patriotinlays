// Service Window Checker suite: original 25 scenarios + 9 punch-list scenarios (36 with the Nov 5 statute rules). Exits non-zero unless all pass. Wired into `npm test` / `prebuild`.
import { checkServiceWindow, checkWidowActs, MSG, WIDOW_MSG, FIELD_HELP, NEXT_STEP_LINKS, nextSteps, plural, widowSummary, TERMS, WIDOW_ACTS, NO_ACTION } from "../src/tools/tool-a.js";
import { parseDate } from "../src/tools/tool-a.js";
import { encodeDate, decodeDate, dateRange, dateProblem, rangeWords, CERTAINTY, LIMIT_LO, LIMIT_HI } from "../src/tools/dates.js";
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
  [21, "Widow claim", "1836 act: married 1780-05-01, last service ended 1781-10-19, 24 months of State militia service", "consistent",
    () => act(checkWidowActs({ marriage: "1780-05-01", serviceEnd: "1781-10-19", serviceMonths: 24, kind: "militia" }), "act1836")],
  [22, "Widow claim", "1836 act: married 1785-06-01, after last service ended 1781-10-19", "inconsistent",
    () => act(checkWidowActs({ marriage: "1785-06-01", serviceEnd: "1781-10-19", serviceMonths: 24 }), "act1836")],
  // #23 updated for audit 4: the 1838 act's own text also needs 1832-act service and a marriage after his service ended.
  [23, "Widow claim", "1838 act: married 1793-12-31 vs 1794-01-01 (cutoff: before 1 Jan 1794), service ended 1781 after 24 months of militia service", "consistent|inconsistent",
    () => { const b = { serviceEnd: "1781-10-19", serviceMonths: 24, kind: "militia" }; return act(checkWidowActs({ ...b, marriage: "1793-12-31" }), "act1838") + "|" + act(checkWidowActs({ ...b, marriage: "1794-01-01" }), "act1838"); }],
  // #24 updated Nov 5: the 1853 and Feb 1855 acts are now read from the statute text (10 Stat. 154 sec. 2; 10 Stat. 616 sec. 3).
  [24, "Widow claim", "Married 1800-01-02: 1848 out; 1853 (after January 1800) too rough to tell; Feb 1855 fits a navy widow; 1853 rules out a navy widow", "inconsistent|partial|consistent|inconsistent",
    () => { const r = checkWidowActs({ marriage: "1800-01-02", kind: "navy" }); return [act(r, "act1848"), act(checkWidowActs({ marriage: "1800-01-02", kind: "continental" }), "act1853"), act(r, "act1855pension"), act(r, "act1853")].join("|"); }],
  [24.1, "Widow claim", "1853 act: continental, married 1800-02-01 fits; married 1799-12-31 ruled out by the dates; militia stays open (text doesn't say)", "consistent|inconsistent|possible",
    () => [act(checkWidowActs({ marriage: "1800-02-01", kind: "continental" }), "act1853"), act(checkWidowActs({ marriage: "1799-12-31", kind: "continental" }), "act1853"), act(checkWidowActs({ marriage: "1810", kind: "militia" }), "act1853")].join("|")],
  [24.2, "Widow claim", "Feb 1855 act: navy married 1800-01-01 fits; navy 1799-12-31 out; army 1810 out; unknown kind 1810 open", "consistent|inconsistent|inconsistent|possible",
    () => [act(checkWidowActs({ marriage: "1800-01-01", kind: "navy" }), "act1855pension"), act(checkWidowActs({ marriage: "1799-12-31", kind: "navy" }), "act1855pension"), act(checkWidowActs({ marriage: "1810", kind: "continental" }), "act1855pension"), act(checkWidowActs({ marriage: "1810" }), "act1855pension")].join("|")],
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
  [34, "Widow claim: kind of service", "1836 act with no kind of service given stays 'Still possible: need his kind of service' (1832 categories), with a What to do line", "true",
    () => { const r = checkWidowActs({ marriage: "1780-05-01", serviceEnd: "1781-10-19", serviceMonths: 24 }).find((x) => x.act === "act1836");
      return String(r.status === "possible" && r.needs.map((n) => n.key).join() === "kind" && /Continental Line/.test(r.ruleText) && /^Still possible: need his kind of service/.test(r.verdict) && /^What to do/.test(r.nextNote) && r.links.length > 0); }],
];
const EXPECTED_TOTAL = 36; // 25 original + 9 added for punch-list items 1-2 + 2 for the 1853 / Feb 1855 statute rules (Nov 5)

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
  ["1853 / Feb-1855 acts: read from the statute text, each with its own statute link and its 'not checked here' term", ["act1853", "act1855pension"].every((id) => { const r = checkWidowActs({ marriage: "1810" }).find((x) => x.act === id);
    return r.status === "possible" && r.links.some((l) => /tile\.loc\.gov/.test(l.url)) && r.unchecked.length === 1 && verified.has(r.unchecked[0].claim); })],
  ["Next-step links are all Source Manifest source URLs with verified claims", Object.values(NEXT_STEP_LINKS).every((l) => manifestUrls.has(l.url.replace(/#.*$/, "")) && verified.has(l.claim))],
  ["Each widow field has a one-line 'why it matters' tied to verified claims", ["marriage", "serviceEnd", "serviceMonths", "serviceDays"].every((k) => FIELD_HELP[k]?.text.startsWith("Why it matters") && FIELD_HELP[k].claims.every((c) => verified.has(c)))],
  ["Unreadable date gets a plain hint naming the month, day and 4-digit year boxes", /Pick the month/.test(sw("core", "July 1776").message) && /couldn't read/i.test(sw("core", "July 1776").message)],
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
  ["Next steps: 'Can't check here' laws get their own step naming them, with the pension-files link", (() => { const st = nextSteps(sw("core", "1778"), checkWidowActs({ marriage: "1780" }).map((r) => r.act === "act1853" ? { ...r, status: "not_evaluated" } : r)).find((x) => x.title.includes("Can't check here"));
    return st && /1853/.test(st.text) && /registrar/.test(st.text) && st.links.some((l) => l.url.includes("archives.gov")); })()],
  ["Next steps: unreadable dates -> 'Fix the dates' first", nextSteps(sw("core", "July 1776"), null)[0].title.startsWith("Fix the dates")],
  ["Next steps: every link is a manifest source or a site page; every claim verified; no fees or timelines", (() => { const all = [sw("core", "1778"), sw("core", "1790"), sw("core", "1775"), sw("core", "x"), null].flatMap((w) => nextSteps(w, checkWidowActs({ marriage: "1780" })));
    return all.every((x) => x.links.every((l) => manifestUrls.has(l.url) || l.url.startsWith("/")) && x.claims.every((c) => verified.has(c))) && !/\$|\bfee|\bweeks?\b/i.test(JSON.stringify(all.map((x) => [x.title, x.text]))); })()],
  ["Widow check: a law that fits -> 'Look for the widow's pension file' step citing the W-file and widow-info sources", (() => { const st = nextSteps(null, checkWidowActs({ serviceEnd: "1779", marriage: "1780", husbandDeath: "1830" })).find((x) => x.title.startsWith("Look for the widow"));
    return !!st && st.claims.includes("m804-w") && st.links.length > 0; })()],
  ["Widow check: every law ruled out or uncheckable -> no pension-file step", !nextSteps(null, checkWidowActs({ serviceEnd: "1779", marriage: "1820", serviceDays: 5, engagement: false }).map((r) => ({ ...r, status: r.status === "inconsistent" ? r.status : "not_evaluated" }))).some((x) => x.title.startsWith("Look for the widow"))],
  ["Widow check: empty form -> 'Fill in the form above' first", nextSteps(null, null)[0].title.startsWith("Fill in the form above")],
  ["Site link points at the widow checker, not the retired service-date page", NEXT_STEP_LINKS === undefined || !JSON.stringify(NEXT_STEP_LINKS).includes("service-window-checker")],
  ["Audit 2: 1836 'doesn't fit' says why in plain words (her marriage date vs. the end of his service, and the rule)", (() => { const r = checkWidowActs({ serviceEnd: "1779-10", marriage: "1790", serviceMonths: 20 }).find((x) => x.act === "act1836");
    return r.status === "inconsistent" && /1790/.test(r.message) && /1779-10/.test(r.message) && /marriage came after his service ended/.test(r.message) && /came before his last period of service ended/.test(r.message); })()],
  ["Audit 2: 1836 with under 6 months says how many months were typed, singular when 1", (() => { const r = checkWidowActs({ serviceEnd: "1779", marriage: "1775", serviceMonths: 1 }).find((x) => x.act === "act1836");
    return r.status === "inconsistent" && /You typed 1 month of service/.test(r.message) && /6 months/.test(r.message); })()],
  ["Audit 2: 1838 'doesn't fit' names the typed marriage date and the cutoff", /You typed a marriage date of 1795\. This law's rule is a marriage before January 1, 1794/.test(checkWidowActs({ marriage: "1795" }).find((x) => x.act === "act1838").message)],
  ["Audit 2: 1855/1878 'ruled out' says the days typed, the battle answer and the 14-day rule", /You typed 3 days of service and that he was not in a battle\. This law's rule is at least 14 days/.test(checkWidowActs({ serviceDays: 3, engagement: false }).find((x) => x.act === "act1878").message)],
  ["Audit 2: 'too rough to tell' says which dates straddle the rule", /too rough to tell which came first/.test(checkWidowActs({ serviceEnd: "1779", marriage: "1779", serviceMonths: 20 }).find((x) => x.act === "act1836").message)],
  ["Audit 2: every 'doesn't fit' or 'too rough' result carries a reason", [{ serviceEnd: "1779", marriage: "1801", serviceMonths: 20, serviceDays: 2 }, { serviceEnd: "1779", marriage: "1779", serviceMonths: 2, serviceDays: 2 }].flatMap((i) => checkWidowActs(i)).filter((r) => ["inconsistent", "partial"].includes(r.status)).every((r) => r.reason && r.message.includes(r.reason))],
  ["Audit 2: plural() reads '1 month', '2 months', '1 evidence entry', '0 evidence entries'", plural(1, "month") === "1 month" && plural(2, "month") === "2 months" && plural(1, "evidence entry", "evidence entries") === "1 evidence entry" && plural(0, "evidence entry", "evidence entries") === "0 evidence entries"],
  ["Answer line: names what fits, what the dates rule out, what is still possible and what it needs", (() => { const t = widowSummary(checkWidowActs({ marriage: "1790", serviceEnd: "1779" })).text;
    return t.startsWith("None of the 7 laws is settled as fitting yet.") && /Ruled out by the dates: the 1836, 1853 and February 1855 laws\./.test(t) && /Still possible: the 1838 law \(need whether he served 6 months or more, and his kind of service\); the 1848 law \(need his kind of service\); the March 1855 bounty-land and 1878 laws \(need how many days he served, or whether he was in a battle\)/.test(t) && !/Can't check here/.test(t); })()],
  ["Answer line: asks for the one field that settles the most open laws, with the box to answer it", (() => { const s1 = widowSummary(checkWidowActs({ marriage: "1790", serviceEnd: "1779" })); const s2 = widowSummary(checkWidowActs({ serviceMonths: 20 }));
    const s3 = widowSummary(checkWidowActs({ marriage: "1790", serviceEnd: "1779", kind: "militia", serviceMonths: 0 }));
    return s1.ask.key === "kind" && s1.ask.field === "tw-k" && s1.ask.settles.join() === "1838,1848" && /To settle the most, tell us his kind of service/.test(s1.text) && s2.ask.key === "marriage" && s2.ask.field === "tw-m"
      && s3.ask.key === "days" && s3.ask.fields.map((f) => f.field).join() === "tw-d,tw-b" && s3.ask.fields.every((f) => f.label && f.hint); })()],
  ["Answer line: nothing settled says so plainly; everything decided asks nothing more; input errors give no answer line", /^None of the 7 laws is settled as fitting yet\./.test(widowSummary(checkWidowActs({})).text) && widowSummary(checkWidowActs({ marriage: "1777-05", serviceEnd: "1778-03", serviceMonths: 20, engagement: true, kind: "militia" })).ask === null && widowSummary([{ act: "input", status: "invalid" }]) === null],
  ["Every widow law has a short name for the answer line", WIDOW_ACTS.every((a) => a.short && a.short.length < 30)],
  ["Plain terms for 'Stat.' and 'bounty land' cite verified claims", Object.values(TERMS).every((t) => t.text && t.claims.length && t.claims.every((c) => verified.has(c)))],
  ["Audit 3: married 1790, service ended 1779, no months -> 1836 'doesn't fit' with the plain reason (a decisive failure wins over a missing field)", (() => { const r = checkWidowActs({ marriage: "1790", serviceEnd: "1779" }).find((x) => x.act === "act1836"); return r.status === "inconsistent" && /marriage came after his service ended/.test(r.message) && !r.why; })()],
  ["Audit 3: under 6 months typed fails 1836 even with no dates; a missing field alone is 'Still possible', never 'Fits'", act(checkWidowActs({ serviceMonths: 3 }), "act1836") === "inconsistent" && act(checkWidowActs({ marriage: "1775", serviceEnd: "1779" }), "act1836") === "possible" && act(checkWidowActs({ serviceEnd: "1779", serviceMonths: 20, kind: "militia" }), "act1836") === "possible"],
  ["Audit 3: every law, every input mix: a law is never left open when a field it tests already fails it", (() => { const ms = [null, "1775", "1790", "1810"], es = [null, "1779"], mo = [null, 3, 20], ds = [null, 5, 30], en = [null, true, false];
    for (const marriage of ms) for (const serviceEnd of es) for (const serviceMonths of mo) for (const serviceDays of ds) for (const engagement of en) {
      const r = checkWidowActs({ marriage, serviceEnd, serviceMonths, serviceDays, engagement }); if (r[0].act === "input") continue; const st = (id) => act(r, id);
      if (marriage === "1810" && (st("act1838") !== "inconsistent" || st("act1848") !== "inconsistent")) return false;
      if (marriage && serviceEnd && +marriage > +serviceEnd && st("act1836") !== "inconsistent") return false;
      if (serviceMonths === 3 && st("act1836") !== "inconsistent") return false;
      if (serviceDays === 5 && engagement === false && serviceMonths == null && (st("act1855bounty") !== "inconsistent" || st("act1878") !== "inconsistent")) return false; }
    return true; })()],
  // ---- Dates only (Tim, Oct 31, 2026): never "Fits" unless the dates alone settle every rule ----
  ["Dates only (audit 4): across every marriage and end-of-service date mix, no law ever fits from the dates alone (1838 and 1848 also need his service)", (() => {
    const ms = [null, "1776", "1777-05", "1779", "1779-06-01", "1790", "1793", "1793-12-31", "1794", "1799", "1799-12-31", "1800", "1810"], es = [null, "1777", "1778-03", "1779", "1781-10-19"];
    for (const marriage of ms) for (const serviceEnd of es) for (const r of checkWidowActs({ marriage, serviceEnd })) if (r.status === "consistent") return false;
    return true; })()],
  ["Months and days that disagree are an input error, not a guess", checkWidowActs({ serviceMonths: 20, serviceDays: 5 })[0].act === "input" && checkWidowActs({ serviceMonths: 1, serviceDays: 30 })[0].act === "act1836"],
  ["Dates only: married 1790, service ended 1779 -> 1836 'Ruled out by the dates'; 1855 bounty-land and 1878 'Still possible: need 14 days or a battle'; nothing else fits", (() => { const r = checkWidowActs({ marriage: "1790", serviceEnd: "1779" });
    return act(r, "act1836") === "inconsistent" && r.find((x) => x.act === "act1836").verdict === "Ruled out by the dates" && ["act1855bounty", "act1878"].every((id) => r.find((x) => x.act === id).verdict === "Still possible: need how many days he served, or whether he was in a battle"); })()],
  ["Dates only: a 1777 marriage and service ending 1778 leave the 1836 law 'Still possible' (needs 6+ months and his kind of service), never 'Fits'", (() => { const r = checkWidowActs({ marriage: "1777-05", serviceEnd: "1778-03" }).find((x) => x.act === "act1836"); return r.status === "possible" && r.needs.map((n) => n.key).join() === "months,kind"; })()],
  ["Settled answers stay settled: whatever is filled in later, a 'Fits' never turns into anything else and a 'Ruled out' never reopens", (() => {
    const V = { marriage: [null, "1777", "1777-05", "1790", "1799"], serviceEnd: [null, "1778-03", "1779"], serviceMonths: [null, 3, 20], serviceDays: [null, 5, 182, 200], engagement: [null, true, false], kind: [null, "militia", "military", "other"] };
    const fill = { marriage: ["1776-03-01", "1779-01-01", "1795-05-05"], serviceEnd: ["1777-06-30", "1781-10-19"], serviceMonths: [0, 5, 6, 30], serviceDays: [10, 14, 183, 400], engagement: [true, false], kind: ["continental", "militia", "military", "other"] };
    const keys = Object.keys(V); let checked = 0;
    const each = (i, o, f) => { if (i === keys.length) return f(o); for (const v of V[keys[i]]) each(i + 1, { ...o, [keys[i]]: v }, f); };
    const completions = (o) => { let out = [o]; for (const k of keys) if (o[k] == null) out = out.flatMap((x) => fill[k].map((v) => ({ ...x, [k]: v }))); return out; };
    let ok = true;
    each(0, {}, (o) => { if (!ok) return; const base = checkWidowActs(o); if (base[0].act === "input") return; const comps = completions(o);
      for (const c of comps) { const r = checkWidowActs(c); if (r[0].act === "input") continue; for (const b of base) { const x = r.find((y) => y.act === b.act); checked++;
        if (b.status === "consistent" && x.status !== "consistent") ok = false;
        if (b.status === "inconsistent" && x.status !== "inconsistent") ok = false; } } });
    return ok && checked > 10000; })()],
  ["'Fits' wording only ever appears on a fully settled law; open laws always name what they need", (() => { const all = [{}, { marriage: "1790" }, { marriage: "1777", serviceEnd: "1777" }, { serviceDays: 5 }, { marriage: "1780-05-01", serviceEnd: "1781-10-19", serviceMonths: 24 }].flatMap((i) => checkWidowActs(i));
    return all.every((r) => (/^Fits/.test(r.verdict) === (r.status === "consistent")) && (!["possible", "partial"].includes(r.status) || (r.needs.length > 0 && /^Still possible: need /.test(r.verdict)))); })()],
  // ---- Audit 4 (Oct 31, 2026): the acts' own text, checked in the Statutes at Large ----
  ["Audit 4: 1838 law rules out a marriage before his service ended (that widow falls under 1836), with a plain reason", (() => { const r = checkWidowActs({ marriage: "1777-05", serviceEnd: "1778-03", serviceMonths: 20, kind: "militia" }).find((x) => x.act === "act1838");
    return r.status === "inconsistent" && r.ruledBy === "dates" && /marriage came before his service ended/.test(r.message); })()],
  ["Audit 4: 1838 law needs 6+ months of 1832-act service: 3 months rules it out; no months leaves it open", act(checkWidowActs({ marriage: "1790", serviceEnd: "1779", serviceMonths: 3 }), "act1838") === "inconsistent" && checkWidowActs({ marriage: "1790", serviceEnd: "1779", kind: "continental" }).find((x) => x.act === "act1838").needs.map((n) => n.key).join() === "months"],
  ["Audit 4: 1848 law needs his kind of service: militia settles it; 'something else' asks whether the 1848 list covers it", act(checkWidowActs({ marriage: "1790", kind: "militia" }), "act1848") === "consistent" && checkWidowActs({ marriage: "1790", kind: "other" }).find((x) => x.act === "act1848").needs.map((n) => n.key).join() === "kindCheck1848" && act(checkWidowActs({ marriage: "1790" }), "act1848") === "possible"],
  ["Audit 4: a fitting law never reads as plain 'Fits': it says other terms aren't checked and lists them, each from the law's own text (verified claims)", (() => { const rows = [{ marriage: "1790", serviceEnd: "1779", serviceMonths: 20, engagement: true, kind: "militia" }, { marriage: "1780-05-01", serviceEnd: "1781-10-19", serviceMonths: 24, kind: "continental" }].flatMap((i) => checkWidowActs(i)).filter((r) => r.status === "consistent");
    return rows.length >= 4 && rows.every((r) => r.verdict === "Fits the rules checked here; other terms not checked" && r.unchecked.length > 0 && r.unchecked.every((u) => verified.has(u.claim)) && /^Not checked here/.test(r.uncheckedText)) && WIDOW_ACTS.filter((a) => a.test.length).every((a) => a.id.match(/1853|1855pension/) || a.unchecked?.length); })()],
  ["Audit 4: every ruled-out law, every input mix, says no action is needed and shows no to-do links or 'find out' advice", (() => { const ms = [null, "1777-05", "1790", "1810"], es = [null, "1778-03", "1779"], mo = [null, 3, 20], ds = [null, 5], en = [null, false];
    let n = 0; for (const marriage of ms) for (const serviceEnd of es) for (const serviceMonths of mo) for (const serviceDays of ds) for (const engagement of en) { const r = checkWidowActs({ marriage, serviceEnd, serviceMonths, serviceDays, engagement }); if (r[0].act === "input") continue;
      for (const x of r.filter((y) => y.status === "inconsistent")) { n++; if (x.nextNote !== NO_ACTION || x.links.length || /find out/i.test(JSON.stringify(x)) || x.uncheckedText) return false; } }
    return n > 50; })()],
  ["Audit 4: the 14-days-or-a-battle question is two separate boxes, each named, in the plan step too", (() => { const st = nextSteps(null, checkWidowActs({ marriage: "1790", serviceEnd: "1779", kind: "militia", serviceMonths: 0 })).find((x) => x.title === "Answer one more question");
    return !!st && /"Total days of service" or "Was he in at least one battle\?" boxes/.test(st.text); })()],
  ["Audit 4: every statute link is a Source Manifest URL with a verified claim", ["law1836", "law1838", "law1848", "law1853", "law1855pension", "law1855", "law1878"].every((k) => manifestUrls.has(NEXT_STEP_LINKS[k].url.replace(/#page=\d+$/, "")) && /#page=\d+$/.test(NEXT_STEP_LINKS[k].url) && verified.has(NEXT_STEP_LINKS[k].claim))],
  // Code review: iOS's numeric keypad has no hyphen, so a field whose hint or placeholder shows a date like 1777-05
  // must not ask for it (each input is defined on one source line in build.mjs and tool-b-ui.js).
  ["Inputs: every typed date (widow: marriage, service end; worksheet: patriot start, end) is a memorable-date field: Month list, Day and Year on the number pad, certainty list; autocomplete, autocorrect and autocapitalize off; no hyphen hints on numeric fields", (() => {
    const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8"); const build = read("../scripts/build.mjs"), ui = read("../src/tools/date-ui.js"), tb = read("../src/tools/tool-b-ui.js");
    const numeric = [...build.split("\n"), ...tb.split("\n"), ...ui.split("\n")].filter((l) => /<input |el\("input"/.test(l) && /inputmode[=:]\s*"numeric"/.test(l));
    return /data-date-mount="marriage" data-id="tw-m"/.test(build) && /data-date-mount="serviceEnd" data-id="tw-e"/.test(build) && !/name="marriage" type="text"/.test(build)
      && /dateField\(\{ id: "pat-start"/.test(tb) && /dateField\(\{ id: "pat-end"/.test(tb) && !/type="date"|type: "date"|type: "month"/.test(build + ui + tb)
      && /maxlength: "4"/.test(ui) && /maxlength: "2"/.test(ui) && /autocorrect: "off", autocapitalize: "off"/.test(ui) && /"Don't know"/.test(ui)
      && numeric.length >= 4 && !numeric.some((l) => /\d{4}-\d{2}/.test(l)); })()],
  // Nov 5: memorable-date fields (Month / Day / Year + Exactly / About / Before / After). Full sweep.
  ["Dates: About 1780 = Jan 1 1778 to Dec 31 1782; About May 1780 = Nov 1 1779 to Nov 30 1780; day ignored under About; ends inclusive", (() => {
    const a = parseDate("~1780"), b = parseDate("~1780-05"), c = parseDate("~1780-05-17");
    return a.lo === Date.UTC(1778, 0, 1) && a.hi === Date.UTC(1783, 0, 1) - 1 && b.lo === Date.UTC(1779, 10, 1) && b.hi === Date.UTC(1780, 11, 1) - 1 && c.lo === b.lo && c.hi === b.hi
      && encodeDate({ year: "1780", month: "5", day: "17", cert: "about" }) === "~1780-05" && rangeWords("~1780") === "About 1780 is treated as January 1, 1778 to December 31, 1782." && rangeWords("~1780-05") === "About May 1780 is treated as November 1, 1779 to November 30, 1780."; })()],
  ["Dates: Before ends the day before the year/month/day begins and starts at 1600; After starts the day after it ends and runs to 1900", (() => {
    const b = parseDate("<1780"), bm = parseDate("<1780-05"), bd = parseDate("<1780-05-04"), a = parseDate(">1780"), am = parseDate(">1780-05");
    return b.lo === LIMIT_LO && b.hi === Date.UTC(1780, 0, 1) - 1 && bm.hi === Date.UTC(1780, 4, 1) - 1 && bd.hi === Date.UTC(1780, 4, 4) - 1 && a.lo === Date.UTC(1781, 0, 1) && a.hi === LIMIT_HI && am.lo === Date.UTC(1780, 5, 1); })()],
  ["Dates: saved values (1777, 1777-05, 1777-05-04) load into Month / Day / Year as 'Exactly' and re-save unchanged", ["1777", "1777-05", "1777-05-04", "~1780", "<1780-05", ">1781-10-19"].every((v) => { const p = decodeDate(v); return !p.bad && encodeDate(p) === v; })
    && decodeDate("1777-05").cert === "exact" && decodeDate("1777-05").month === "5" && decodeDate("1777-05").year === "1777"],
  ["Dates: field checks: year exactly 4 digits and 1600-1900; day 1-31 and real for the month; a day needs a month", dateProblem({ year: "177" }) && dateProblem({ year: "17777" }) && dateProblem({ year: "1599" }) && dateProblem({ year: "1780", month: "2", day: "30" }) && dateProblem({ year: "1780", day: "4" }) && !dateProblem({ year: "1780", month: "2", day: "29" }) && !dateProblem({ year: "1780" }) && !dateProblem({})],
  ["Dates: every Month/Day/Year/certainty combination parses to a range inside 1600-1900 whose words name both ends", (() => {
    let n = 0; for (const year of ["1600", "1601", "1776", "1780", "1799", "1800", "1899", "1900"]) for (const month of ["", "1", "2", "5", "7", "12"]) for (const day of ["", "1", "28", "31"]) for (const [cert] of CERTAINTY) {
      const parts = { year, month, day, cert }; if (dateProblem(parts)) continue; const v = encodeDate(parts); const rr = dateRange(decodeDate(v)); let r; try { r = parseDate(v); } catch (e) { if (rr.hi < rr.lo && /falls outside/.test(e.message)) continue; return false; }
      if (!(r.lo >= LIMIT_LO && r.hi <= LIMIT_HI && r.lo <= r.hi)) return false; if (cert !== "exact" && !/ is treated as .+ to .+\.$/.test(rangeWords(v))) return false; n++; }
    return n > 500; })()],
  // The no-false-"Fits" rule: a wider date can never settle a law that the exact dates inside it don't all settle the same way.
  ["Dates: widening never moves a law closer to 'Fits' than the exact dates inside the range (every law, marriage and service-end, all certainties)", (() => {
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    const others = [{}, { serviceMonths: 20, kind: "continental", engagement: true }, { serviceMonths: 3, kind: "navy", serviceDays: 90 }, { kind: "militia", serviceDays: 400 }];
    const ends = [null, "1778-03", "1781-10-19", "1799"];
    for (const year of ["1775", "1779", "1781", "1793", "1794", "1798", "1799", "1800", "1801", "1802"]) for (const month of ["", "1", "6", "12"]) for (const day of ["", "1", "15"]) for (const [cert] of CERTAINTY) {
      const parts = { year, month, day, cert }; if (dateProblem(parts)) continue; const v = encodeDate(parts); const r = parseDate(v);
      const samples = [r.lo, r.hi, Math.floor((r.lo + r.hi) / 2 / 864e5) * 864e5].map(iso);
      for (const o of others) for (const e of ends) {
        const wide = checkWidowActs({ ...o, marriage: v, serviceEnd: e }); const exact = samples.map((d) => checkWidowActs({ ...o, marriage: d, serviceEnd: e }));
        const plain = checkWidowActs({ ...o, marriage: encodeDate({ ...parts, cert: "exact" }), serviceEnd: e });
        for (const [i, w] of wide.entries()) { const ex = exact.map((x) => x[i].status);
          if (w.status === "consistent" && ((cert === "about" && plain[i].status !== "consistent") || ex.some((x) => x !== "consistent"))) return false; // "About" (a widening) can't fit unless the exact date does; no range fits unless every date inside it does
          if (w.status === "inconsistent" && ex.some((x) => x !== "inconsistent")) return false; } // never rules out what a date inside keeps open
        if (e) { const wideE = checkWidowActs({ ...o, marriage: samples[2], serviceEnd: v }); const exE = samples.map((d) => checkWidowActs({ ...o, marriage: samples[2], serviceEnd: d }));
          for (const [i, w] of wideE.entries()) { const ex = exE.map((x) => x[i].status); if (w.status === "consistent" && ex.some((x) => x !== "consistent")) return false; if (w.status === "inconsistent" && ex.some((x) => x !== "inconsistent")) return false; } }
      } }
    return true; })()],
  ["Dates: a range straddling a law's cutoff gives 'Still possible' (About 1793 for the 1838 law's January 1, 1794; After 1799 for the 1848 law's January 2, 1800)", (() => {
    const a = checkWidowActs({ marriage: "~1793", serviceEnd: "1781-10-19", serviceMonths: 20, kind: "militia" }).find((x) => x.act === "act1838"); const b = checkWidowActs({ marriage: ">1799-11", kind: "militia" }).find((x) => x.act === "act1848");
    return ["partial", "possible"].includes(a.status) && /^Still possible/.test(a.verdict) && ["partial", "possible"].includes(b.status) && /about 1793/.test(a.message); })()],
  ["Dates: no date entry alone ever gives a 'Fits' verdict (every certainty, both date boxes, nothing else typed)", (() => {
    for (const m of ["1777", "~1777", "<1790", ">1800", "~1805-05", "1810-02-01"]) for (const e of [null, "1778", "~1781", "<1782", ">1776"]) if (checkWidowActs({ marriage: m, serviceEnd: e }).some((r) => r.status === "consistent")) return false; return true; })()],
  ["Dates: the service-window check reads the new values too (About 1780 fits; Before 1775 is outside; About 1775 straddles)", sw("core", "~1780").status === "consistent" && sw("core", "<1775").status === "inconsistent" && sw("core", "~1775").status === "partial"],
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
