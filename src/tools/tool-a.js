// Tool A — Revolutionary War Service Window & Widow-Act Date Checker
// Pure client-side logic. No network calls, no storage of personal data beyond optional localStorage in the UI layer.
// Every rule carries a claim_id that must exist (verified) in manifest/claims.json; check-manifest.mjs enforces this.
// Output wording rule: never state "Qualifies". Consistent results use MSG.consistent verbatim; a result is never a ruling.

import { CONTACT_STEP, APPLY_STEP, linksFor } from "./next-steps.js";
import { MIN_YEAR, MAX_YEAR, decodeDate, dateRange, dateLabel } from "./dates.js";

export const MSG = Object.freeze({
  consistent: "Your dates fit the official service period for this type of service. This is not a ruling: your society decides. Next, find the original records that show the service.",
  partial: "Only part of your dates falls inside the official period. Check the exact dates in your records.",
  inconsistent: "Your dates fall outside the official period as you typed them. Check the dates and the type of service you picked.",
  invalid: "We couldn't read the dates: ",
  notEvaluated: "Not checked: the official source this site uses doesn't give enough detail to test this rule.",
});
// Plain result wording for the widow-pension laws (same statuses, different subject).
export const WIDOW_MSG = Object.freeze({
  consistent: "Every rule this tool can check for this law fits what you typed. The law also has terms this tool can't check (listed with the rule). This is not a ruling: your society decides.",
  partial: "Still possible: your dates are too rough to tell. A more exact date would settle it.",
  possible: "Still possible: nothing you typed rules it out, but it isn't settled yet. What it needs is listed with the rule.",
  inconsistent: "Ruled out as you typed it. Double-check what you typed.",
  not_evaluated: "Can't check here. See \"What to do\" with the rule.",
});
// "Why this matters" help for each widow-act field. Every sentence restates a manifest claim (claims[] is checked by check-manifest).
export const FIELD_HELP = Object.freeze({
  marriage: { text: "Why it matters: the 1836 law needed the marriage to come before his last period of service ended; the 1838 law needed it to come after that and before January 1, 1794; and the 1848 law covered widows married before January 2, 1800.", claims: ["nara-act-1836", "stat-1838-after-service", "nara-act-1848"] },
  serviceEnd: { text: "Why it matters: under the 1836 law the widow had to have married him before his last period of service expired; under the 1838 law, after it ended.", claims: ["nara-act-1836", "stat-1838-after-service"] },
  serviceMonths: { text: "Why it matters: the 1836 and 1838 laws relied on service under the 1832 law, which started at 6 months of service.", claims: ["nara-act-1832", "nara-act-1836", "stat-1838-1832-service"] },
  serviceDays: { text: "Why it matters: the 1878 law and the March 1855 bounty-land law covered service as short as 14 days, or any battle.", claims: ["nara-act-1878", "nara-bounty-1855", "stat-1855-14-days", "stat-1878-14-days-a"] },
  engagement: { text: "Why it matters: the March 1855 bounty-land law and the 1878 law accepted a battle in place of 14 days of service.", claims: ["stat-1855-14-days", "stat-1878-14-days-a", "stat-1878-14-days-b"] },
  kind: { text: "Why it matters: the 1836 and 1838 laws relied on the 1832 law, which covered service in the Continental Line or State troops, volunteers or militia; the 1848 law named the Continental line, State troops, volunteers, militia and the naval service.", claims: ["nara-act-1832-categories", "nara-act-1836", "stat-1838-1832-service", "stat-1848-service"] },
});
// Where "the official source" lives, for next-step links. URLs must be Source Manifest source_url values (tested).
export const NEXT_STEP_LINKS = Object.freeze({
  pensionFiles: { label: "National Archives: where to see the Revolutionary War pension files (free on FamilySearch with login)", url: "https://www.archives.gov/research/military/american-revolution", claim: "nara-amrev-familysearch" },
  m804: { label: "National Archives guide to the pension laws (PDF)", url: "https://www.archives.gov/files/research/military/army/dc/m804.pdf", claim: "nara-act-1853-1855" },
  serviceRecords: { label: "National Archives: Revolutionary War service records (PDF)", url: "https://www.archives.gov/files/research/military/american-revolution/service-records.pdf", claim: "nara-svc-state" },
  // The laws themselves: Library of Congress scans of the Statutes at Large (one large PDF per Congress). "#page=N" opens
  // the scan at the law's page (PDF page found by matching the quoted text; tested against the manifest URL without "#").
  law1836: { label: "Read the 1836 law itself: 5 Stat. 128 (Library of Congress scan, large PDF, about 23 MB; opens at the law's page in most browsers)", url: "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c24/llsl-c24.pdf#page=164", claim: "stat-1836-unmarried" },
  law1838: { label: "Read the 1838 law itself: 5 Stat. 303 (Library of Congress scan, large PDF, about 16 MB; opens at the law's page in most browsers)", url: "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c25/llsl-c25.pdf#page=96", claim: "stat-1838-after-service" },
  law1848: { label: "Read the 1848 law itself: 9 Stat. 265 (Library of Congress scan, large PDF, about 19 MB; opens at the law's page in most browsers)", url: "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c30/llsl-c30.pdf#page=57", claim: "stat-1848-service" },
  law1855: { label: "Read the 1855 bounty-land law itself: 10 Stat. 701 (Library of Congress scan, large PDF, about 89 MB; opens at the law's page in most browsers)", url: "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c33/llsl-c33.pdf#page=438", claim: "stat-1855-14-days" },
  law1853: { label: "Read the 1853 law itself: 10 Stat. 154 (Library of Congress scan, large PDF, about 27 MB; opens at the law's page in most browsers)", url: "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c32/llsl-c32.pdf#page=176", claim: "stat-1853-after-1800" },
  law1855pension: { label: "Read the February 28, 1855 law itself: chapter 126, section 3, at 10 Stat. 616 (Library of Congress scan, large PDF, about 89 MB; opens at the law's page in most browsers)", url: "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c33/llsl-c33.pdf#page=352", claim: "stat-1855feb-navy" },
  law1878: { label: "Read the 1878 law itself: 20 Stat. 27 (Library of Congress scan, large PDF, about 88 MB; opens at the law's page in most browsers)", url: "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c45/llsl-c45.pdf#page=54", claim: "stat-1878-14-days-a" },
});
// A ruled-out law needs nothing more from the user (audit 4).
export const NO_ACTION = "No action needed for this law: what you typed already rules it out. If something you typed is wrong, fix it and check again.";
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
// short = the wording in the Result column; fields = the form boxes that answer it (label = the box's own label).
const BOX = { m: { field: "tw-m", label: "When did the couple marry?" }, e: { field: "tw-e", label: "When did his last period of service end?" }, mo: { field: "tw-mo", label: "Total months of service" },
  d: { field: "tw-d", label: "Total days of service" }, b: { field: "tw-b", label: "Was he in at least one battle?" }, k: { field: "tw-k", label: "What kind of service was it?" } };
