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
  consistent: "Every rule this tool has for this law is settled by what you typed, and it fits. This is not a ruling: your society decides.",
  partial: "Still possible: your dates are too rough to tell. A more exact date would settle it.",
  possible: "Still possible: nothing you typed rules it out, but it isn't settled yet. See what it needs in the next column.",
  inconsistent: "Ruled out as you typed it. Double-check what you typed.",
  not_evaluated: "Can't check here. See \"What to do\" in the next column.",
});
// "Why this matters" help for each widow-act field. Every sentence restates a manifest claim (claims[] is checked by check-manifest).
export const FIELD_HELP = Object.freeze({
  marriage: { text: "Why it matters: the 1836 law needed the marriage to come before his last period of service ended, the 1838 law covered widows married before January 1, 1794, and the 1848 law covered widows married before January 2, 1800.", claims: ["nara-act-1836", "nara-act-1838", "nara-act-1848"] },
  serviceEnd: { text: "Why it matters: under the 1836 law the widow had to have married him before his last period of service expired.", claims: ["nara-act-1836"] },
  serviceMonths: { text: "Why it matters: the 1836 law relied on service under the 1832 law, which started at 6 months of service.", claims: ["nara-act-1832", "nara-act-1836"] },
  serviceDays: { text: "Why it matters: the 1878 law and the March 1855 bounty-land law covered service as short as 14 days, or any battle.", claims: ["nara-act-1878", "nara-bounty-1855"] },
  kind: { text: "Why it matters: the 1836 law relied on the 1832 law, which covered service in the Continental Line or State troops, volunteers or militia.", claims: ["nara-act-1832-categories", "nara-act-1836"] },
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
// "1 month", "20 months": plain plurals for user-facing text.
export const plural = (n, word, many = `${word}s`) => `${n} ${Number(n) === 1 ? word : many}`;
// What each law still needs, in plain words, and the form box that answers it (ids match the form in build.mjs).
export const NEEDS = Object.freeze({
  marriage: { text: "the marriage date", field: "tw-m" },
  serviceEnd: { text: "when his last service ended", field: "tw-e" },
  months: { text: "whether he served 6 months or more (his total months of service)", field: "tw-mo" },
  kind: { text: "his kind of service (Continental Line, or State troops, volunteers or militia)", field: "tw-k" },
  kindCheck: { text: "whether the 1832 law covered his kind of service (ask your society's registrar)", field: "tw-k" },
  days: { text: "whether he served 14 days or more, or was in a battle", field: "tw-d" },
  battle: { text: "whether he was in a battle", field: "tw-b" },
  exactMarriage: { text: "a more exact marriage date", field: "tw-m" },
  exactBoth: { text: "a more exact marriage date or end-of-service date", field: "tw-m" },
});
// Each law's test returns { status, text, reason?, needs?, ruledBy? }.
//   consistent = "Fits": every rule this tool has for the law (all from the National Archives guide) is settled by what was typed.
//   inconsistent = "Ruled out": something typed already breaks a rule (ruledBy "dates" or "service").
//   possible / partial = "Still possible": nothing typed breaks a rule, but at least one rule is still open (needs lists what would settle it).
//   not_evaluated = "Can't check here": the source doesn't give the law's terms.
// A law is never "Fits" while any of its rules is open (Tim's rule: no false confidence from dates alone).
const PASS_KINDS = ["continental", "militia"]; // the 1832 law's categories, as the National Archives guide names them
export const WIDOW_ACTS = [
  { id: "act1836", label: "Act of July 4, 1836 (5 Stat. 128)", short: "1836", claim: "nara-act-1836", claim1832: "nara-act-1832", claimCategories: "nara-act-1832-categories",
    nextNote: "What to do: find out what kind of unit he served in. For state militia, the National Archives says to check the archives of the state where he served; for Continental troops, see its service-records guide.", nextLinks: ["serviceRecords"], nextClaim: "nara-svc-state", claimHolds: "nara-svc-holds",
    // Decisive failures win over missing fields (audit 3); "Fits" needs the marriage order, 6+ months and a covered kind of service.
    test: (w) => {
      const rule = "Marriage must precede expiration of veteran's last period of service; service as specified in act of June 7, 1832 (at least 6 months, in the Continental Line or State troops, volunteers or militia).";
      const mOk = w.marriage && w.serviceEnd ? (w.marriage.hi < w.serviceEnd.lo ? "yes" : (w.marriage.lo >= w.serviceEnd.hi ? "no" : "maybe")) : null;
      // Six months: typed months, or typed days that settle it either way (6 calendar months are 181 to 184 days).
      const six = w.serviceMonths != null ? w.serviceMonths >= 6 : w.serviceDays != null ? (w.serviceDays >= 184 ? true : w.serviceDays < 181 ? false : null) : null;
      const fails = [];
      if (mOk === "no") fails.push(`You typed a marriage date of ${w.marriage.raw} and the end of his last service as ${w.serviceEnd.raw}, so the marriage came after his service ended. This law's rule is that the marriage came before his last period of service ended.`);
      if (six === false) fails.push(w.serviceMonths != null ? `You typed ${plural(w.serviceMonths, "month")} of service. The 1836 law relied on service under the 1832 law, which started at 6 months.`
        : `You typed ${plural(w.serviceDays, "day")} of service, which is less than 6 months. The 1836 law relied on service under the 1832 law, which started at 6 months.`);
      if (fails.length) return { status: "inconsistent", ruledBy: mOk === "no" ? "dates" : "service", text: rule, reason: fails.join(" ") };
      const needs = [];
      if (!w.marriage) needs.push("marriage"); if (!w.serviceEnd) needs.push("serviceEnd");
      if (mOk === "maybe") needs.push("exactBoth");
      if (six == null) needs.push("months");
      if (!w.kind || w.kind === "military") needs.push("kind"); else if (!PASS_KINDS.includes(w.kind)) needs.push("kindCheck");
      if (!needs.length) return { status: "consistent", text: rule };
      return { status: needs.length === 1 && needs[0] === "exactBoth" ? "partial" : "possible", text: rule, needs,
        reason: mOk === "maybe" ? `The marriage date (${w.marriage.raw}) and the end of his last service (${w.serviceEnd.raw}) are too rough to tell which came first. This law's rule is that the marriage came before his last period of service ended.` : null };
    } },
  { id: "act1838", label: "Act of July 7, 1838 (5 Stat. 303) — 5-year pensions", short: "1838", claim: "nara-act-1838", uiNote: "The National Archives guide this tool follows gives only this marriage-date rule for this law, so the marriage date settles it here.",
    test: (w) => marriageBefore(w.marriage, "1794-01-01", "Marriage before January 1, 1794.") },
  { id: "act1848", label: "Act of July 29, 1848 (9 Stat. 265) — life pensions", short: "1848", claim: "nara-act-1848", uiNote: "The National Archives guide this tool follows gives only this marriage-date rule for this law, so the marriage date settles it here.",
    test: (w) => marriageBefore(w.marriage, "1800-01-02", "Marriage before January 2, 1800.") },
  // Punch-list 1: the source states only that marriage-date restrictions were removed; full statutory terms are
  // not given, so these acts are reported as "Can't check here" (not_evaluated), never as fitting.
  { id: "act1853", label: "Act of February 3, 1853 (10 Stat. 154)", short: "1853", claim: "nara-act-1853-1855",
    test: () => NOT_IN_SOURCE, nextClaim: "nara-act-1853-1855" },
  { id: "act1855pension", label: "Act of February 28, 1855 (10 Stat. 616)", short: "February 1855", claim: "nara-act-1853-1855",
    test: () => NOT_IN_SOURCE, nextClaim: "nara-act-1853-1855" },
  { id: "act1855bounty", label: "Bounty-land act of March 3, 1855 (10 Stat. 701) — 160 acres", short: "March 1855 bounty-land", claim: "nara-bounty-1855",
    test: (w) => minService(w, "Veteran served at least 14 days or took part in any battle; widows and minor children also eligible.") },
  { id: "act1878", label: "Act of March 9, 1878 (20 Stat. 29) — widows' life pensions", short: "1878", claim: "nara-act-1878",
    test: (w) => minService(w, "Veteran served at least 14 days or was in any engagement.") },
];

// 1853 / Feb 1855 acts: the source gives only that marriage-date limits were removed.
const NOT_IN_SOURCE = Object.freeze({ status: "not_evaluated",
  text: "Source states only that marriage-date restrictions were removed; the act's full eligibility terms are not stated in the source used, so this tool does not check this law.",
  why: "Why: the National Archives guide this site uses says only that this law removed the marriage-date limits. It does not list the law's other terms, so the tool can't test them.",
  next: "What to do: read the widow's own pension papers (the National Archives lists the pension files online, free on FamilySearch with login), or ask your society's registrar.",
  links: ["pensionFiles", "m804"] });
function marriageBefore(m, cutoffIso, rule) {
  if (!m) return { status: "possible", text: rule, needs: ["marriage"] };
  const c = Date.parse(cutoffIso + "T00:00:00Z"); const cut = rule.replace(/^Marriage before /, "").replace(/\.$/, "");
  if (m.hi < c) return { status: "consistent", text: rule };
  if (m.lo >= c) return { status: "inconsistent", ruledBy: "dates", text: rule, reason: `You typed a marriage date of ${m.raw}. This law's rule is a marriage before ${cut}, so the date you typed is too late.` };
  return { status: "partial", text: rule + " Entered marriage date is imprecise and straddles the cutoff.", needs: ["exactMarriage"], reason: `The marriage date you typed (${m.raw}) could fall on either side of ${cut}.` };
}
// 14 days or a battle. Typed months of 1 or more settle the 14 days (a month is at least 28 days). An unanswered battle
// question is "don't know", so short service alone never rules a law out unless the battle answer is "No".
function minService(w, rule) {
  if (w.engagement === true) return { status: "consistent", text: rule };
  if (w.serviceDays != null && w.serviceDays >= 14) return { status: "consistent", text: rule };
  if (w.serviceDays == null && w.serviceMonths != null && w.serviceMonths >= 1) return { status: "consistent", text: rule };
  const short = w.serviceDays != null && w.serviceDays < 14;
  if (short && w.engagement === false) return { status: "inconsistent", ruledBy: "service", text: rule,
    reason: `You typed ${plural(w.serviceDays, "day")} of service and that he was not in a battle. This law's rule is at least 14 days of service or a battle.` };
  if (short) return { status: "possible", text: rule, needs: ["battle"], reason: `You typed ${plural(w.serviceDays, "day")} of service, under 14 days, so it turns on whether he was in a battle.` };
  return { status: "possible", text: rule, needs: ["days"] };
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
    const lo = Date.UTC(y, mo - 1, d); return { lo, hi: lo + 86399999, precision: "day", raw: m[0] };
  }
  if (mo !== null) return { lo: Date.UTC(y, mo - 1, 1), hi: Date.UTC(y, mo, 1) - 1, precision: "month", raw: m[0] };
  return { lo: Date.UTC(y, 0, 1), hi: Date.UTC(y + 1, 0, 1) - 1, precision: "year", raw: m[0] };
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
      serviceMonths: input.serviceMonths ?? null, serviceDays: input.serviceDays ?? null, engagement: input.engagement ?? null, kind: input.kind || null };
  } catch (err) { return [{ act: "input", status: "invalid", message: MSG.invalid + err.message }]; }
  for (const k of ["serviceMonths", "serviceDays"]) if (w[k] != null && (!Number.isFinite(w[k]) || w[k] < 0)) return [{ act: "input", status: "invalid", message: MSG.invalid + `"${k === "serviceMonths" ? "Total months of service" : "Total days of service"}" needs a plain number, like 24.` }];
  // Months and days are two measures of the same service: if both are typed they must agree (a month is 28 to 31 days),
  // otherwise one of them would settle a rule the other contradicts.
  if (w.serviceMonths != null && w.serviceDays != null && (w.serviceDays < w.serviceMonths * 28 || w.serviceDays > (w.serviceMonths + 1) * 31))
    return [{ act: "input", status: "invalid", message: MSG.invalid + `${plural(w.serviceMonths, "month")} and ${plural(w.serviceDays, "day")} of service don't agree. Fill in just one of them, or check both.` }];
  return WIDOW_ACTS.map((a) => { const r = a.test(w);
    const needs = (r.needs || []).map((k) => ({ key: k, ...NEEDS[k] }));
    const verdict = verdictFor(r, needs);
    const links = [...(r.links || []), ...(a.nextLinks || [])].map((k) => NEXT_STEP_LINKS[k]);
    const base = WIDOW_MSG[r.status] || MSG[r.status];
    const message = r.status === "inconsistent" ? `${base.replace(/ Double-check what you typed\.$/, "")} ${r.reason}` : r.reason ? `${r.reason} ${base}` : base;
    return { act: a.id, label: a.label, short: a.short, status: r.status, verdict, ruledBy: r.ruledBy || null, needs, message, reason: r.reason || null, ruleText: r.text, uiNote: a.uiNote || null, claim: a.claim,
      why: r.why || null, next: needs.length ? `To settle it, tell us ${needs.map((n) => n.text).join(", and ")}.` : r.next || null, nextNote: r.status === "consistent" ? null : a.nextNote || null, links }; });
}
// The short label shown in the Result column.
export function verdictFor(r, needs = []) {
  if (r.status === "consistent") return "Fits (settled by what you typed; not a ruling)";
  if (r.status === "inconsistent") return r.ruledBy === "dates" ? "Ruled out by the dates" : "Ruled out by the service you typed";
  if (r.status === "not_evaluated") return "Can't check here";
  return `Still possible: need ${needs.map((n) => n.text.replace(/ \(.*\)$/, "")).join(", and ")}`;
}

