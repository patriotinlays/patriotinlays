// Memorable-date values (GOV.UK / USWDS pattern): Month (or "Don't know"), optional Day, 4-digit Year, plus a certainty.
// Stored as one short string so saved data and the worksheet-to-checker hand-off keep working:
//   "1777-05" = exactly May 1777 (the old format, unchanged)   "~1780" = about 1780
//   "<1780-05" = before May 1780                                ">1780" = after 1780
// Ranges are inclusive, in UTC ms: { lo, hi }. Open ends use the site's 1600 and 1900 limits.
// "About" is this site's rule of thumb, not part of any law: year only = 2 years either side; month and year = 6 months
// either side; the day is ignored.
export const MIN_YEAR = 1600, MAX_YEAR = 1900;
export const LIMIT_LO = Date.UTC(MIN_YEAR, 0, 1), LIMIT_HI = Date.UTC(MAX_YEAR + 1, 0, 1) - 1;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const CERTAINTY = Object.freeze([["exact", "Exactly"], ["about", "About"], ["before", "Before"], ["after", "After"]]);
export const ABOUT_NOTE = "'About' is this site's rule of thumb, not part of the law.";
const PREFIX = { exact: "", about: "~", before: "<", after: ">" };
const CERT_OF = { "": "exact", "~": "about", "<": "before", ">": "after" };
const pad = (n) => String(n).padStart(2, "0");

// Parts -> stored string ("" when no year). Day is dropped under "About" and when no month is chosen.
export function encodeDate({ year, month, day, cert = "exact" } = {}) {
  const y = String(year ?? "").trim(); if (!y) return "";
  const m = month ? +month : null, d = m && day !== "" && day != null && cert !== "about" ? +day : null;
  return `${PREFIX[cert] ?? ""}${y}${m ? `-${pad(m)}` : ""}${m && d ? `-${pad(d)}` : ""}`;
}
// Stored string -> parts (strings, for the form fields). Unreadable text comes back as { bad: text }.
export function decodeDate(s) {
  const t = String(s ?? "").trim(); if (!t) return { year: "", month: "", day: "", cert: "exact" };
  const m = /^([~<>])?(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(t);
  if (!m) return { bad: t, year: "", month: "", day: "", cert: "exact" };
  return { year: m[2], month: m[3] ? String(+m[3]) : "", day: m[4] ? String(+m[4]) : "", cert: CERT_OF[m[1] || ""] };
}
// Checks one set of parts; returns an error sentence or null.
export function dateProblem({ year, month, day } = {}) {
  const y = String(year ?? "").trim(), d = String(day ?? "").trim();
  if (!y) return d || month ? "type the year as 4 digits, for example 1780." : null;
  if (!/^\d{4}$/.test(y)) return `type the year as 4 digits, for example 1780 ("${y}" isn't 4 digits).`;
  if (+y < MIN_YEAR || +y > MAX_YEAR) return `the year ${y} looks like a typo. Use a year between ${MIN_YEAR} and ${MAX_YEAR}.`;
  if (d) {
    if (!/^\d{1,2}$/.test(d)) return "type the day as a number from 1 to 31, or leave it blank.";
    if (!month) return "pick the month too, or leave the day blank.";
    const dim = new Date(Date.UTC(+y, +month, 0)).getUTCDate();
    if (+d < 1 || +d > dim) return `${MONTHS[month - 1]} ${y} has no day ${+d}. Check the day, or leave it blank.`;
  }
  return null;
}
// The exact period the parts name (a year, a month or a day).
function period(y, mo, d) {
  if (d) { const lo = Date.UTC(y, mo - 1, d); return { lo, hi: lo + 86399999, precision: "day" }; }
  if (mo) return { lo: Date.UTC(y, mo - 1, 1), hi: Date.UTC(y, mo, 1) - 1, precision: "month" };
  return { lo: Date.UTC(y, 0, 1), hi: Date.UTC(y + 1, 0, 1) - 1, precision: "year" };
}
// Parts -> { lo, hi, precision, cert } (precision of the period typed), clamped to the 1600-1900 limits.
export function dateRange({ year, month, day, cert = "exact" }) {
  const y = +year, mo = month ? +month : null, d = mo && day ? +day : null;
  const p = period(y, mo, cert === "about" ? null : d);
  let lo = p.lo, hi = p.hi;
  if (cert === "about") {
    if (mo) { lo = Date.UTC(y, mo - 1 - 6, 1); hi = Date.UTC(y, mo + 6, 1) - 1; } else { lo = Date.UTC(y - 2, 0, 1); hi = Date.UTC(y + 3, 0, 1) - 1; }
  } else if (cert === "before") { lo = LIMIT_LO; hi = p.lo - 1; } else if (cert === "after") { lo = p.hi + 1; hi = LIMIT_HI; }
  return { lo: Math.max(lo, LIMIT_LO), hi: Math.min(hi, LIMIT_HI), precision: cert === "exact" ? p.precision : "range", cert };
}
const fmtDay = (t) => { const x = new Date(t); return `${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}, ${x.getUTCFullYear()}`; };
// "May 1780", "May 4, 1780", "1780"
export const plainDate = ({ year, month, day }) => month ? `${MONTHS[month - 1]} ${day ? `${+day}, ` : ""}${year}` : String(year);
const CERT_WORD = { exact: "", about: "about ", before: "before ", after: "after " };
// Short words for a stored value, e.g. "about May 1780"; the old ISO text for exact dates.
export function dateLabel(s) { const p = decodeDate(s); if (p.bad) return p.bad; if (!p.year) return ""; return p.cert === "exact" ? String(s).trim() : `${CERT_WORD[p.cert]}${plainDate({ ...p, day: p.cert === "about" ? "" : p.day })}`; }
// The range in words, e.g. "About 1780 is treated as January 1, 1778 to December 31, 1782."
export function rangeWords(s) {
  const p = decodeDate(s); if (p.bad || !p.year || dateProblem(p)) return "";
  const r = dateRange(p); const what = plainDate({ ...p, day: p.cert === "about" ? "" : p.day });
  if (p.cert === "exact") return "";
  const head = `${CERT_WORD[p.cert][0].toUpperCase()}${CERT_WORD[p.cert].slice(1)}${what}`;
  if (r.hi < r.lo) return `${head} falls outside the years this site checks (${MIN_YEAR} to ${MAX_YEAR}).`;
  const lo = `${fmtDay(r.lo)}${p.cert === "before" ? " (the earliest date this site uses)" : ""}`, hi = `${fmtDay(r.hi)}${p.cert === "after" ? " (the latest date this site uses)" : ""}`;
  return `${head} is treated as ${lo} to ${hi}.`;
}