const need = (text, boxes, short) => ({ text, short: short || text.replace(/ \(.*\)$/, ""), field: boxes[0].field, fields: boxes });
export const NEEDS = Object.freeze({
  marriage: need("the marriage date", [BOX.m]),
  serviceEnd: need("when his last service ended", [BOX.e]),
  months: need("whether he served 6 months or more (his total months of service)", [BOX.mo]),
  kind: need("his kind of service (Continental Line, or State troops, volunteers or militia)", [BOX.k]),
  kindCheck: need("whether the 1832 law covered his kind of service (ask your society's registrar)", [BOX.k]),
  kindCheck1848: need("whether the 1848 law's list covered his service (it named the Continental line, State troops, volunteers, militia and the naval service; ask your society's registrar)", [BOX.k], "whether the 1848 law covered his kind of service"),
  // Two separate questions, either of which settles it (audit 4: don't merge them into one box).
  days: need("how many days he served (14 or more settles it), or whether he was in a battle (\"Yes\" settles it)", [{ ...BOX.d, hint: "14 or more settles it" }, { ...BOX.b, hint: "\"Yes\" settles it" }], "how many days he served, or whether he was in a battle"),
  battle: need("whether he was in a battle", [BOX.b]),
  kindArmy: need("his kind of service (the 1853 law covered the Revolutionary army; navy widows came under the February 1855 law)", [BOX.k], "his kind of service"),
  kindArmyCheck: need("whether his service counted as the Revolutionary army under this law (the law doesn't say whether militia counted; ask your society's registrar)", [BOX.k], "whether his service counted as the Revolutionary army"),
  navy: need("whether he served in the navy (as an officer, marine or mariner)", [BOX.k], "whether he served in the navy"),
  navyCheck: need("whether he served in the navy, as an officer, marine or mariner (ask your society's registrar)", [BOX.k], "whether he served in the navy"),
  exactMarriage: need("a more exact marriage date", [BOX.m]),
  exactBoth: need("a more exact marriage date or end-of-service date", [BOX.m, BOX.e]),
});
// Each law's test returns { status, text, reason?, needs?, ruledBy? }.
//   consistent = "Fits": every rule this tool has for the law (all from the National Archives guide) is settled by what was typed.
//   inconsistent = "Ruled out": something typed already breaks a rule (ruledBy "dates" or "service").
//   possible / partial = "Still possible": nothing typed breaks a rule, but at least one rule is still open (needs lists what would settle it).
//   not_evaluated = "Can't check here": the source doesn't give the law's terms.
// A law is never "Fits" while any of its rules is open (Tim's rule: no false confidence from dates alone).
const PASS_KINDS = ["continental", "militia"]; // the 1832 law's categories, as the National Archives guide names them
// Six months: typed months, or typed days that settle it either way (6 calendar months are 181 to 184 days).
const sixMonths = (w) => w.serviceMonths != null ? w.serviceMonths >= 6 : w.serviceDays != null ? (w.serviceDays >= 184 ? true : w.serviceDays < 181 ? false : null) : null;
const kindNeed = (w, checkKey) => (!w.kind || w.kind === "military" ? "kind" : PASS_KINDS.includes(w.kind) || (w.kind === "navy" && checkKey === "kindCheck1848") ? null : checkKey);
// Marriage vs. end of his last service: "before", "after", "maybe" (the dates overlap), or null (one is missing).
const order = (w) => !(w.marriage && w.serviceEnd) ? null : w.marriage.hi < w.serviceEnd.lo ? "before" : w.marriage.lo >= w.serviceEnd.hi ? "after" : "maybe";
const sixFail = (w, law) => w.serviceMonths != null ? `You typed ${plural(w.serviceMonths, "month")} of service. The ${law} law relied on service under the 1832 law, which started at 6 months.`
  : `You typed ${plural(w.serviceDays, "day")} of service, which is less than 6 months. The ${law} law relied on service under the 1832 law, which started at 6 months.`;
