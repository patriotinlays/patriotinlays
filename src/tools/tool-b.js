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
// Plain names for each fact, shown in menus, gaps and reports.
export const FACT_LABELS = Object.freeze({ birth: "Birth", death: "Death", marriage: "Marriage",
  parentage: "Parent–child link (ties this person to the next generation)", residence: "Where they lived" });
const factName = (f) => (f === "parentage" ? "parent–child link" : f === "residence" ? "where-they-lived" : f);

// Generation names. DAR numbers the applicant as generation 1, parents 2, grandparents 3, great-grandparents 4.
export const GEN_CLAIMS = { claimApplicant: "dar-gen1-applicant", claimNumbering: "dar-gen-numbering" };
export function genLabel(gen) {
  if (gen === 1) return "You";
  if (gen === 2) return "Your parent";
  if (gen === 3) return "Your grandparent";
  if (gen === 4) return "Your great-grandparent";
  return `Your ${gen - 3}x great-grandparent`;
}
export const genTitle = (gen) => `Generation ${gen}: ${genLabel(gen)}`;

// Plain explanation of the "states it directly / only hints at it" choice.
export const MODE_HELP = Object.freeze({
  direct: "Says it in words. Example: a long-form birth certificate that names the parents.",
  indirect: "Only hints at it. Example: a child living in the household on an 1850–1870 census, which does not state relationships.",
  claim: "nscda-census-1850-1870",
});

// A cell nobody has filled in yet (used to stop "Add a record" from stacking blank rows).
export function isEmptyCell(c = {}) {
  return !c.fact && !c.docType && !c.mode && !c.conflict && !(c.citation || "").trim();
}

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
  if (!cell.docType) issues.push("Still needed: pick what kind of record this is.");
  else if (!DOC_TYPES[cell.docType]) issues.push(`Still needed: pick a record type from the list ("${cell.docType}" isn't one).`);
  if (!FACTS.includes(cell.fact)) issues.push("Still needed: pick what this record shows (birth, death, marriage, parent–child link or where they lived).");
  if (!["direct", "indirect"].includes(cell.mode)) issues.push("Still needed: pick whether the record says it in words or only hints at it.");
  if (!cell.citation || cell.citation.trim().length < 8) issues.push("Still needed: say where you found the record, in a few words (for example: county courthouse, will book 3, page 12).");
  for (const c of CAUTIONS) if (c.doc === cell.docType && c.facts.includes(cell.fact)) cautions.push({ text: c.text, claim: c.claim });
  if (cell.mode === "direct" && cautions.some((c) => c.claim === "nscda-census-1850-1870"))
    cautions.push({ text: "You picked \"says it in words\", but the published standard above says this record type does not state relationships.", claim: "nscda-census-1850-1870" });
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

