// Tool A — Revolutionary War Service Window & Widow-Act Date Checker
// Pure client-side logic. No network calls, no storage of personal data beyond optional localStorage in the UI layer.
// Every rule carries a claim_id that must exist (verified) in manifest/claims.json; check-manifest.mjs enforces this.
// Output wording rule: never state "Qualifies". Consistent results use MSG.consistent verbatim.

export const MSG = Object.freeze({
  consistent: "Date range appears consistent with published rule; verify service category and primary evidence.",
  partial: "Date range only partly falls inside the published rule; confirm exact dates and primary evidence.",
  inconsistent: "Date range does not fall inside the published rule as entered; re-check dates, service category and primary evidence.",
  invalid: "Dates could not be evaluated: ",
  notEvaluated: "This published rule has a requirement the source does not state precisely enough to test; not evaluated.",
});

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
// Only requirements the pamphlet states are encoded; anything else is reported as not evaluated.
export const WIDOW_ACTS = [
  { id: "act1836", label: "Act of July 4, 1836 (5 Stat. 128)", claim: "nara-act-1836", claim1832: "nara-act-1832", claimCategories: "nara-act-1832-categories",
    uiNote: "Not evaluated: the service-category rules the 1836 act inherits from the act of June 7, 1832 (Continental Line or State troops, volunteers or militia; naval and marine service). Only total months of service and the marriage date are checked.",
    test: (w) => {
      if (!w.marriage || !w.serviceEnd) return { status: "not_evaluated", text: "Needs marriage date and end of last period of service." };
      if (w.serviceMonths == null) return { status: "not_evaluated", text: "Needs total months of service (1832-act service required)." };
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
    test: () => ({ status: "not_evaluated", text: "Source states only that marriage-date restrictions were removed; the act's full eligibility terms are not stated in the source used, so this act is not evaluated." }) },
  { id: "act1855pension", label: "Act of February 28, 1855 (10 Stat. 616)", claim: "nara-act-1853-1855",
    test: () => ({ status: "not_evaluated", text: "Source states only that marriage-date restrictions were removed; the act's full eligibility terms are not stated in the source used, so this act is not evaluated." }) },
  { id: "act1855bounty", label: "Bounty-land act of March 3, 1855 (10 Stat. 701) — 160 acres", claim: "nara-bounty-1855",
    test: (w) => minService(w, "Veteran served at least 14 days or took part in any battle; widows and minor children also eligible.") },
  { id: "act1878", label: "Act of March 9, 1878 (20 Stat. 29) — widows' life pensions", claim: "nara-act-1878",
    test: (w) => minService(w, "Veteran served at least 14 days or was in any engagement.") },
];

function needMarriage() { return { status: "not_evaluated", text: "Needs marriage date." }; }
function marriageBefore(m, cutoffIso, rule) {
  const c = Date.parse(cutoffIso + "T00:00:00Z");
  if (m.hi < c) return { status: "consistent", text: rule };
  if (m.lo >= c) return { status: "inconsistent", text: rule };
  return { status: "partial", text: rule + " Entered marriage date is imprecise and straddles the cutoff." };
}
function minService(w, rule) {
  if (w.engagement === true) return { status: "consistent", text: rule };
  if (w.serviceDays == null) return { status: "not_evaluated", text: "Needs days of service or an engagement/battle flag." };
  return { status: w.serviceDays >= 14 ? "consistent" : "inconsistent", text: rule };
}

// Date parsing: accepts YYYY, YYYY-MM, YYYY-MM-DD. Returns {lo, hi, precision} in UTC ms (hi = last ms of period).
export function parseDate(s) {
  if (s == null || s === "") return null;
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(s).trim());
  if (!m) throw new Error(`"${s}" is not YYYY, YYYY-MM or YYYY-MM-DD`);
  const y = +m[1], mo = m[2] ? +m[2] : null, d = m[3] ? +m[3] : null;
  if (y < 1600 || y > 1900) throw new Error(`year ${y} outside 1600–1900`);
  if (mo !== null && (mo < 1 || mo > 12)) throw new Error(`month ${mo} invalid`);
  if (d !== null) {
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (d < 1 || d > dim) throw new Error(`${s} is not a real calendar date`);
    const lo = Date.UTC(y, mo - 1, d); return { lo, hi: lo + 86399999, precision: "day" };
  }
  if (mo !== null) return { lo: Date.UTC(y, mo - 1, 1), hi: Date.UTC(y, mo, 1) - 1, precision: "month" };
  return { lo: Date.UTC(y, 0, 1), hi: Date.UTC(y + 1, 0, 1) - 1, precision: "year" };
}

const day = (iso, end) => { const t = Date.parse(iso + "T00:00:00Z"); return end ? t + 86399999 : t; };

// Main entry: checkServiceWindow({serviceType, start, end})
export function checkServiceWindow({ serviceType = "core", start, end }) {
  const rule = SERVICE_RULES.find((r) => r.id === serviceType);
  if (!rule) return { status: "invalid", message: MSG.invalid + `unknown service type "${serviceType}".` };
  let s, e;
  try { s = parseDate(start); e = parseDate(end ?? start); } catch (err) { return { status: "invalid", message: MSG.invalid + err.message, claim: rule.claim }; }
  if (!s) return { status: "invalid", message: MSG.invalid + "a start date is required.", claim: rule.claim };
  if (e.hi < s.lo) return { status: "invalid", message: MSG.invalid + "conflicting dates: end is before start.", claim: rule.claim };
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
  for (const k of ["serviceMonths", "serviceDays"]) if (w[k] != null && (!Number.isFinite(w[k]) || w[k] < 0)) return [{ act: "input", status: "invalid", message: MSG.invalid + `${k} must be a non-negative number.` }];
  return WIDOW_ACTS.map((a) => { const r = a.test(w);
    const message = r.status === "consistent" ? MSG.consistent : r.status === "not_evaluated" ? MSG.notEvaluated : MSG[r.status];
    return { act: a.id, label: a.label, status: r.status, message, ruleText: r.text, uiNote: a.uiNote || null, claim: a.claim }; });
}
