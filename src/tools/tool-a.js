// Tool A — Revolutionary War Service Window & Widow-Act Date Checker
// Pure client-side logic. No network calls, no storage of personal data beyond optional localStorage in the UI layer.
// Every rule carries a claim_id that must exist (verified) in manifest/claims.json; check-manifest.mjs enforces this.
// Output wording rule: never state "Qualifies". Consistent results use MSG.consistent verbatim; a result is never a ruling.

import { CONTACT_STEP, APPLY_STEP, linksFor } from "./next-steps.js";

export const MSG = Object.freeze({
  consistent: "Your dates fit the official service period for this type of service. This is not a ruling: your society decides. Next, find the original records that show the service.",
  partial: "Only part of your dates falls inside the official period. Check the exact dates in your records.",
  inconsistent: "Your dates fall outside the official period as you typed them. Check the dates and the type of service you picked.",
  invalid: "We couldn't read the dates: ",
  notEvaluated: "Not checked: the official source this site uses doesn't give enough detail to test this rule.",
});
// Plain result wording for the widow-pension laws (same statuses, different subject).
export const WIDOW_MSG = Object.freeze({
  consistent: "Fits this law's date rule as you typed it. This is not a ruling: your society decides.",
  partial: "Your dates are too rough to tell. A more exact date would settle it.",
  inconsistent: "Does not fit this law's date rule as you typed it. Double-check the dates.",
  not_evaluated: "Not checked. See \"What to do\" in the next column.",
});
// "Why this matters" help for each widow-act field. Every sentence restates a manifest claim (claims[] is checked by check-manifest).
export const FIELD_HELP = Object.freeze({
  marriage: { text: "Why it matters: the 1836 law needed the marriage to come before his last period of service ended, the 1838 law covered widows married before January 1, 1794, and the 1848 law covered widows married before January 2, 1800.", claims: ["nara-act-1836", "nara-act-1838", "nara-act-1848"] },
  serviceEnd: { text: "Why it matters: under the 1836 law the widow had to have married him before his last period of service expired.", claims: ["nara-act-1836"] },
  serviceMonths: { text: "Why it matters: the 1836 law relied on service under the 1832 law, which started at 6 months of service.", claims: ["nara-act-1832", "nara-act-1836"] },
  serviceDays: { text: "Why it matters: the 1878 law and the March 1855 bounty-land law covered service as short as 14 days, or any battle.", claims: ["nara-act-1878", "nara-bounty-1855"] },
});
// Where "the official source" lives, for next-step links. URLs must be Source Manifest source_url values (tested).
export const NEXT_STEP_LINKS = Object.freeze({
  pensionFiles: { label: "National Archives: where to see the Revolutionary War pension files (free on FamilySearch with login)", url: "https://www.archives.gov/research/military/american-revolution", claim: "nara-amrev-familysearch" },
  m804: { label: "National Archives guide to the pension laws (PDF)", url: "https://www.archives.gov/files/research/military/army/dc/m804.pdf", claim: "nara-act-1853-1855" },
  serviceRecords: { label: "National Archives: Revolutionary War service records (PDF)", url: "https://www.archives.gov/files/research/military/american-revolution/service-records.pdf", claim: "nara-svc-state" },
});
const FILL = (field) => `Fill in the "${field}" box above, then press the check button again.`;
// Service-window rules (DAR "Accepted Revolutionary War Service" page; SAR Step 1 page).
// "after 24 December 1776" is read as exclusive: earliest consistent day is 25 Dec 1776.
export const SERVICE_RULES = [
  { id: "core", label: "General Revolutionary War service period (DAR)", start: "1775-04-19", end: "1783-11-26", claim: "dar-window-core" },
  { id: "committee", label: "Committees that furthered the cause of the Colonies (from April 1774)", start: "1774-04-01", end: "1783-11-26", claim: "dar-committee-1774", note: "DAR states 'from April 1774'; the end date applied is the general period end." },
  { id: "va_oath", label: "Oath of Fidelity to the Commonwealth of Virginia", start: "1779-10-01", end: "1783-11-26", claim: "dar-va-oath" },
  { id: "galvez_troops", label: "Spanish troops under Gálvez or Louisiana Militia (after 24 Dec 1776)", start: "1776-12-25", end: "1783-11-26", claim: "dar-galvez-troops", note: "DAR gives only the start ('after 24 December 1776'); end date applied is the general period end." },
  { id: "galvez_cattle", label: "Material aid in Spanish America: supplying cattle for Gálvez's forces (after 24 Dec 1776)", start: "1776-12-25", end: "1783-11-26", claim: "dar-galvez-cattle", note: "DAR gives only the start ('after 24 December 1776'); end date applied is the general period end." },
];