// One plain answer above the results table: what fits, what is ruled out, what is still possible and what it needs,
// and the one question that would settle the most laws.
const andList = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`) + (xs.length === 1 ? " law" : " laws");
export function widowSummary(rows) {
  if (!rows?.length || rows[0].act === "input") return null;
  const by = (f) => rows.filter(f).map((r) => r.short || r.label);
  const fit = by((r) => r.status === "consistent"), outD = by((r) => r.status === "inconsistent" && r.ruledBy === "dates"), outS = by((r) => r.status === "inconsistent" && r.ruledBy !== "dates");
  const open = rows.filter((r) => r.status === "possible" || r.status === "partial"), nc = by((r) => r.status === "not_evaluated");
  const parts = [];
  parts.push(fit.length ? `Fits, settled by what you typed: the ${andList(fit)}.` : `None of the ${rows.length} laws is settled as fitting yet.`);
  if (outD.length) parts.push(`Ruled out by the dates: the ${andList(outD)}.`);
  if (outS.length) parts.push(`Ruled out by the service you typed: the ${andList(outS)}.`);
  // Group the open laws by what they need.
  const groups = new Map(); for (const r of open) { const k = r.needs.map((n) => n.key).join("+"); if (!groups.has(k)) groups.set(k, { needs: r.needs, laws: [] }); groups.get(k).laws.push(r.short); }
  if (open.length) parts.push(`Still possible: ${[...groups.values()].map((g) => `the ${andList(g.laws)} (need ${g.needs.map((n) => n.text.replace(/ \(.*\)$/, "")).join(", and ")})`).join("; ")}.`);
  if (nc.length) parts.push(`Can't check here: the ${andList(nc)} (the source doesn't give their terms).`);
  // The one question that would settle the most open laws.
  const count = new Map(); for (const r of open) for (const n of r.needs) count.set(n.key, (count.get(n.key) || 0) + 1);
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  const ask = best ? { key: best[0], field: NEEDS[best[0]].field, text: NEEDS[best[0]].text, settles: open.filter((r) => r.needs.some((n) => n.key === best[0])).map((r) => r.short) } : null;
  if (ask) parts.push(`To settle the most, tell us ${ask.text}: it bears on the ${andList(ask.settles)}.`);
  parts.push(fit.length || open.length ? "Next: look for the widow's pension file (see \"What to do next\")." : nc.length ? "Next: for the laws we can't check, read the widow's own pension papers or ask your society's registrar." : "Next: double-check the dates, or ask your society's registrar.");
  return { text: parts.join(" "), fit: fit.length, total: rows.length, open: open.length, ask };
}
// Plain terms used in the results table (each tied to a Source Manifest claim).
export const TERMS = Object.freeze({
  stat: { text: "\"Stat.\" means the Statutes at Large, the published federal laws: \"5 Stat. 128\" is volume 5, page 128.", claims: ["loc-stat-name", "loc-stat-volume", "loc-stat-page"] },
  bounty: { text: "Bounty land was free public land: a bounty-land warrant was a right to it, granted to veterans and their heirs for their service.", claims: ["m804-bl-define", "m804-bl-who"] },
});

// "What to do next": a numbered plan that depends on the service-window result and on any "Not checked" widow laws.
// window = result of checkServiceWindow() or null; widow = result of checkWidowActs() or null.
export function nextSteps(window, widow) {
  const steps = [];
  const st = window?.status;
  if (st === "invalid") steps.push({ title: "Fix the dates and check again", text: "Type numbers only: a year (1776), a year and month (1776-07), or a full date (1776-07-04).", claims: [], links: [] });
  if (st === "inconsistent") steps.push({ title: "Double-check the dates and the type of service", text: "Look again at the dates in your records, and make sure you picked the right type of service: some types have their own start dates. If the dates still fall outside, ask your society's registrar before going further.", claims: ["dar-committee-1774", "dar-va-oath", "dar-galvez-troops"], links: linksFor("service", "sides") });
  if (st === "partial") steps.push({ title: "Pin down the exact dates", text: "Part of your date range falls outside the official period. Find the exact dates in the original records, then check again.", claims: [], links: linksFor("pension") });
  if (st === "consistent" || st === "partial") steps.push({ title: "Find the original records that prove the service", text: "DAR asks for original records (or transcriptions) such as pensions, muster rolls, pay vouchers, oaths of allegiance, town meeting minutes and county court orders. SAR does not take family tradition as proof of service.", claims: ["dar-service-sources", "sar-tradition"], links: linksFor("pensionFiles", "serviceRecords", "pension", "byState") });
  const sum = widow && widow[0]?.act !== "input" ? widowSummary(widow) : null;
  if (sum?.ask) steps.push({ title: "Answer one more question", text: `Tell us ${sum.ask.text}, then check again. It bears on the ${andList(sum.ask.settles)}.`, claims: [], links: [] });
  const notChecked = (widow || []).filter((r) => r.status === "not_evaluated");
  if (notChecked.length) steps.push({ title: "For the laws marked \"Can't check here\"", text: `${notChecked.map((r) => r.label).join("; ")}: read the widow's own pension papers, or ask your society's registrar.`, claims: ["nara-amrev-familysearch", "nps-applegate-widow"], links: linksFor("pensionFiles", "pension") });
  const fits = (widow || []).some((r) => ["consistent", "partial", "possible"].includes(r.status));
  if (fits) steps.push({ title: "Look for the widow's pension file", text: "Widows' pension files are marked with a W and a file number. A widow's application may give her age, residence, maiden name, the date and place of the marriage, and the date and place of her husband's death, so it can prove a marriage in your line. The files are online free on FamilySearch (login needed).", claims: ["m804-w", "m804-widow-info", "nara-amrev-familysearch"], links: linksFor("pensionFiles", "pension") });
  if (!window && !widow) steps.push({ title: "Fill in the form above", text: "Type the marriage date and what you know about his service, then press \"Check the widow pension laws\". Or press \"Load an example\" to see how it works.", claims: [], links: [] });
  steps.push({ title: "Prove each generation back to the patriot", text: "Use the free worksheet: record the patriot and his service, then the records you have for each person, and get a list of what is still missing and where to look.", claims: ["dar-each-relationship"], links: linksFor("matrix", "roadmap") });
  steps.push(CONTACT_STEP, APPLY_STEP);
  return steps;
}