const settle = (needs, rule, reason) => !needs.length ? { status: "consistent", text: rule } : { status: needs.every((n) => n.startsWith("exact")) ? "partial" : "possible", text: rule, needs, reason: reason || null };
// Terms in each law's own text that this tool can't test from what is typed (her later life, his muster rolls, other pensions).
// They are shown as "Not checked here" on every row that isn't ruled out, so a fitting row never reads as fully settled.
export const WIDOW_ACTS = [
  { id: "act1836", label: "Act of July 4, 1836 (5 Stat. 128)", short: "1836", claim: "nara-act-1836", claim1832: "nara-act-1832", claimCategories: "nara-act-1832-categories",
    nextNote: "What to do: find out what kind of unit he served in. For state militia, the National Archives says to check the archives of the state where he served; for Continental troops, see its service-records guide.", nextLinks: ["serviceRecords", "law1836"], nextClaim: "nara-svc-state", claimHolds: "nara-svc-holds",
    unchecked: [{ text: "She was paid only while she stayed unmarried.", claim: "stat-1836-unmarried" }],
    // Decisive failures win over missing fields (audit 3); "Fits" needs the marriage order, 6+ months and a covered kind of service.
    test: (w) => {
      const rule = "Marriage must precede expiration of veteran's last period of service; service as specified in act of June 7, 1832 (at least 6 months, in the Continental Line or State troops, volunteers or militia).";
      const o = order(w), six = sixMonths(w); const fails = [];
      if (o === "after") fails.push(`You typed a marriage date of ${w.marriage.raw} and the end of his last service as ${w.serviceEnd.raw}, so the marriage came after his service ended. This law's rule is that the marriage came before his last period of service ended.`);
      if (six === false) fails.push(sixFail(w, "1836"));
      if (fails.length) return { status: "inconsistent", ruledBy: o === "after" ? "dates" : "service", text: rule, reason: fails.join(" ") };
      const needs = [];
      if (!w.marriage) needs.push("marriage"); if (!w.serviceEnd) needs.push("serviceEnd");
      if (o === "maybe") needs.push("exactBoth");
      if (six == null) needs.push("months");
      const k = kindNeed(w, "kindCheck"); if (k) needs.push(k);
      return settle(needs, rule, o === "maybe" ? `The marriage date (${w.marriage.raw}) and the end of his last service (${w.serviceEnd.raw}) are too rough to tell which came first. This law's rule is that the marriage came before his last period of service ended.` : null);
    } },
  // Audit 4 research: the act's own text (5 Stat. 303) also requires service "in the manner specified" by the 1832 act,
  // and a marriage AFTER his last period of service ended (before it, the widow fell under the 1836 act instead).
  { id: "act1838", label: "Act of July 7, 1838 (5 Stat. 303) — 5-year pensions", short: "1838", claim: "nara-act-1838", claimService: "stat-1838-1832-service", claimOrder: "stat-1838-after-service",
    nextNote: "What to do: find out how long and in what kind of unit he served. For state militia, the National Archives says to check the archives of the state where he served; for Continental troops, see its service-records guide.", nextLinks: ["serviceRecords", "law1838"],
    unchecked: [{ text: "The pension stopped if she married again.", claim: "stat-1838-remarriage" }],
    test: (w) => {
      const rule = "Service as specified in act of June 7, 1832 (at least 6 months, in the Continental Line or State troops, volunteers or militia); marriage after his last period of service ended and before January 1, 1794.";
      const o = order(w), six = sixMonths(w), cut = Date.UTC(1794, 0, 1); const fails = []; let byDates = false;
      if (o === "before") { byDates = true; fails.push(`You typed a marriage date of ${w.marriage.raw} and the end of his last service as ${w.serviceEnd.raw}, so the marriage came before his service ended. This law covered marriages after his last period of service ended.`); }
      if (w.marriage && w.marriage.lo >= cut) { byDates = true; fails.push(`You typed a marriage date of ${w.marriage.raw}. This law's rule is a marriage before January 1, 1794, so the date you typed is too late.`); }
      if (six === false) fails.push(sixFail(w, "1838"));
      if (fails.length) return { status: "inconsistent", ruledBy: byDates ? "dates" : "service", text: rule, reason: fails.join(" ") };
      const needs = [];
      if (!w.marriage) needs.push("marriage"); if (!w.serviceEnd) needs.push("serviceEnd");
      if (o === "maybe") needs.push("exactBoth"); else if (w.marriage && w.marriage.hi >= cut) needs.push("exactMarriage");
      if (six == null) needs.push("months");
      const k = kindNeed(w, "kindCheck"); if (k) needs.push(k);
      const reason = o === "maybe" ? `The marriage date (${w.marriage.raw}) and the end of his last service (${w.serviceEnd.raw}) are too rough to tell which came first. This law's rule is that the marriage came after his last period of service ended.`
        : w.marriage && w.marriage.hi >= cut ? `The marriage date you typed (${w.marriage.raw}) could fall on either side of January 1, 1794.` : null;
      return settle(needs, rule, reason);
    } },
  // Audit 4 research: the act's own text (9 Stat. 265) names the kinds of service it covered.
  { id: "act1848", label: "Act of July 29, 1848 (9 Stat. 265) — life pensions", short: "1848", claim: "nara-act-1848", claimService: "stat-1848-service", claimCutoff: "stat-1848-cutoff",
    nextNote: "What to do: find out what kind of unit he served in. For state militia, the National Archives says to check the archives of the state where he served; for Continental troops, see its service-records guide.", nextLinks: ["serviceRecords", "law1848"],
    unchecked: [{ text: "It was paid during her widowhood.", claim: "stat-1848-widowhood" }, { text: "A widow already receiving a pension could not get a further one under this law.", claim: "stat-1848-no-second" }],
    test: (w) => {
      const rule = "Marriage before January 2, 1800; he served in the Continental line, State troops, volunteers, militia or the naval service.";
      const m = w.marriage, cut = Date.UTC(1800, 0, 2);
      if (m && m.lo >= cut) return { status: "inconsistent", ruledBy: "dates", text: rule, reason: `You typed a marriage date of ${m.raw}. This law's rule is a marriage before January 2, 1800, so the date you typed is too late.` };
      const needs = [];
      if (!m) needs.push("marriage"); else if (m.hi >= cut) needs.push("exactMarriage");
      const k = kindNeed(w, "kindCheck1848"); if (k) needs.push(k);
      return settle(needs, rule, m && m.hi >= cut ? `The marriage date you typed (${m.raw}) could fall on either side of January 2, 1800.` : null);
    } },
  // Nov 5 batch: both laws read from the statute text (10 Stat. 154, sec. 2; 10 Stat. 616, sec. 3). 1853 covered widows of
  // the Revolutionary army married after January 1800 ("subsequent to January, anno Domini eighteen hundred"); a marriage
  // inside January 1800 is left open (the text doesn't settle it). Feb 1855 did the same for widows of navy officers,
  // marines or mariners married since January 1, 1800. Both gave pensions "in the same manner" as earlier widows.
  { id: "act1853", label: "Act of February 3, 1853 (10 Stat. 154)", short: "1853", claim: "nara-act-1853-1855", claimRule: "stat-1853-after-1800", claimArmy: "stat-1853-army", nextLinks: ["law1853"],
    unchecked: [{ text: "It gave these widows a pension in the same manner as widows married before 1800.", claim: "stat-1853-same-manner" }],
    test: (w) => {
      const rule = "Widow of an officer or soldier of the Revolutionary army, married after January 1800.";
      const m = w.marriage, before = Date.UTC(1800, 0, 1), after = Date.UTC(1800, 1, 1);
      if (m && m.hi < before) return { status: "inconsistent", ruledBy: "dates", text: rule, reason: `You typed a marriage date of ${m.raw}. This law covered marriages after January 1800, so the date you typed is too early (look at the 1836, 1838 and 1848 laws instead).` };
      if (w.kind === "navy") return { status: "inconsistent", ruledBy: "service", text: rule, reason: "You picked the navy. This law covered widows of the Revolutionary army; the February 1855 law covered navy widows." };
      const needs = [];
      if (!m) needs.push("marriage"); else if (m.lo < after) needs.push("exactMarriage");
      // Only the Continental Line is plainly "the Revolutionary army"; whether militia service counted, the text doesn't say.
      if (!w.kind || w.kind === "military") needs.push("kindArmy"); else if (w.kind !== "continental") needs.push("kindArmyCheck");
      return settle(needs, rule, m && m.lo < after ? `The marriage date you typed (${m.raw}) could fall in or before January 1800.` : null);
    } },
  { id: "act1855pension", label: "Act of February 28, 1855, ch. 126 (10 Stat. 616)", short: "February 1855", claim: "nara-act-1853-1855", claimRule: "stat-1855feb-navy", claimDate: "stat-1855feb-1800", nextLinks: ["law1855pension"],
    unchecked: [{ text: "It gave them pensions in the same manner as army widows under the 1853 law.", claim: "stat-1855feb-same" }],
    test: (w) => {
      const rule = "Widow of a navy officer, marine or mariner of the Revolutionary War, married since January 1, 1800.";
      const m = w.marriage, cut = Date.UTC(1800, 0, 1);
      if (m && m.hi < cut) return { status: "inconsistent", ruledBy: "dates", text: rule, reason: `You typed a marriage date of ${m.raw}. This law covered marriages since January 1, 1800, so the date you typed is too early.` };
      if (w.kind === "continental" || w.kind === "militia") return { status: "inconsistent", ruledBy: "service", text: rule, reason: "You picked army or militia service. This law covered widows of men who served in the navy (the 1853 law covered army widows)." };
      const needs = [];
      if (!m) needs.push("marriage"); else if (m.lo < cut) needs.push("exactMarriage");
      if (w.kind !== "navy") needs.push(w.kind === "other" ? "navyCheck" : "navy");
      return settle(needs, rule, m && m.lo < cut ? `The marriage date you typed (${m.raw}) could fall on either side of January 1, 1800.` : null);
    } },
  { id: "act1855bounty", label: "Bounty-land act of March 3, 1855 (10 Stat. 701) — 160 acres", short: "March 1855 bounty-land", claim: "nara-bounty-1855", claimRule: "stat-1855-14-days", claimRev: "stat-1855-revwar", nextLinks: ["law1855"],
    unchecked: [{ text: "Militia, volunteers or State troops had to have been regularly mustered, with the service paid by the United States.", claim: "stat-1855-mustered" },
      { text: "No warrant if the muster rolls show he deserted or was dishonorably discharged.", claim: "stat-1855-deserted" },
      { text: "A widow who had married again could still apply if she was a widow when she applied.", claim: "stat-1855-widow-at-application" }],
    test: (w) => minService(w, "At least 14 days of service, or actually in a battle; the law extended to Revolutionary War soldiers, their widows and minor children.") },
  { id: "act1878", label: "Act of March 9, 1878 (20 Stat. 29) — widows' life pensions", short: "1878", claim: "nara-act-1878", claimRule: "stat-1878-14-days-a", nextLinks: ["law1878"],
    unchecked: [{ text: "Her pension ended if she married again.", claim: "stat-1878-remarriage" }, { text: "It didn't apply to anyone already receiving a pension of $8 a month or more.", claim: "stat-1878-eight-dollars" }],
    test: (w) => minService(w, "A widow of a Revolutionary soldier who served at least 14 days or was in any engagement.") },
];


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

