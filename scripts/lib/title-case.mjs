// Tim t146 #4: Title Case for every heading, page <title>, menu label and named section link, applied at build time.
// Rules (Tim's): capitalize every word except a, an, the, and, but, or, nor, for, of, to, in, on, at, by, as, unless it is
// the first or last word or follows a colon. Hyphenated words: capitalize each part (minor words inside a three-part
// compound such as "era-by-era" stay lower case). Proper names and acronyms are kept exactly (DAR, SAR, NSCDA, NARA,
// "Patriot, In Lay Terms"). Only letter case changes, so the string length never changes; HTML entities are skipped.
export const MINOR = new Set(["a", "an", "the", "and", "but", "or", "nor", "for", "of", "to", "in", "on", "at", "by", "as"]);
// Phrases kept exactly as written wherever they appear (the site's own name keeps its capital "In").
export const KEEP = ["Patriot, In Lay Terms", "Patriot In Lay Terms"];
const LEAD = /^((?:&[#a-zA-Z0-9]+;|[^A-Za-z&])*)([A-Za-z])/;
const cap = (w) => w.replace(LEAD, (m, pre, c) => pre + c.toUpperCase());
const core = (w) => w.replace(/&[#a-zA-Z0-9]+;/g, "").replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
function caseWord(w, forceCap) {
  const parts = w.split("-");
  return parts.map((p, i) => {
    const c = core(p); if (!c) return p;
    if (c !== c.toLowerCase() && c !== c[0].toUpperCase() + c.slice(1).toLowerCase()) return p; // acronyms, mixed case (DAR's, M804)
    const minor = MINOR.has(c.toLowerCase());
    const edge = parts.length > 1 && (i === 0 || i === parts.length - 1);
    if (minor && !(forceCap && i === 0) && !edge) return p.replace(c, c.toLowerCase());
    return cap(p);
  }).join("-");
}
export function titleCase(s) {
  const toks = s.split(/(\s+)/); const words = toks.map((t, i) => [t, i]).filter(([t]) => t && !/^\s+$/.test(t) && core(t));
  const firstI = words.length ? words[0][1] : -1, lastI = words.length ? words.at(-1)[1] : -1;
  let afterColon = false; let out = "";
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]; if (!t || /^\s+$/.test(t) || !core(t)) { out += t; if (/[:?!]$/.test(t)) afterColon = true; continue; }
    out += caseWord(t, i === firstI || i === lastI || afterColon);
    afterColon = /[:?!]["'’”)]*$/.test(t.replace(/&[#a-zA-Z0-9]+;$/, ""));
  }
  for (const k of KEEP) { let at = s.indexOf(k); while (at >= 0) { out = out.slice(0, at) + k + out.slice(at + k.length); at = s.indexOf(k, at + 1); } }
  if (out.length !== s.length) throw new Error(`titleCase changed length: ${s}`);
  return out;
}
// Applies titleCase to the text of each <h1>–<h6> in an HTML fragment, across inner tags, keeping tags and attributes.
export function titleCaseHeadings(html) {
  return html.replace(/(<(h[1-6])\b[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, inner, close) => open + titleCaseInner(inner) + close);
}
export function titleCaseInner(inner) {
  const parts = inner.split(/(<[^>]+>)/); const text = parts.map((p) => (p.startsWith("<") ? "" : p)).join("");
  const done = titleCase(text); let k = 0;
  return parts.map((p) => { if (p.startsWith("<")) return p; const r = done.slice(k, k + p.length); k += p.length; return r; }).join("");
}