// Widow pension / bounty-land acts (NARA M804 descriptive pamphlet, pp. 3-4 of text).
// Only requirements the pamphlet states are encoded; anything else is reported as not checked (status not_evaluated).
export const WIDOW_ACTS = [
  { id: "act1836", label: "Act of July 4, 1836 (5 Stat. 128)", claim: "nara-act-1836", claim1832: "nara-act-1832", claimCategories: "nara-act-1832-categories",
    nextNote: "What to do: find out what kind of unit he served in. For state militia, the National Archives says to check the archives of the state where he served; for Continental troops, see its service-records guide.", nextLinks: ["serviceRecords"], nextClaim: "nara-svc-state", claimHolds: "nara-svc-holds",
    uiNote: "Not checked: whether his type of service counted. The 1836 law relied on the service rules of the 1832 law (Continental Line or State troops, volunteers or militia). This tool checks only the marriage date and the months of service.",
    test: (w) => {
      if (!w.marriage || !w.serviceEnd) return { status: "not_evaluated", text: "Needs the marriage date and the date his last period of service ended.", why: "Missing information.", next: FILL(!w.marriage ? "Marriage date" : "When his last service ended") };
      if (w.serviceMonths == null) return { status: "not_evaluated", text: "Needs total months of service (1832-act service required).", why: "Missing information.", next: FILL("Total months of service") };
      const mOk = w.marriage.hi < w.serviceEnd.lo ? "yes" : (w.marriage.lo >= w.serviceEnd.hi ? "no" : "maybe");
      if (w.serviceMonths < 6) return { status: "inconsistent", text: "1836 act relies on 1832-act service (at least 6 months); entered service is shorter." };
      return { status: mOk === "yes" ? "consistent" : mOk === "no" ? "inconsistent" : "partial",
        text: "Marriage must precede expiration of veteran's last period of service; service as specified in act of June 7, 1832." };
    } },
  { id: "act1838", label: "Act of July 7, 1838 (5 Stat. 303) — 5-year pensions", claim: "nara-act-1838",
    test: (w) => w.marriage ? marriageBefore(w.marriage, "1794-01-01", "Marriage before January 1, 1794.") : needMarriage() },
  { id: "act1848", label: "Act of July 29, 1848 (9 Stat. 265) — life pensions", claim: "nara-act-1848",
    test: (w) => w.marriage ? marriageBefore(w.marriage, "1800-01-02", "Marriage before January 2, 1800.") : needMarriage() },
  // Punch-list 1: the source states only that marriage-date restrictions were removed; full statutory terms are
  // not given, so these acts are reported as not_evaluated rather than consistent.
  { id: "act1853", label: "Act of February 3, 1853 (10 Stat. 154)", claim: "nara-act-1853-1855",
    test: () => NOT_IN_SOURCE, nextClaim: "nara-act-1853-1855" },
  { id: "act1855pension", label: "Act of February 28, 1855 (10 Stat. 616)", claim: "nara-act-1853-1855",
    test: () => NOT_IN_SOURCE, nextClaim: "nara-act-1853-1855" },
  { id: "act1855bounty", label: "Bounty-land act of March 3, 1855 (10 Stat. 701) — 160 acres", claim: "nara-bounty-1855",
    test: (w) => minService(w, "Veteran served at least 14 days or took part in any battle; widows and minor children also eligible.") },
  { id: "act1878", label: "Act of March 9, 1878 (20 Stat. 29) — widows' life pensions", claim: "nara-act-1878",
    test: (w) => minService(w, "Veteran served at least 14 days or was in any engagement.") },
];

