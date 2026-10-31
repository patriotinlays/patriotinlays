// Tool B — Lineage Evidence Matrix (organizer, not a grader)
// Design rules (auditor refinement #1):
//  * No cell is graded by document category alone.
//  * Each cell is evaluated on Document Type + Fact Claimed + Direct/Indirect toggle + Conflict flag.
//  * Highest status the tool can ever show: "Evidence Entered — Review Required". It never says "Documented".
//  * State lives only in localStorage on the user's device; this file makes no network calls.

export const LABELS = Object.freeze({
  none: "No Evidence Entered",
  entered: "Evidence Entered — Review Required",
  conflict: "Conflict Flagged — Review Required",
  incomplete: "Entry Incomplete",
});

export const FACTS = ["birth", "death", "marriage", "parentage", "residence"];

// Published cautions that apply to a (document type, fact) pair. Each carries a manifest claim_id.
// These produce WARNINGS shown to the user; they never upgrade a cell and never set a final grade.
export const CAUTIONS = [
  { doc: "birth_cert_short", facts: ["parentage"], claim: "nscda-short-form",
    text: "Short-form birth certificates that omit parents' names are not acceptable (NSCDA Standards of Proof)." },
  { doc: "census_1850_1870", facts: ["parentage", "marriage"], claim: "nscda-census-1850-1870",
    text: "1850–1870 census records do not state relationships; NSCDA treats them as supporting documentation only." },
  { doc: "family_genealogy", facts: FACTS, claim: "dar-primary-preferred",
    text: "DAR prefers primary and original records over compiled family genealogies." },
];

export const DOC_TYPES = {
  birth_cert_long: "Birth certificate (long form)", birth_cert_short: "Birth certificate (short form)",
  death_cert: "Death certificate", marriage_record: "Marriage record", census_1880_plus: "Census 1880 or later",
  census_1850_1870: "Census 1850–1870", census_pre1850: "Census before 1850", bible: "Family Bible record",
  church: "Church record", probate: "Will / probate", land: "Deed / land record", pension: "Pension file",
  family_genealogy: "Compiled family genealogy", other: "Other (describe in citation)",
};

// cell = { docType, fact, mode: "direct"|"indirect"|"", conflict: bool, citation: string }
export function evaluateCell(cell = {}) {
  const issues = [], cautions = [];
  if (!cell.docType && !cell.citation) return { label: LABELS.none, issues, cautions };
  if (!cell.docType) issues.push("Choose a document type.");
  else if (!DOC_TYPES[cell.docType]) issues.push(`Unknown document type "${cell.docType}".`);
  if (!FACTS.includes(cell.fact)) issues.push("Choose which fact this document is claimed to support.");
  if (!["direct", "indirect"].includes(cell.mode)) issues.push("Mark whether the document states the fact directly or only implies it.");
  if (!cell.citation || cell.citation.trim().length < 8) issues.push("Add a citation (record, repository, page/image).");
  for (const c of CAUTIONS) if (c.doc === cell.docType && c.facts.includes(cell.fact)) cautions.push({ text: c.text, claim: c.claim });
  if (cell.mode === "direct" && cautions.some((c) => c.claim === "nscda-census-1850-1870"))
    cautions.push({ text: "You marked this as direct, but the published standard above says this record type does not state relationships.", claim: "nscda-census-1850-1870" });
  if (cell.mode === "indirect") cautions.push({ text: "Indirect evidence usually needs other records that agree with it.", claim: null });
  let label = issues.length ? LABELS.incomplete : LABELS.entered;
  if (cell.conflict) label = LABELS.conflict;
  return { label, issues, cautions };
}

// Requirements per generation (DAR application help, Step-by-Step).
// gen 1 = applicant. Generations 1–3 need complete birth and death dates/places (death unless living);
// earlier generations need at least one documented date and place (birth or death).
export function rowRequirements(gen, { living = false } = {}) {
  if (gen <= 3) return { need: living ? ["birth"] : ["birth", "death"], anyOf: null, link: gen > 1, claim: "dar-gen-1-3" };
  return { need: [], anyOf: ["birth", "death"], link: true, claim: "dar-gen-1-3" };
}

// row = { gen, living, cells: [cell,...] }  — returns prioritized gap list. Never declares a generation proven.
export function gaps(rows = []) {
  const out = [];
  if (rows.length < 2) out.push({ gen: null, priority: 1, text: "Enter at least two generations to see gaps." });
  for (const r of rows) {
    const req = rowRequirements(r.gen, r);
    const has = (f) => (r.cells || []).some((c) => c.fact === f && evaluateCell(c).label !== LABELS.none);
    for (const f of req.need) if (!has(f)) out.push({ gen: r.gen, priority: 1, text: `Generation ${r.gen}: no ${f} evidence entered.`, claim: req.claim });
    if (req.anyOf && !req.anyOf.some(has)) out.push({ gen: r.gen, priority: 1, text: `Generation ${r.gen}: enter at least one birth or death record.`, claim: req.claim });
    if (req.link && !has("parentage")) out.push({ gen: r.gen, priority: 1, text: `Generation ${r.gen}: no evidence entered linking this person to the next generation.`, claim: "dar-each-relationship" });
    for (const c of r.cells || []) { const ev = evaluateCell(c);
      if (ev.label === LABELS.conflict) out.push({ gen: r.gen, priority: 0, text: `Generation ${r.gen}: conflict flagged on ${c.fact} — resolve before relying on it.` });
      else if (ev.label === LABELS.incomplete) out.push({ gen: r.gen, priority: 2, text: `Generation ${r.gen}: incomplete ${c.fact || "cell"} entry — ${ev.issues.join(" ")}` });
      else if (ev.cautions.length) out.push({ gen: r.gen, priority: 2, text: `Generation ${r.gen}: ${c.fact} — ${ev.cautions[0].text}`, claim: ev.cautions[0].claim }); }
  }
  return out.sort((a, b) => a.priority - b.priority);
}

// Storage is handled by tool-b-ui.js (key "pi.toolB.v1", localStorage only).
export const STORAGE_KEY = "pi.toolB.v1";