// "Where to look" for each missing fact. Only Source Manifest URLs (tested) and site guides; claims checked by check-manifest.
// Generations 1-3 ("recent") vs 4+ ("older") follows DAR's split in rowRequirements(). No database fits recent records,
// so those entries point to DAR's list of record types and say to ask the registrar.
export const WHERE_SOURCES = Object.freeze({
  darFaq: { label: "DAR: the most common record types for proving a line", url: "https://membership.dar.org/NSDAR/AppFormz/FAQs.aspx" },
  darSteps: { label: "DAR application help: using baptisms, wills and censuses to date births and deaths", url: "https://membership.dar.org/NSDAR/AppFormz/App_Help_Step_By_Step_1.aspx" },
  naraRev: { label: "National Archives: Revolutionary War pension and bounty-land files (free on FamilySearch with login)", url: "https://www.archives.gov/research/military/american-revolution" },
  naraOrder: { label: "National Archives: ordering pension and bounty-land files", url: "https://www.archives.gov/research/military/genealogy" },
  naraCensus: { label: "National Archives: clues in the 1790–1840 censuses", url: "https://www.archives.gov/research/census/1790-1840.html" },
});
export const GUIDES = Object.freeze({
  substitute: { label: "No Birth Certificate? Substitute Evidence", url: "/guides/substitute-evidence/" },
  pension: { label: "How to Read a Revolutionary War Pension File", url: "/guides/read-pension-file/" },
  census: { label: "From the 1850 Census Back to 1776", url: "/guides/census-bridge/" },
  sameName: { label: "Same Name, Different Man", url: "/guides/same-name/" },
  byState: { label: "Revolutionary War Records by State", url: "/guides/records-by-state/" },
  roadmap: { label: "The Patriot Lineage Proof Roadmap", url: "/guides/lineage-proof-roadmap/" },
});
export const REGISTRAR = "Not sure where to order it? Ask your society's registrar.";
export const WHERE_TO_LOOK = Object.freeze({
  birth: {
    recent: { text: "Look for a long-form birth certificate (the kind that names the parents). No certificate? A baptism or christening record can stand in for the birth date.", claims: ["nscda-short-form", "dar-baptism"], links: ["darFaq"], guides: ["substitute"] },
    older: { text: "Look for a church baptism record. An age given in a census or at death can be used to estimate a birth year.", claims: ["dar-baptism", "dar-circa", "nscda-church"], links: ["darSteps", "naraRev", "naraCensus"], guides: ["substitute", "pension"] },
  },
  death: {
    recent: { text: "Look for a death certificate.", claims: ["dar-lineage-sources"], links: ["darFaq"], guides: ["substitute"] },
    older: { text: "Look for a will or probate record, or a church burial record. A will date, or a last appearance on a census or deed, can be used to estimate a death date.", claims: ["nscda-county", "nscda-church", "dar-death-post", "dar-death-ante"], links: ["darSteps", "naraCensus"], guides: ["substitute"] },
  },
  marriage: {
    recent: { text: "Look for a marriage record. A marriage license alone does not prove the marriage took place.", claims: ["dar-lineage-sources", "nscda-license"], links: ["darFaq"], guides: ["substitute"] },
    older: { text: "Look for a church marriage record. If the husband was a Revolutionary War veteran, check his pension file: a widow's pension can be in the same file.", claims: ["nscda-church", "nps-applegate-widow"], links: ["naraRev", "naraOrder"], guides: ["pension"] },
  },
  parentage: {
    recent: { text: "Look for a long-form birth certificate that names the parents; short forms without the parents' names don't count. The 1880–1900 censuses are also listed as a source.", claims: ["nscda-short-form", "nscda-census-1880"], links: ["darFaq"], guides: ["substitute", "census"] },
    older: { text: "Look for wills, probate records and deeds that name children. The 1850–1870 censuses don't state relationships and the 1790–1840 censuses name only the head of household, so treat them as clues.", claims: ["nscda-county", "nscda-census-1850-1870", "nara-census-head"], links: ["naraCensus", "naraRev"], guides: ["census", "sameName"] },
  },
  residence: {
    recent: { text: "Census records, deeds and tax lists place a person in a county.", claims: ["dar-lineage-sources", "nscda-county"], links: ["darFaq"], guides: ["census"] },
    older: { text: "Look at census records, deeds and tax lists for the place, and go through all the records that survive there.", claims: ["nscda-county", "nara-census-exhaust"], links: ["naraCensus"], guides: ["census", "byState"] },
  },
});
export const START_HERE = Object.freeze({ text: "Start with yourself as generation 1, then add your parent, grandparent and so on back to the patriot.", claims: ["dar-gen1-applicant", "dar-gen-numbering"], links: [], guides: ["roadmap"] });
// Resolve a fact + generation to a ready-to-render "Where to look" entry.
export function whereToLook(fact, gen) {
  const byEra = WHERE_TO_LOOK[fact]; if (!byEra) return null;
  const w = byEra[gen != null && gen <= 3 ? "recent" : "older"];
  return { text: w.text, claims: w.claims, links: w.links.map((k) => WHERE_SOURCES[k]), guides: w.guides.map((k) => GUIDES[k]), registrar: REGISTRAR };
}
const startHere = () => ({ text: START_HERE.text, claims: START_HERE.claims, links: [], guides: START_HERE.guides.map((k) => GUIDES[k]), registrar: REGISTRAR });

// row = { gen, living, cells: [cell,...] }  — returns prioritized gap list. Never declares a generation proven.
// Every gap carries a "where" entry (Where to look).
export function gaps(rows = []) {
  const out = [];
  if (rows.length < 2) out.push({ gen: null, priority: 1, text: "Add at least two generations (you and your parent) to see what's missing.", where: startHere() });
  for (const r of rows) {
    const who = `Generation ${r.gen} (${genLabel(r.gen).toLowerCase()})`;
    const req = rowRequirements(r.gen, r);
    const has = (f) => (r.cells || []).some((c) => c.fact === f && evaluateCell(c).label !== LABELS.none);
    for (const f of req.need) if (!has(f)) out.push({ gen: r.gen, fact: f, priority: 1, text: `${who}: no ${f} evidence entered yet.`, claim: req.claim, where: whereToLook(f, r.gen) });
    if (req.anyOf && !req.anyOf.some(has)) out.push({ gen: r.gen, fact: "birth", priority: 1, text: `${who}: add at least one birth or death record.`, claim: req.claim, where: whereToLook("birth", r.gen) });
    if (req.link && !has("parentage")) out.push({ gen: r.gen, fact: "parentage", priority: 1, text: `${who}: no record yet that links this person to the next generation in your line.`, claim: "dar-each-relationship", where: whereToLook("parentage", r.gen) });
    for (const c of r.cells || []) { const ev = evaluateCell(c); const fl = c.fact ? factName(c.fact) : "record";
      const where = c.fact ? whereToLook(c.fact, r.gen) : { text: "", claims: [], links: [], guides: [], registrar: REGISTRAR };
      if (ev.label === LABELS.conflict) out.push({ gen: r.gen, fact: c.fact, priority: 0, text: `${who}: you flagged a conflict on the ${fl} record. Sort it out before relying on it.`, where });
      else if (ev.label === LABELS.incomplete) out.push({ gen: r.gen, fact: c.fact, priority: 2, text: `${who}: the ${fl} record isn't finished. ${ev.issues.join(" ")}`, where });
      else if (ev.cautions.length) out.push({ gen: r.gen, fact: c.fact, priority: 2, text: `${who}: ${fl} record. ${ev.cautions[0].text}`, claim: ev.cautions[0].claim, where }); }
  }
  return out.sort((a, b) => a.priority - b.priority);
}

// Storage is handled by tool-b-ui.js (key "pi.toolB.v1", localStorage only).
export const STORAGE_KEY = "pi.toolB.v1";