// 1853 / Feb 1855 acts: the source gives only that marriage-date limits were removed.
const NOT_IN_SOURCE = Object.freeze({ status: "not_evaluated",
  text: "Source states only that marriage-date restrictions were removed; the act's full eligibility terms are not stated in the source used, so this tool does not check this law.",
  why: "Why: the National Archives guide this site uses says only that this law removed the marriage-date limits. It does not list the law's other terms, so the tool can't test them.",
  next: "What to do: read the widow's own pension papers (the National Archives lists the pension files online, free on FamilySearch with login), or ask your society's registrar.",
  links: ["pensionFiles", "m804"] });
function needMarriage() { return { status: "not_evaluated", text: "Needs marriage date.", why: "Missing information.", next: FILL("Marriage date") }; }
function marriageBefore(m, cutoffIso, rule) {
  const c = Date.parse(cutoffIso + "T00:00:00Z");
  if (m.hi < c) return { status: "consistent", text: rule };
  if (m.lo >= c) return { status: "inconsistent", text: rule };
  return { status: "partial", text: rule + " Entered marriage date is imprecise and straddles the cutoff." };
}
function minService(w, rule) {
  if (w.engagement === true) return { status: "consistent", text: rule };
  if (w.serviceDays == null) return { status: "not_evaluated", text: "Needs days of service or an engagement/battle flag.", why: "Missing information.", next: FILL("Total days of service") + " Or tick the battle box if he was in a battle." };
  return { status: w.serviceDays >= 14 ? "consistent" : "inconsistent", text: rule };
}

// Date parsing: accepts YYYY, YYYY-MM, YYYY-MM-DD. Returns {lo, hi, precision} in UTC ms (hi = last ms of period).
export function parseDate(s) {
  if (s == null || s === "") return null;
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(s).trim());
  if (!m) throw new Error(`"${s}" isn't a date this tool can read. Type numbers only: a year (1776), a year and month (1776-07), or a full date (1776-07-04).`);
  const y = +m[1], mo = m[2] ? +m[2] : null, d = m[3] ? +m[3] : null;
  if (y < 1600 || y > 1900) throw new Error(`the year ${y} looks like a typo. Use a year between 1600 and 1900.`);
  if (mo !== null && (mo < 1 || mo > 12)) throw new Error(`the month "${m[2]}" isn't real. Months go from 01 (January) to 12 (December).`);
  if (d !== null) {
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (d < 1 || d > dim) throw new Error(`${s} isn't a real calendar date. Check the day.`);
    const lo = Date.UTC(y, mo - 1, d); return { lo, hi: lo + 86399999, precision: "day" };
  }
  if (mo !== null) return { lo: Date.UTC(y, mo - 1, 1), hi: Date.UTC(y, mo, 1) - 1, precision: "month" };
  return { lo: Date.UTC(y, 0, 1), hi: Date.UTC(y + 1, 0, 1) - 1, precision: "year" };
}

const day = (iso, end) => { const t = Date.parse(iso + "T00:00:00Z"); return end ? t + 86399999 : t; };

// Main entry: checkServiceWindow({serviceType, start, end})
export function checkServiceWindow({ serviceType = "core", start, end }) {
  const rule = SERVICE_RULES.find((r) => r.id === serviceType);
  if (!rule) return { status: "invalid", message: MSG.invalid + `pick a type of service from the list.` };
  let s, e;
  try { s = parseDate(start); e = parseDate(end ?? start); } catch (err) { return { status: "invalid", message: MSG.invalid + err.message, claim: rule.claim }; }
  if (!s) return { status: "invalid", message: MSG.invalid + "type a start date first (for example 1776 or 1776-07).", claim: rule.claim };
  if (e.hi < s.lo) return { status: "invalid", message: MSG.invalid + "the end date is before the start date. Swap them or fix the typo.", claim: rule.claim };
  const lo = s.lo, hi = e.hi, rlo = day(rule.start), rhi = day(rule.end, true);
  let status;
  if (lo >= rlo && hi <= rhi) status = "consistent";
  else if (hi < rlo || lo > rhi) status = "inconsistent";
  else status = "partial";
  return { status, message: MSG[status], rule: rule.label, ruleNote: rule.note || null, claim: rule.claim };
}