// Date parsing: accepts YYYY, YYYY-MM, YYYY-MM-DD, each optionally prefixed "~" (about), "<" (before) or ">" (after)
// (see dates.js). Returns {lo, hi, precision, raw} in UTC ms (hi = last ms of the range; ends inclusive).
export function parseDate(s) {
  if (s == null || s === "") return null;
  const t = String(s).trim();
  const m = /^([~<>])?(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(t);
  if (!m) throw new Error(`"${s}" isn't a date this tool can read. Pick the month, and type the day (optional) and the 4-digit year.`);
  const y = +m[2], mo = m[3] ? +m[3] : null, d = m[4] ? +m[4] : null;
  if (y < MIN_YEAR || y > MAX_YEAR) throw new Error(`the year ${y} looks like a typo. Use a year between ${MIN_YEAR} and ${MAX_YEAR}.`);
  if (mo !== null && (mo < 1 || mo > 12)) throw new Error(`the month "${m[3]}" isn't real. Months go from 01 (January) to 12 (December).`);
  if (d !== null) {
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (d < 1 || d > dim) throw new Error(`${dateLabel(t)} isn't a real calendar date. Check the day.`);
  }
  const p = decodeDate(t); const r = dateRange(p);
  if (r.hi < r.lo) throw new Error(`"${dateLabel(t)}" falls outside the years this tool checks (${MIN_YEAR} to ${MAX_YEAR}).`);
  return { lo: r.lo, hi: r.hi, precision: r.precision, cert: p.cert, raw: p.cert === "exact" ? m[0].replace(/^[~<>]/, "") : dateLabel(t) };
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
    const out = r.status === "inconsistent";
    // A ruled-out law gets "no action needed" and no to-do links (audit 4); every other row lists the law's terms this tool can't check.
    const links = out ? [] : [...(r.links || []), ...(a.nextLinks || [])].map((k) => NEXT_STEP_LINKS[k]);
    const unchecked = out || r.status === "not_evaluated" ? [] : a.unchecked || [];
    const base = WIDOW_MSG[r.status] || MSG[r.status];
    const message = r.status === "inconsistent" ? `${base.replace(/ Double-check what you typed\.$/, "")} ${r.reason}` : r.reason ? `${r.reason} ${base}` : base;
    return { act: a.id, label: a.label, short: a.short, status: r.status, verdict, ruledBy: r.ruledBy || null, needs, message, reason: r.reason || null, ruleText: r.text, uiNote: a.uiNote || null, claim: a.claim, unchecked,
      uncheckedText: unchecked.length ? `Not checked here (from the law's own text): ${unchecked.map((u) => u.text).join(" ")}` : null,
      why: r.why || null, next: needs.length ? `To settle it, tell us ${needs.map((n) => n.text).join(", and ")}.` : r.next || null,
      nextNote: out ? NO_ACTION : r.status === "consistent" ? null : a.nextNote || null, links }; });
}
// The short label shown in the Result column.
export function verdictFor(r, needs = []) {
  // Never a plain "Fits": every law has terms in its own text this tool can't test (Tim's rule; audit 4).
  if (r.status === "consistent") return "Fits the rules checked here; other terms not checked";
  if (r.status === "inconsistent") return r.ruledBy === "dates" ? "Ruled out by the dates" : "Ruled out by the service you typed";
  if (r.status === "not_evaluated") return "Can't check here";
  return `Still possible: need ${needs.map((n) => n.short || n.text.replace(/ \(.*\)$/, "")).join(", and ")}`;
}

