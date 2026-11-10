// t128u: per-claim match records (manifest/claim-last-matched.json).
// The 30-day fallback is per source, so on its own it would let a claim (or a new use of a claim) that was added
// while its source was unreachable pass without its quote ever being matched against that page. Every successful
// live quote match now records, per claim: the source URL, the exact quote, when it matched and the pages using it.
// On a fallback source each claim must have such a record with the same URL and quote; a claim without one (new, or
// quote/source changed) is HELD: it blocks until the source is reachable again. A matched claim used on a page or tool
// it was not used on at that match is reported as a NEW USE warning (the quote matched, but the new sentence was never
// read against the page) so it can be reviewed or held back by hand.
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";

export function loadClaimMatches(path) {
  const s = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { schema_version: 1, claims: {} };
  if (!s.claims) s.claims = {};
  return s;
}
export function saveClaimMatches(path, store) {
  const tmp = `${path}.tmp-${process.pid}`;
  const sorted = Object.fromEntries(Object.keys(store.claims).sort().map((k) => [k, store.claims[k]]));
  writeFileSync(tmp, JSON.stringify({ schema_version: 1, note: store.note || "Per-claim last live quote match (ISO 8601 UTC): exact quote and pages using it at that match.", claims: sorted }, null, 2) + "\n");
  renameSync(tmp, path);
}
// Record matches for claims whose quotes were just found on their live source (called only after the whole source passed).
export function recordClaimMatches(path, store, claims, at = new Date()) {
  for (const c of claims) store.claims[c.claim_id] = { source_url: c.source_url, quote: c.quote_excerpt, matchedAt: at.toISOString(), used_on: [...(c.used_on || [])].sort() };
  saveClaimMatches(path, store);
}
// For a source accepted on fallback: which of its claims are covered by a real earlier match, and which are held.
export function checkFallbackClaims(claims, store) {
  const ok = [], held = [], newUses = [];
  for (const c of claims) {
    const r = store.claims[c.claim_id];
    if (!r) { held.push({ claim_id: c.claim_id, reason: "never matched against this source (new claim added while the source is unreachable)" }); continue; }
    if (r.source_url !== c.source_url) { held.push({ claim_id: c.claim_id, reason: `last match was against a different source (${r.source_url})` }); continue; }
    if (r.quote !== c.quote_excerpt) { held.push({ claim_id: c.claim_id, reason: "quote changed since its last match" }); continue; }
    const before = new Set(r.used_on || []);
    const added = (c.used_on || []).filter((u) => !before.has(u));
    if (added.length) newUses.push({ claim_id: c.claim_id, added, matchedAt: r.matchedAt, reason: `new use(s) since its last match (${r.matchedAt}): ${added.join(", ")}` });
    ok.push(c.claim_id);
  }
  return { ok, held, newUses };
}