// Widow acts: input {marriage, serviceEnd, serviceMonths, serviceDays, engagement}
export function checkWidowActs(input) {
  let w;
  try {
    w = { marriage: parseDate(input.marriage), serviceEnd: parseDate(input.serviceEnd),
      serviceMonths: input.serviceMonths ?? null, serviceDays: input.serviceDays ?? null, engagement: input.engagement ?? null };
  } catch (err) { return [{ act: "input", status: "invalid", message: MSG.invalid + err.message }]; }
  for (const k of ["serviceMonths", "serviceDays"]) if (w[k] != null && (!Number.isFinite(w[k]) || w[k] < 0)) return [{ act: "input", status: "invalid", message: MSG.invalid + `"${k === "serviceMonths" ? "Total months of service" : "Total days of service"}" needs a plain number, like 24.` }];
  return WIDOW_ACTS.map((a) => { const r = a.test(w);
    const message = WIDOW_MSG[r.status] || MSG[r.status];
    const links = [...(r.links || []), ...(a.nextLinks || [])].map((k) => NEXT_STEP_LINKS[k]);
    return { act: a.id, label: a.label, status: r.status, message, ruleText: r.text, uiNote: a.uiNote || null, claim: a.claim,
      why: r.why || null, next: r.next || null, nextNote: a.nextNote || null, links }; });
}

// "What to do next": a numbered plan that depends on the service-window result and on any "Not checked" widow laws.
// window = result of checkServiceWindow() or null; widow = result of checkWidowActs() or null.
export function nextSteps(window, widow) {
  const steps = [];
  const st = window?.status;
  if (st === "invalid") steps.push({ title: "Fix the dates and check again", text: "Type numbers only: a year (1776), a year and month (1776-07), or a full date (1776-07-04).", claims: [], links: [] });
  if (st === "inconsistent") steps.push({ title: "Double-check the dates and the type of service", text: "Look again at the dates in your records, and make sure you picked the right type of service: some types have their own start dates. If the dates still fall outside, ask your society's registrar before going further.", claims: ["dar-committee-1774", "dar-va-oath", "dar-galvez-troops"], links: linksFor("service", "sides") });
  if (st === "partial") steps.push({ title: "Pin down the exact dates", text: "Part of your date range falls outside the official period. Find the exact dates in the original records, then check again.", claims: [], links: linksFor("pension") });
  if (st === "consistent" || st === "partial") steps.push({ title: "Find the original records that prove the service", text: "DAR asks for original records (or transcriptions) such as pensions, muster rolls, pay vouchers, oaths of allegiance, town meeting minutes and county court orders. SAR does not take family tradition as proof of service.", claims: ["dar-service-sources", "sar-tradition"], links: linksFor("pensionFiles", "serviceRecords", "pension", "byState") });
  const notChecked = (widow || []).filter((r) => r.status === "not_evaluated" && r.why && r.why !== "Missing information.");
  if (notChecked.length) steps.push({ title: "For the laws marked \"Not checked\"", text: `${notChecked.map((r) => r.label).join("; ")}: read the widow's own pension papers, or ask your society's registrar.`, claims: ["nara-amrev-familysearch", "nps-applegate-widow"], links: linksFor("pensionFiles", "pension") });
  if (!window && !notChecked.length) steps.push({ title: "Check your ancestor's service dates", text: "Fill in step 1 above and press \"Check these dates\".", claims: [], links: [] });
  steps.push({ title: "Prove each generation back to the patriot", text: "Use the free worksheet to list the records you have for each person and get a list of what is still missing.", claims: ["dar-each-relationship"], links: linksFor("matrix", "roadmap") });
  steps.push(CONTACT_STEP, APPLY_STEP);
  return steps;
}