// One plain answer above the results table: what fits, what is ruled out, what is still possible and what it needs,
// and the one question that would settle the most laws.
const andList = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`) + (xs.length === 1 ? " law" : " laws");
export function widowSummary(rows) {
  if (!rows?.length || rows[0].act === "input") return null;
  const by = (f) => rows.filter(f).map((r) => r.short || r.label);
  const fit = by((r) => r.status === "consistent"), outD = by((r) => r.status === "inconsistent" && r.ruledBy === "dates"), outS = by((r) => r.status === "inconsistent" && r.ruledBy !== "dates");
  const open = rows.filter((r) => r.status === "possible" || r.status === "partial"), nc = by((r) => r.status === "not_evaluated");
  const parts = [], lines = []; const line = (label, text) => { lines.push({ label, text }); };
  parts.push(fit.length ? `Fits every rule checked here (other terms in the law not checked): the ${andList(fit)}.` : `None of the ${rows.length} laws is settled as fitting yet.`);
  line("Fits", fit.length ? `the ${andList(fit)} (every rule checked here; other terms not checked)` : "none yet");
  if (outD.length) parts.push(`Ruled out by the dates: the ${andList(outD)}.`);
  if (outD.length || outS.length) line("Ruled out", [outD.length ? `the ${andList(outD)} (by the dates)` : "", outS.length ? `the ${andList(outS)} (by the service you typed)` : ""].filter(Boolean).join("; "));
  if (outS.length) parts.push(`Ruled out by the service you typed: the ${andList(outS)}.`);
  // Group the open laws by what they need.
  const groups = new Map(); for (const r of open) { const k = r.needs.map((n) => n.key).join("+"); if (!groups.has(k)) groups.set(k, { needs: r.needs, laws: [] }); groups.get(k).laws.push(r.short); }
  if (open.length) { const t = [...groups.values()].map((g) => `the ${andList(g.laws)} (need ${g.needs.map((n) => n.short).join(", and ")})`).join("; "); parts.push(`Still possible: ${t}.`); line("Still possible", t); }
  if (nc.length) { parts.push(`Can't check here: the ${andList(nc)} (the source doesn't give their terms).`); line("Can't check", `the ${andList(nc)}`); }
  // The one question that would settle the most open laws.
  const count = new Map(); for (const r of open) for (const n of r.needs) count.set(n.key, (count.get(n.key) || 0) + 1);
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  const ask = best ? { key: best[0], field: NEEDS[best[0]].field, fields: NEEDS[best[0]].fields, text: NEEDS[best[0]].text, settles: open.filter((r) => r.needs.some((n) => n.key === best[0])).map((r) => r.short) } : null;
  if (ask) parts.push(`To settle the most, tell us ${ask.text}: it bears on the ${andList(ask.settles)}.`);
  const next = fit.length || open.length ? "look for the widow's pension file (see \"What to do next\")." : nc.length ? "for the laws we can't check, read the widow's own pension papers or ask your society's registrar." : "double-check the dates, or ask your society's registrar.";
  parts.push(`Next: ${next}`); line("Next", ask ? `tell us ${ask.text}; then ${next}` : next);
  return { text: parts.join(" "), lines, fit: fit.length, total: rows.length, open: open.length, ask };
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
  if (st === "invalid") steps.push({ title: "Fix the dates and check again", text: "Pick the month (or \"Don't know\"), type the day if you know it, and type the year as 4 digits. If you aren't sure of a date, choose \"About\", \"Before\" or \"After\".", claims: [], links: [] });
  if (st === "inconsistent") steps.push({ title: "Double-check the dates and the type of service", text: "Look again at the dates in your records, and make sure you picked the right type of service: some types have their own start dates. If the dates still fall outside, ask your society's registrar before going further.", claims: ["dar-committee-1774", "dar-va-oath", "dar-galvez-troops"], links: linksFor("service", "sides") });
  if (st === "partial") steps.push({ title: "Pin down the exact dates", text: "Part of your date range falls outside the official period. Find the exact dates in the original records, then check again.", claims: [], links: linksFor("pension") });
  if (st === "consistent" || st === "partial") steps.push({ title: "Find the original records that prove the service", text: "DAR asks for original records (or transcriptions) such as pensions, muster rolls, pay vouchers, oaths of allegiance, town meeting minutes and county court orders. SAR does not take family tradition as proof of service.", claims: ["dar-service-sources", "sar-tradition"], links: linksFor("pensionFiles", "serviceRecords", "pension", "byState") });
  const sum = widow && widow[0]?.act !== "input" ? widowSummary(widow) : null;
  if (sum?.ask) steps.push({ title: "Answer one more question", text: `Tell us ${sum.ask.text}, in the ${sum.ask.fields.map((f) => `"${f.label}"`).join(" or ")} box${sum.ask.fields.length > 1 ? "es" : ""}, then check again. It bears on the ${andList(sum.ask.settles)}.`, claims: [], links: [] });
  const notChecked = (widow || []).filter((r) => r.status === "not_evaluated");
  if (notChecked.length) steps.push({ title: "For the laws marked \"Can't check here\"", text: `${notChecked.map((r) => r.label).join("; ")}: read the widow's own pension papers, or ask your society's registrar.`, claims: ["nara-amrev-familysearch", "nps-applegate-widow"], links: linksFor("pensionFiles", "pension") });
  const fits = (widow || []).some((r) => ["consistent", "partial", "possible"].includes(r.status));
  if (fits) steps.push({ title: "Look for the widow's pension file", text: "Widows' pension files are marked with a W and a file number. A widow's application may give her age, residence, maiden name, the date and place of the marriage, and the date and place of her husband's death, so it can prove a marriage in your line. The files are online free on FamilySearch (login needed). You can also order a copy of a Revolutionary War pension file from the National Archives with its NATF Form 85.", claims: ["m804-w", "m804-widow-info", "nara-amrev-familysearch", "nara-natf85-order", "nara-natf85-revwar"], links: linksFor("pensionFiles", "orderFile", "pension") });
  if (!window && !widow) steps.push({ title: "Fill in the form above", text: "Type the marriage date and what you know about his service, then press \"Check the widow pension laws\". Or press \"Load an example\" to see how it works.", claims: [], links: [] });
  steps.push({ title: "Prove each generation back to the patriot", text: "Use the free worksheet: record the patriot and his service, then the records you have for each person, and get a list of what is still missing and where to look.", claims: ["dar-each-relationship"], links: linksFor("matrix", "roadmap") });
  steps.push(CONTACT_STEP, APPLY_STEP);
  return steps;
}
