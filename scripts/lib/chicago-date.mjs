// t158: calendar dates for "last checked", "As of", "Sources last checked", recorded last-passed
// timestamps, and sitemap lastmod, in America/Chicago (US Central), not UTC.
const TZ = "America/Chicago";

function asDate(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`bad date: ${iso}`);
  return d;
}

function parts(iso, opts) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).formatToParts(asDate(iso)).map((p) => [p.type, p.value]));
}

/** YYYY-MM-DD in America/Chicago. */
export function chicagoDate(iso) {
  const p = parts(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "November 11, 2026" in America/Chicago (same shape as the old UTC longDate). */
export function chicagoLongDate(iso) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric", year: "numeric" }).format(asDate(iso));
}

/** ISO 8601 instant recorded with the America/Chicago offset, e.g. 2026-11-11T22:10:43.461-06:00. */
export function chicagoISO(at = new Date()) {
  const d = asDate(at);
  const p = parts(d, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    fractionalSecondDigits: 3, hourCycle: "h23", timeZoneName: "longOffset",
  });
  const frac = p.fractionalSecond || String(d.getMilliseconds()).padStart(3, "0");
  const off = (p.timeZoneName || "").replace(/^GMT/, "").replace(/^UTC/, "");
  if (!/^[+-]\d{2}:\d{2}$/.test(off)) throw new Error(`chicagoISO: unexpected offset ${p.timeZoneName}`);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${frac}${off}`;
}

export const CHICAGO_TZ = TZ;
