// t127u standing rule (Tim, Nov 9, 2026): every source carries a scope tag (national / state / chapter-local /
// third-party; set in manifest/src/sources.py, copied to each claim as source_scope). Two rules use it:
//  1. Wording that states a society-wide rule ("DAR says", "SAR:", "NSCDA lists", "As of ..., SAR says") must be backed
//     by at least one cited claim from that society's NATIONAL source. A claim whose only sources are state,
//     chapter-local or third-party gets flagged; attribute it honestly instead ("A 2023 Ohio Society SAR presentation
//     said ...", "NSCDA's South Carolina society's standards say ...").
//  2. The "As of [date]," prefix is only for official national or state sources (never chapter-local or third-party).
export const SCOPES = Object.freeze(["national", "state", "chapter-local", "third-party"]);
export const ASOF_SCOPES = Object.freeze(["national", "state"]);
// Each society's own national websites.
const SOCIETY_HOSTS = { DAR: /(^|\.)dar\.org$/, SAR: /(^|\.)sar\.org$/, NSCDA: /(^|\.)nscda\.org$/ };
const VERBS = "says|said|say|wants|requires|asks|lists|notes|states|considers|treats|rejects|advises|cites|accepts|recommends|expects|prefers|marks|lets|leaves|names|describes|reviews|withdraws|allows|counts|uses";
// "SAR says", "SAR's guidance", "DAR:", "under NSCDA rules", "NSCDA's own example". A society name that is part of a
// longer honest attribution ("Ohio Society SAR presentation", "NSCDA's South Carolina society's standards") does not match.
const RULE = new RegExp(String.raw`(?<![A-Za-z] Society |Society )\b(DAR|SAR|NSCDA)(?:'s)?(?:\s+(?:${VERBS})\b|:|\s+(?:guidance|rules|own example|example)\b)|\bunder (DAR|SAR|NSCDA) rules\b|\b(?:[Ll]isted|[Rr]ejected|[Rr]equired|[Aa]ccepted|[Pp]referred) by (DAR|SAR|NSCDA)\b|\b(DAR|SAR|NSCDA) (?:presenters|Standards of Proof)\b`, "g");
const host = (u) => { try { return new URL(u).hostname; } catch { return ""; } };
export function societyRuleMentions(text) {
  const t = String(text).replace(/\[\[claim:[a-z0-9-]+\]\]/g, "");
  return [...new Set([...t.matchAll(RULE)].map((m) => m.slice(1).find(Boolean)))];
}
// Returns a list of flag strings (empty = fine). claimsById: Map of claim_id -> manifest entry (with source_scope).
export function scopeFlags(text, claimIds, claimsById) {
  const flags = [];
  const cs = claimIds.map((id) => claimsById.get(id)).filter(Boolean);
  for (const soc of societyRuleMentions(text)) {
    const backed = cs.some((c) => c.source_scope === "national" && SOCIETY_HOSTS[soc].test(host(c.source_url)));
    if (!backed && cs.length) flags.push(`worded as a ${soc}-wide rule, but no cited claim comes from ${soc}'s national source (cited: ${cs.map((c) => `${c.claim_id} [${c.source_scope}]`).join(", ")})`);
  }
  return flags;
}
export function asofAllowed(claim) { return ASOF_SCOPES.includes(claim?.source_scope); }
