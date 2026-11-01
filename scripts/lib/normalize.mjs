// Shared text normalization for quote verification (used by check-manifest.mjs and the offline verifier).
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "...", eacute: "é", aacute: "á" };
export function decodeEntities(s) {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}
export function stripHtml(s) {
  return s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}
export function norm(s) {
  return decodeEntities(s)
    .replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u00a0/g, " ").replace(/-\s*\n\s*/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
}
// Scanned statute volumes break words across lines ("an-\nnuity"); this variant rejoins them. A quote may match either form.
export function normJoin(s) {
  return norm(decodeEntities(s).replace(/(\w)-[ \t]*\r?\n\s*(?=[a-z])/g, "$1"));
}
