// Tool B — Lineage Evidence Matrix (organizer, not a grader)
// Design rules (auditor refinement #1):
//  * No cell is graded by document category alone.
//  * Each cell is evaluated on Document Type + Fact Claimed + Direct/Indirect toggle + Conflict flag.
//  * Highest status the tool can ever show: "Evidence Entered — Review Required". It never says "Documented".
//  * State lives only in localStorage on the user's device; this file makes no network calls.

import { CONTACT_STEP, APPLY_STEP, linksFor } from "./next-steps.js";
import { vitalNote, censusNote } from "./places.js";
import { hasPatriot, patriotSteps } from "./patriot.js";

export const LABELS = Object.freeze({
  none: "No Evidence Entered",
  entered: "Evidence Entered — Review Required",
  conflict: "Conflict Flagged — Review Required",
  incomplete: "Needs details",
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
  return `Your ${ordinal(gen - 3)}-great-grandparent`;
}
// 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th" (plain relationship names instead of "2x great").
export const ordinal = (n) => { const t = n % 100; return `${n}${t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`; };
// Plain relationship for the patriot picker: generation 2 = "my father", 5 = "my 2nd-great-grandfather".
export function relationName(gen, who = "father") {
  if (gen <= 1) return "me";
  const base = who === "mother" ? "mother" : "father";
  if (gen === 2) return `my ${base}`;
  if (gen === 3) return `my grand${base}`;
  if (gen === 4) return `my great-grand${base}`;
  return `my ${ordinal(gen - 3)}-great-grand${base}`;
}
// "What do you have?" checklist: each item pre-creates a record with what it shows and its kind already picked.
export const HAVE_ITEMS = Object.freeze([
  { id: "birth_cert", label: "Birth certificate", fact: "birth", docType: "birth_cert_long" },
  { id: "death_cert", label: "Death certificate", fact: "death", docType: "death_cert" },
  { id: "marriage", label: "Marriage record", fact: "marriage", docType: "marriage_record" },
  { id: "will", label: "Will or probate record", fact: "parentage", docType: "probate" },
  { id: "census", label: "Census entry", fact: "parentage", docType: "census" },
  { id: "bible", label: "Family Bible record", fact: "birth", docType: "bible" },
  { id: "church", label: "Church or baptism record", fact: "birth", docType: "church" },
  { id: "pension", label: "Pension file", fact: "", docType: "pension" },
  { id: "land", label: "Deed or land record", fact: "residence", docType: "land" },
  { id: "genealogy", label: "Compiled family history", fact: "parentage", docType: "family_genealogy" },
]);
export const genTitle = (gen) => `Generation ${gen}: ${genLabel(gen)}`;

// Plain explanation of the "states it directly / only hints at it" choice.
export const MODE_HELP = Object.freeze({
  direct: "Says it in words. Example: a long-form birth certificate that names the parents.",
  indirect: "Only hints at it. Example: a child living in the household on an 1850–1870 census, which does not state relationships.",
  claim: "nscda-census-1850-1870",
});

// "Skip for now" (Tim t119u #3): each of a record's four questions (A to D) can be skipped. A skipped or blank answer is
// never an error: the record reads "Needs details" and the gap report lists the answer as "Still needed".
export const SKIP_TEXT = "Skip for now";
export const SKIPPABLE = Object.freeze(["fact", "docType", "mode", "citation"]);
export const STILL_NEEDED = "Still needed";
export const isSkipped = (c = {}, k) => Array.isArray(c.skipped) && c.skipped.includes(k);
// Mark (or unmark) a question as skipped. Skipping clears that answer; giving an answer clears the skip.
export function setSkip(c, k, on) {
  const s = new Set(Array.isArray(c.skipped) ? c.skipped : []);
  if (on) { s.add(k); c[k] = ""; } else s.delete(k);
  c.skipped = SKIPPABLE.filter((x) => s.has(x));
  return c;
}

// A cell nobody has filled in yet (used to stop "Add a record" from stacking blank rows). A record with a skipped
// question is not blank: the visitor has started it, so it shows in the gap report with "Still needed".
export function isEmptyCell(c = {}) {
  return !c.fact && !c.docType && !c.mode && !c.conflict && !(c.citation || "").trim() && !(Array.isArray(c.skipped) && c.skipped.length);
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
  census: "Census entry (year range not picked yet)",
};

// cell = { docType, fact, mode: "direct"|"indirect"|"", conflict: bool, citation: string }
export function evaluateCell(cell = {}) {
  const issues = [], cautions = [];
  // Only a fully blank record is "No Evidence Entered" (and blank records are never counted). Anything typed or ticked is an
  // entry, so its status is "Needs details" until A to D are answered (audit 3: a ticked census showed "No Evidence Entered").
  if (isEmptyCell(cell)) return { label: LABELS.none, issues, cautions, needs: [] };
  const needs = [];
  const sk = (k) => (isSkipped(cell, k) ? " (skipped for now)" : "");
  if (!cell.docType) { issues.push("Still needed" + sk("docType") + ": pick what kind of record this is."); needs.push("its kind"); }
  else if (cell.docType === "census") { issues.push("Still needed: pick which census it is (the year range)."); needs.push("which census"); }
  else if (!DOC_TYPES[cell.docType]) { issues.push(`Still needed: pick a record type from the list ("${cell.docType}" isn't one).`); needs.push("its kind"); }
  if (!FACTS.includes(cell.fact)) { issues.push("Still needed" + sk("fact") + ": pick what this record shows (birth, death, marriage, parent–child link or where they lived)."); needs.push("what it shows"); }
  if (!["direct", "indirect"].includes(cell.mode)) { issues.push("Still needed" + sk("mode") + ": pick whether the record says it in words or only hints at it."); needs.push("words or hints"); }
  if (!cell.citation || cell.citation.trim().length < 8) { issues.push("Still needed" + sk("citation") + ": say where you found the record, in a few words (for example: county courthouse, will book 3, page 12)."); needs.push("where you found it"); }
  for (const c of CAUTIONS) if (c.doc === cell.docType && c.facts.includes(cell.fact)) cautions.push({ text: c.text, claim: c.claim });
  if (cell.mode === "direct" && cautions.some((c) => c.claim === "nscda-census-1850-1870"))
    cautions.push({ text: "You picked \"says it in words\", but the published standard above says this record type does not state relationships.", claim: "nscda-census-1850-1870" });
  if (cell.mode === "indirect") cautions.push({ text: "Indirect evidence usually needs other records that agree with it.", claim: null });
  let label = issues.length ? LABELS.incomplete : LABELS.entered;
  if (cell.conflict) label = LABELS.conflict;
  return { label, issues, cautions, needs };
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
// Plain term for NSCDA, shown wherever advice cites its Standards of Proof (audit 4: the report used it unexplained).
export const NSCDA_TERM = Object.freeze({ text: "NSCDA is The National Society of the Colonial Dames of America; notes marked NSCDA cite its Standards of Proof.", claims: ["nscda-name-national", "nscda-census-1850-1870"] });
export const START_HERE = Object.freeze({ text: "Start with yourself as generation 1, then add your parent, grandparent and so on back to the patriot.", claims: ["dar-gen1-applicant", "dar-gen-numbering"], links: [], guides: ["roadmap"] });
// A rough year typed by the visitor ("1820", " 1820 ") -> 1820, else null.
export const yr = (v) => { const m = /^\s*(\d{4})\s*$/.exec(v == null ? "" : String(v)); return m ? +m[1] : null; };
// Resolve a fact + generation (+ the person's rough years and state) to a ready-to-render "Where to look" entry.
// Era: DAR's split (generations 1-3 "recent", 4+ "older") unless the state's own source says whether that state
// recorded this event in that year. Notes carry the state and census facts; each lists its claims.
export const SUBSTITUTE_GUIDE = Object.freeze({ label: "How to prove a birth without a birth certificate (our guide)", url: "/guides/substitute-evidence/" });
export function whereToLook(fact, gen, ctx = {}) {
  const byEra = WHERE_TO_LOOK[fact]; if (!byEra) return null;
  const born = yr(ctx.born), died = yr(ctx.died);
  let era = gen != null && gen <= 3 ? "recent" : "older";
  const notes = [];
  if (["birth", "death", "marriage"].includes(fact)) {
    const v = vitalNote(ctx.state, fact, { year: fact === "birth" ? born : fact === "death" ? died : null, lower: fact === "birth" ? null : born });
    if (v) { if (v.era === "state") era = "recent"; else if (v.era === "none") era = "older";
      // Where the state kept no birth records then, point straight to the guide on proving a birth without one.
      notes.push({ text: v.text, claims: v.claims, links: v.links, kind: v.noSource ? "nosource" : "state", ...(v.noSource ? { place: v.place, fact, key: `ns|${v.place}` } : {}), guide: fact === "birth" && v.noRecord ? SUBSTITUTE_GUIDE : null }); }
    else notes.push({ text: "Add the state where this person lived to see what that state's own records office says.", claims: [], links: [], kind: "hint" });
  }
  if (["birth", "parentage", "residence"].includes(fact)) {
    const c = censusNote(born, died, { patriot: !!ctx.patriot });
    if (c) notes.push({ ...c, kind: "census" });
    else if (born == null) notes.push({ text: "Add a rough birth year to see which censuses fit this person's lifetime.", claims: [], links: [], kind: "hint" });
  }
  const w = byEra[era];
  const links = [...w.links.map((k) => WHERE_SOURCES[k]), ...notes.flatMap((n) => n.links)].filter((l, i, a) => a.findIndex((m) => m.url === l.url) === i);
  return { text: w.text, era, notes, claims: [...new Set([...w.claims, ...notes.flatMap((n) => n.claims)])], links, guides: w.guides.map((k) => GUIDES[k]), registrar: REGISTRAR };
}
// "No birth certificate? Try these substitutes, in order" (audit 4 proposal, approved): shown at each generation that has no
// birth record yet. The order is this site's suggestion (records that give a date first, then estimates, then supporting
// papers); every step's facts come from the Source Manifest. The pension-file step is offered only to older generations.
export const BIRTH_SUBSTITUTES = Object.freeze({
  title: "No birth certificate? Try these substitutes, in order",
  intro: "Our suggested order: records that give a date first, then records you can work out a year from, then papers that back them up.",
  steps: Object.freeze([
    { id: "baptism", text: "A church baptism or christening record. DAR lets you use an infant baptism or christening date when you can't document the birth date.", claims: ["dar-baptism", "nscda-church"] },
    { id: "bible", text: "A family Bible page with the births written in. Copy the Bible's title page with its publication date too: NSCDA asks for it with Bible entries.", claims: ["m804-bible-pages", "nscda-bible-title"] },
    { id: "pension", older: true, text: "If this person was a Revolutionary War veteran, his wife or widow, or their child: his pension or bounty-land file. Some files hold family Bible pages with birth dates, and a widow's application may give her age.", claims: ["m804-bible-pages", "m804-widow-info"] },
    { id: "age", text: "An age on a census or at death, to work out the birth year. DAR marks a birth year estimated this way as \"circa\" (about).", claims: ["dar-circa"] },
    { id: "affidavit", text: "A sworn statement (affidavit) from someone with personal knowledge of the birth. NSCDA lists these among substitute sources.", claims: ["nscda-affidavits"] },
  ]),
  combine: { text: "Use two or more together: NSCDA advises that a proof shouldn't rest on one substitute document.", claims: ["nscda-combine"] },
  links: ["darSteps"], guide: "substitute",
});
export const hasBirthRecord = (row = {}) => filledCells(row.cells || []).some((c) => c.fact === "birth");
// The panel for one generation, or null when it already has a birth record. Older = generation 4+ (DAR's split, as in rowRequirements).
export function birthSubstitutes(row = {}) {
  if (hasBirthRecord(row)) return null;
  const older = (row.gen ?? 1) >= 4;
  const steps = BIRTH_SUBSTITUTES.steps.filter((x) => !x.older || older);
  return { title: BIRTH_SUBSTITUTES.title, intro: BIRTH_SUBSTITUTES.intro, steps, combine: BIRTH_SUBSTITUTES.combine,
    claims: [...new Set([...steps.flatMap((x) => x.claims), ...BIRTH_SUBSTITUTES.combine.claims])],
    links: BIRTH_SUBSTITUTES.links.map((k) => WHERE_SOURCES[k]), guide: GUIDES[BIRTH_SUBSTITUTES.guide] };
}
// Inline "Don't know his name yet?" checklist on the worksheet's start screen (audit 4 proposal). Plain to-dos, no facts claimed;
// the Roadmap's Step 0 has the sourced detail.
export const NAME_CHECKLIST = Object.freeze([
  { id: "known", text: "Write down the people you do know: your parents, grandparents and great-grandparents, with rough birth years and states. The worksheet starts with them; you don't need your patriot's name." },
  { id: "ask", text: "Ask older relatives for family Bibles, obituaries, old letters, and the papers of anyone in the family who joined DAR, SAR or another lineage society." },
  { id: "search", text: "Search DAR's free ancestor database (the Genealogical Research System) with your family surnames and states. Step 0 of our Roadmap guide shows how.", claims: ["dar-join-grs"] },
  { id: "add", text: "Found a likely name? Add your patriot in the patriot step. Not yet? Start anyway and add your patriot later." },
]);
const whereFor = (...a) => whereToLook(...a);
const startHere = () => ({ text: START_HERE.text, claims: START_HERE.claims, links: [], guides: START_HERE.guides.map((k) => GUIDES[k]), registrar: REGISTRAR });

// row = { gen, living, cells: [cell,...] }  — returns prioritized gap list. Never declares a generation proven.
// Every gap carries a "where" entry (Where to look).
export function gaps(rows = [], patriot = null) {
  const out = []; const pg = patriotGen(rows, patriot);
  if (rows.length < 2) out.push({ gen: null, priority: 1, text: "Add at least two generations (you and your parent) to see what's missing.", where: startHere() });
  for (const r of rows) {
    const who = `Generation ${r.gen} (${genLabel(r.gen).toLowerCase()})`;
    const req = rowRequirements(r.gen, r);
    const ctx = { born: r.born, died: r.died, state: r.state || (r.gen === pg ? patriot?.state : "") || "", patriot: r.gen === pg };
    const whereToLook = (f, gen) => whereFor(f, gen, ctx);
    const has = (f) => filledCells(r.cells).some((c) => c.fact === f && evaluateCell(c).label !== LABELS.none);
    for (const f of req.need) if (!has(f)) out.push({ gen: r.gen, fact: f, priority: 1, add: f, text: `${who}: no ${f} evidence entered yet.`, claim: req.claim, where: whereToLook(f, r.gen) });
    if (req.anyOf && !req.anyOf.some(has)) out.push({ gen: r.gen, fact: "birth", priority: 1, add: "birth", text: `${who}: add at least one birth or death record.`, claim: req.claim, where: whereToLook("birth", r.gen) });
    if (req.link && !has("parentage")) out.push({ gen: r.gen, fact: "parentage", priority: 1, add: "parentage", text: `${who}: no record yet that links this person to the next generation in your line.`, claim: "dar-each-relationship", where: whereToLook("parentage", r.gen) });
    for (const c of filledCells(r.cells)) { const ev = evaluateCell(c); const fl = c.fact ? factName(c.fact) : "";
      const where = c.fact ? whereToLook(c.fact, r.gen) : { text: "", notes: [], claims: [], links: [], guides: [], registrar: REGISTRAR };
      if (ev.label === LABELS.conflict) out.push({ gen: r.gen, fact: c.fact, priority: 0, text: `${who}: you flagged a conflict on the ${fl ? fl + " " : ""}record. Sort it out before relying on it.`, where });
      else if (ev.label === LABELS.incomplete) out.push({ gen: r.gen, fact: c.fact, priority: 2, text: `${who}: the ${fl ? fl + " " : ""}record isn't finished. ${ev.issues.join(" ")}`,
        brief: `The ${fl ? fl + " " : ""}record isn't finished. Still needed: ${ev.needs.join(", ")}.`, where });
      else if (ev.cautions.length) out.push({ gen: r.gen, fact: c.fact, priority: 2, text: `${who}: ${fl ? fl + " " : ""}record. ${ev.cautions[0].text}`, claim: ev.cautions[0].claim, where }); }
  }
  // Each item also gets a "short" text without the "Generation N (...)" prefix, for grouped display.
  for (const g of out) g.short = g.gen == null ? g.text : g.text.replace(/^Generation \d+ \([^)]*\): /, "").replace(/^./, (c) => c.toUpperCase());
  // One pass per generation, oldest-last, in order. Within a generation the person's own records come first (birth, death,
  // marriage, where they lived), then the link to the next generation (audit 3); for the same record: conflicts, then missing, then fixes.
  const key = (g) => (g.gen == null ? 0 : g.gen);
  return out.map((g, i) => [g, i]).sort((a, b) => key(a[0]) - key(b[0]) || factRank(a[0].fact) - factRank(b[0].fact) || a[0].priority - b[0].priority || a[1] - b[1]).map(([g]) => g);
}

// Group a gap list so each generation appears once, in order. pg = the patriot's generation (labelled), if known.
export function groupGaps(list, pg = null) {
  const groups = [];
  for (const g of list) { let grp = groups.at(-1); if (!grp || grp.gen !== g.gen) { grp = { gen: g.gen, title: g.gen == null ? "Getting started" : genTitle(g.gen) + (g.gen === pg ? " (the patriot)" : ""), items: [] }; groups.push(grp); } grp.items.push(g); }
  return groups;
}
// Which generation is the patriot: the one picked in the patriot step, else the oldest generation. Null if no patriot entered.
export function patriotGen(rows = [], patriot = null) {
  if (!hasPatriot(patriot)) return null;
  // Generation 1 is the applicant, never the patriot: an unset, missing or "1" choice means the oldest generation.
  const g = +patriot.gen; const oldest = rows.at(-1)?.gen ?? null;
  if (g > 1 && rows.some((r) => r.gen === g)) return g;
  return oldest > 1 ? oldest : null;
}

// Records that actually have something in them (blank rows are never labelled or counted).
export const filledCells = (cells = []) => cells.filter((c) => !isEmptyCell(c));
// Report order inside a generation: the person's own records (birth, death, marriage, where they lived), then link records.
export const FACT_ORDER = ["birth", "death", "marriage", "residence", "parentage"];
export function factRank(f) { const i = FACT_ORDER.indexOf(f); return i < 0 ? FACT_ORDER.length : i; }
export const byFactOrder = (cells = []) => cells.map((c, i) => [c, i]).sort((a, b) => factRank(a[0].fact) - factRank(b[0].fact) || a[1] - b[1]).map(([c]) => c);
export const countEntries = (generations = []) => generations.reduce((a, g) => a + filledCells(g.cells).length, 0);

// Date sanity (audit 4): years that can't be right, or are very unlikely, get a plain warning, and the patriot's
// date check never says his dates fit while his birth year and service don't add up. Rough years only ("about 1820").
// kind: "impossible" (can't be right as typed) or "unlikely" (possible but worth a second look). No sourced rule is
// claimed: these are arithmetic checks on what was typed, worded as "check this", never as a ruling.
const svcYears = (p) => { const s = /^[~<>]?(\d{4})/.exec(p?.start || ""), e = /^[~<>]?(\d{4})/.exec(p?.end || p?.start || ""); return { s: s ? +s[1] : null, e: e ? +e[1] : null }; };
export const AGE = Object.freeze({ youngService: 10, youngParent: 13, oldParent: 70, oldAge: 110 });
export function dateWarnings(rows = [], patriot = null) {
  const out = []; const pg = patriotGen(rows, patriot); const by = new Map(rows.map((r) => [r.gen, r]));
  const who = (g) => `Generation ${g} (${genLabel(g).toLowerCase()})`;
  for (const r of rows) {
    const b = yr(r.born), d = r.living ? null : yr(r.died);
    if (b != null && d != null && d < b) out.push({ gen: r.gen, kind: "impossible", text: `${who(r.gen)}: the death year (about ${d}) is before the birth year (about ${b}). Check both years.` });
    else if (b != null && d != null && d - b > AGE.oldAge) out.push({ gen: r.gen, kind: "unlikely", text: `${who(r.gen)}: born about ${b} and died about ${d} would make them about ${d - b} at death. That's very unlikely. Check both years.` });
    if (b != null && r.living && new Date().getFullYear() - b > AGE.oldAge) out.push({ gen: r.gen, kind: "unlikely", text: `${who(r.gen)} is marked as still living but born about ${b}, which would make them over ${AGE.oldAge}. Check the birth year, or untick "Still living".` });
    const parent = by.get(r.gen + 1); const pb = parent ? yr(parent.born) : null, pd = parent && !parent.living ? yr(parent.died) : null;
    if (b != null && pb != null) {
      const gap = b - pb;
      if (gap <= 0) out.push({ gen: r.gen, kind: "impossible", text: `${who(r.gen)} is listed as born about ${b}, ${gap === 0 ? "the same year as" : "before"} their parent in generation ${r.gen + 1} (born about ${pb}). A child can't be born ${gap === 0 ? "the same year as" : "before"} the parent. Check the years, and that each person is in the right generation.` });
      else if (gap < AGE.youngParent) out.push({ gen: r.gen, kind: "unlikely", text: `${who(r.gen)} (born about ${b}): their parent in generation ${r.gen + 1} (born about ${pb}) would have been only about ${gap}. That's very unlikely. Check the years, and that no generation is missing in between.` });
      else if (gap > AGE.oldParent) out.push({ gen: r.gen, kind: "unlikely", text: `${who(r.gen)} (born about ${b}): their parent in generation ${r.gen + 1} (born about ${pb}) would have been about ${gap}. That's unusually old. Check the years, and whether a generation is missing in between.` });
    }
    if (b != null && pd != null && pd < b - 1) out.push({ gen: r.gen, kind: "impossible", text: `${who(r.gen)} (born about ${b}): their parent in generation ${r.gen + 1} is listed as dying about ${pd}, more than a year before this birth. Check the years.` });
  }
  const pr = pg != null ? by.get(pg) : null; const { s, e } = svcYears(patriot);
  if (pr && s != null) {
    const b = yr(pr.born), d = pr.living ? null : yr(pr.died);
    if (b != null && b > (e ?? s)) out.push({ gen: pg, kind: "impossible", patriot: true, text: `The patriot (generation ${pg}) is listed as born about ${b}, after the patriot's service (${s}${e && e !== s ? ` to ${e}` : ""}): your patriot wasn't born yet. Check the patriot's birth year, the service dates, and that the right generation is marked as the patriot.` });
    else if (b != null && b > s) out.push({ gen: pg, kind: "impossible", patriot: true, text: `The patriot (generation ${pg}) is listed as born about ${b}, after the patriot's service began (${s}). Check the patriot's birth year and service dates.` });
    else if (b != null && s - b < AGE.youngService) out.push({ gen: pg, kind: "unlikely", patriot: true, text: `The patriot (generation ${pg}, born about ${b}) would have been only about ${s - b} when the patriot's service began in ${s}. That's very unlikely. Check the patriot's birth year and service dates.` });
    if (d != null && d < s) out.push({ gen: pg, kind: "impossible", patriot: true, text: `The patriot (generation ${pg}) is listed as dying about ${d}, before the patriot's service began (${s}). Check the patriot's death year and service dates.` });
    else if (d != null && e != null && d < e) out.push({ gen: pg, kind: "unlikely", patriot: true, text: `The patriot (generation ${pg}) is listed as dying about ${d}, before the patriot's service ended (${e}). That can happen if your patriot died in service; otherwise check the patriot's death year and service dates.` });
  }
  return out;
}

// "What to do next": a numbered action plan built from the visitor's own gaps.
export function actionPlan(rows = [], patriot = null) {
  const g = gaps(rows, patriot); const steps = []; const pg = patriotGen(rows, patriot);
  const real = g.filter((x) => x.gen != null);
  const warn = dateWarnings(rows, patriot);
  if (warn.length) steps.push({ title: "Check these dates first", text: warn.some((w) => w.kind === "impossible") ? "Some of the years you typed don't add up. Fix them before relying on the rest of this plan." : "Some of the years you typed are unusual. They may be right, but give them a second look.", claims: [], links: [], warn: true, items: warn.map((w) => ({ text: w.text })) });
  if (rows.length < 2) steps.push({ title: "Fill in the worksheet", text: "Start with yourself as generation 1, then add your parent, grandparent and so on back to the patriot.", claims: ["dar-gen1-applicant", "dar-gen-numbering"], links: linksFor("roadmap") });
  steps.push(...patriotSteps(patriot));
  if (real.length) steps.push({ title: "Records to find or fix, generation by generation", text: "Each item says where to look. Sort out any records you flagged as disagreeing before relying on them.", claims: ["dar-each-relationship"], links: [],
    items: groupGaps(real, pg).map((grp) => ({ text: grp.title, sub: grp.items.map((x) => ({ text: x.short, brief: x.brief || null, add: x.add || null, gen: x.gen, where: x.where, conflict: x.priority === 0, who: grp.gen ? `Gen ${grp.gen}` : "", fact: x.fact, anyOf: /birth or death/.test(x.short || "") })) })) });
  else if (rows.length >= 2) steps.push({ title: "Records", text: "Nothing is missing by this tool's rules. A society's genealogists still review every record.", claims: ["dar-review-staff"], links: [] });
  steps.push(CONTACT_STEP, APPLY_STEP);
  return steps;
}

// Storage is handled by tool-b-ui.js (key "pi.toolB.v1", localStorage only).
export const STORAGE_KEY = "pi.toolB.v1";
