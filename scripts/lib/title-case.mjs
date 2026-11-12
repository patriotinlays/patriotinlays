// Tim t163 #4: Title Case for every heading, page <title>, card title, In Short title, menu label
// and named section link. This SUPERSEDES the t146 small-word exceptions rule.
// Rules (Tim, Nov 12 2026): capitalize EVERY word; no lowercase exceptions for a, an, the, and,
// but, or, nor, for, of, to, in, on, at, by, as. Examples: "Check A Widow's Pension",
// "Read The Full Plan". Hyphenated words: capitalize every part (including words that were
// previously left lowercase inside compounds, e.g. "Era-By-Era"). Proper names and acronyms
// are kept exactly (DAR, SAR, NSCDA, NARA, "Patriot, In Lay Terms"). Only letter case changes,
// so the string length never changes; HTML entities are skipped.
// Do not apply this to body text, buttons, form labels, tool results, or quoted source text.
export const MINOR = new Set(); // t163: no small-word exceptions; kept so older imports do not break.
// Phrases kept exactly as written wherever they appear (the site's own name keeps its capital "In").
export const KEEP = ["Patriot, In Lay Terms", "Patriot In Lay Terms"];
const LEAD = /^((?:&[#a-zA-Z0-9]+;|[^A-Za-z&])*)([A-Za-z])/;
const cap = (w) => w.replace(LEAD, (m, pre, c) => pre + c.toUpperCase());
const core = (w) => w.replace(/&[#a-zA-Z0-9]+;/g, "").replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
function caseWord(w) {
  const parts = w.split("-");
  return parts.map((p) => {
    const c = core(p); if (!c) return p;
    // Acronyms and mixed-case tokens (DAR's, M804, NSCDA) stay exactly as written.
    if (c !== c.toLowerCase() && c !== c[0].toUpperCase() + c.slice(1).toLowerCase()) return p;
    return cap(p);
  }).join("-");
}
export function titleCase(s) {
  const toks = s.split(/(\s+)/);
  let afterColon = false; let out = "";
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]; if (!t || /^\s+$/.test(t) || !core(t)) { out += t; if (/[:?!]$/.test(t)) afterColon = true; continue; }
    out += caseWord(t);
    afterColon = /[:?!]["'’”)]*$/.test(t.replace(/&[#a-zA-Z0-9]+;$/, ""));
  }
  for (const k of KEEP) { let at = s.indexOf(k); while (at >= 0) { out = out.slice(0, at) + k + out.slice(at + k.length); at = s.indexOf(k, at + 1); } }
  if (out.length !== s.length) throw new Error(`titleCase changed length: ${s}`);
  return out;
}
// Applies titleCase to the text of each <h1>–<h6> and <summary> in an HTML fragment, across inner tags.
export function titleCaseHeadings(html) {
  html = html.replace(/(<(h[1-6])\b[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, inner, close) => open + titleCaseInner(inner) + close);
  html = html.replace(/(<summary\b[^>]*>)([\s\S]*?)(<\/summary>)/g, (m, open, inner) => open + titleCaseInner(inner) + "</summary>");
  return html;
}
export function titleCaseInner(inner) {
  const parts = inner.split(/(<[^>]+>)/); const text = parts.map((p) => (p.startsWith("<") ? "" : p)).join("");
  const done = titleCase(text); let k = 0;
  return parts.map((p) => { if (p.startsWith("<")) return p; const r = done.slice(k, k + p.length); k += p.length; return r; }).join("");
}
