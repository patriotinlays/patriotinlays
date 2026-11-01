// Sanity tests for Tool B (not part of the 25-scenario requirement).
import { actionPlan, evaluateCell, gaps, groupGaps, countEntries, filledCells, LABELS, FACTS, genLabel, genTitle, isEmptyCell, WHERE_TO_LOOK, WHERE_SOURCES, GUIDES, whereToLook, MODE_HELP } from "../src/tools/tool-b.js";
import { readFileSync, readdirSync } from "node:fs";
const manifest = JSON.parse(readFileSync(new URL("../manifest/claims.json", import.meta.url), "utf8"));
const manifestUrls = new Set(manifest.claims.map((c) => c.source_url));
const verified = new Set(manifest.claims.filter((c) => c.verification_status === "verified").map((c) => c.claim_id));
const slugs = new Set(readdirSync(new URL("../src/content", import.meta.url)).map((f) => (readFileSync(new URL(`../src/content/${f}`, import.meta.url), "utf8").match(/^slug:\s*(.+)$/m) || [])[1]).filter(Boolean).map((s) => `/${s.trim()}/`));
const T = [];
const t = (name, cond) => T.push([name, !!cond]);
const full = { docType: "birth_cert_long", fact: "birth", mode: "direct", conflict: false, citation: "Ohio Dept of Health cert #123, image saved" };
t("complete direct cell => Evidence Entered — Review Required", evaluateCell(full).label === LABELS.entered);
t("same doc type, indirect => same label, adds caution (no grade by category)", evaluateCell({ ...full, mode: "indirect" }).label === LABELS.entered && evaluateCell({ ...full, mode: "indirect" }).cautions.length === 1);
t("conflict flag overrides", evaluateCell({ ...full, conflict: true }).label === LABELS.conflict);
t("1850-70 census + parentage + direct => warning, not upgraded", (() => { const r = evaluateCell({ ...full, docType: "census_1850_1870", fact: "parentage" }); return r.label === LABELS.entered && r.cautions.length === 2; })());
t("1850-70 census + residence => no caution (fact matters)", evaluateCell({ ...full, docType: "census_1850_1870", fact: "residence" }).cautions.length === 0);
t("missing toggle => Entry Incomplete", evaluateCell({ ...full, mode: "" }).label === LABELS.incomplete);
t("empty => No Evidence Entered", evaluateCell({}).label === LABELS.none);
t("gaps: gen 2 without death/parentage listed", gaps([{ gen: 1, cells: [full] }, { gen: 2, cells: [full] }]).some((g) => /Generation 2 \(your parent\): no death/.test(g.text)));
// ---- Plain-language rework (Oct 31, 2026) ----
t("generation names: 1 You, 2 Your parent, 3 Your grandparent, 4 Your great-grandparent, 5 Your 2x great-grandparent",
  [1, 2, 3, 4, 5].map(genLabel).join("|") === "You|Your parent|Your grandparent|Your great-grandparent|Your 2x great-grandparent" && genTitle(1) === "Generation 1: You");
t("gap text names the generation in plain words", gaps([{ gen: 1, living: true, cells: [] }, { gen: 2, cells: [] }]).some((g) => g.text.startsWith("Generation 1 (you): no birth")));
t('no jargon: "incomplete parentage entry" is gone; missing fields read "Still needed: ..."', (() => { const r = gaps([{ gen: 1, cells: [] }, { gen: 2, cells: [{ fact: "parentage", docType: "probate", mode: "", citation: "" }] }]);
  const all = JSON.stringify(r); return !/incomplete parentage entry/i.test(all) && evaluateCell({ fact: "birth", citation: "x" }).issues.every((i) => i.startsWith("Still needed:")); })());
t("direct/indirect choice has a plain explanation for both options", /in words|names the parents/.test(MODE_HELP.direct) && /census/.test(MODE_HELP.indirect));
t("isEmptyCell: blank cell is empty; any field filled is not (blocks stacking blank rows)", isEmptyCell({ fact: "", docType: "", mode: "", conflict: false, citation: "" }) && !isEmptyCell({ fact: "birth" }) && !isEmptyCell({ citation: "a" }) && !isEmptyCell({ conflict: true }));
t("Where to look: every fact has a recent and an older entry", FACTS.every((f) => WHERE_TO_LOOK[f]?.recent?.text && WHERE_TO_LOOK[f]?.older?.text));
t("Where to look: every source link is a Source Manifest source_url", Object.values(WHERE_SOURCES).every((s) => manifestUrls.has(s.url)));
t("Where to look: every claim behind the text is a verified manifest claim", FACTS.every((f) => ["recent", "older"].every((e) => WHERE_TO_LOOK[f][e].claims.length && WHERE_TO_LOOK[f][e].claims.every((c) => verified.has(c)))));
t("Where to look: every guide link points to a real page on this site", Object.values(GUIDES).every((g) => slugs.has(g.url)));
t("Where to look: every listed gap carries a Where-to-look note with the registrar fallback", (() => {
  const rows = [{ gen: 1, cells: [{ fact: "birth", docType: "birth_cert_long", mode: "direct", citation: "long form certificate", conflict: true }] }, { gen: 2, cells: [{ fact: "parentage", docType: "census_1850_1870", mode: "direct", citation: "1860 census page 4" }] }, { gen: 4, cells: [] }, { gen: 5, cells: [{ fact: "death", docType: "" , citation: "x" }] }];
  const g = gaps(rows); return g.length > 5 && g.every((x) => x.where && /registrar/.test(x.where.registrar) && (x.where.text || x.where.guides.length)) && gaps([]).every((x) => x.where); })());
t("Where to look: older parentage points to the National Archives census page; recent birth says to ask the registrar",
  whereToLook("parentage", 5).links.some((l) => l.url.includes("archives.gov/research/census")) && /registrar/.test(whereToLook("birth", 1).registrar));
// ---- "What to do next" action plan (built from the visitor's own gaps) ----
{ const { CHAPTER_LINKS, SITE_LINKS, CONTACT_STEP, APPLY_STEP } = await import("../src/tools/next-steps.js");
  const rows = [{ gen: 1, living: true, cells: [] }, { gen: 2, cells: [{ fact: "birth", docType: "birth_cert_long", mode: "direct", citation: "long form certificate", conflict: true }] }, { gen: 4, cells: [] }];
  const plan = actionPlan(rows); const g = gaps(rows);
  const order = plan.find((s) => s.title === "Records to find or fix, generation by generation");
  const subs = order ? order.items.flatMap((i) => i.sub) : [];
  t("plan: the records step lists every item from the user's own gaps, each missing one with Where to look", order && subs.length === g.filter((x) => x.gen != null).length && subs.filter((x) => !x.conflict).every((i) => i.where && i.where.text));
  t("plan: within a generation, flagged conflicts come first", order.items.find((i) => i.text.startsWith("Generation 2")).sub[0].conflict === true);
  t("plan: ends with 'Contact a local chapter's registrar' then 'Start the application'", plan.at(-2) === CONTACT_STEP && plan.at(-1) === APPLY_STEP && /registrar/.test(CONTACT_STEP.title) && /application/.test(APPLY_STEP.title));
  t("plan: chapter-finder and record links are all Source Manifest source URLs", Object.values(CHAPTER_LINKS).every((l) => manifestUrls.has(l.url)) && CONTACT_STEP.links.some((l) => l.url.includes("chapter-locator")));
  t("plan: site links point to real pages", Object.values(SITE_LINKS).every((l) => slugs.has(l.url)));
  t("plan: every claim behind a step is a verified manifest claim", plan.every((s) => s.claims.every((c) => verified.has(c))));
  t("plan: no fees, prices or timelines are stated", !/\$|\bfee|\bweeks?\b|\bdays to\b|\bmonths? to\b/i.test(JSON.stringify(plan.map((s) => [s.title, s.text]))));
  t("plan: an empty worksheet gets 'Fill in the worksheet' first", actionPlan([])[0].title === "Fill in the worksheet");
  t("plan: nothing missing says so plainly (no false 'proven')", (() => { const full = (f) => ({ fact: f, docType: "other", mode: "direct", citation: "a record citation" });
    const p = actionPlan([{ gen: 1, living: true, cells: [full("birth")] }, { gen: 2, cells: [full("birth"), full("death"), full("parentage")] }]); return p.some((s) => /Nothing is missing/.test(s.text)) && !/proven\b(?! by)/i.test(JSON.stringify(p).replace(/what is proven/g, "")); })());
}
// ---- Regression: audit defects (Oct 31, 2026) ----
{ const blank = { fact: "", docType: "", mode: "", conflict: false, citation: "" };
  const full = { fact: "birth", docType: "birth_cert_long", mode: "direct", citation: "long-form certificate, state office" };
  t("blank row: never labelled 'Evidence Entered — Review Required'", evaluateCell(blank).label !== LABELS.entered && evaluateCell({ ...blank, id: "c1" }).label === LABELS.none);
  t("blank row: not counted (countEntries / filledCells skip it)", countEntries([{ gen: 1, cells: [blank, full, blank] }, { gen: 2, cells: [blank] }]) === 1 && filledCells([blank, full]).length === 1);
  t("blank row: adds no gap items and no labels to the gap list", JSON.stringify(gaps([{ gen: 1, living: true, cells: [full, blank] }, { gen: 2, cells: [blank, blank] }])) === JSON.stringify(gaps([{ gen: 1, living: true, cells: [full] }, { gen: 2, cells: [] }])));
  // Audit case: conflict on gen 2, missing items on gens 2, 3, 4 -> old code listed gen 2 after gen 4 and repeated it.
  const rows = [{ gen: 1, living: true, cells: [full] }, { gen: 2, cells: [{ ...full, fact: "parentage", docType: "census_1850_1870", mode: "indirect", conflict: true }, { ...full, docType: "", citation: "half" }] }, { gen: 3, cells: [] }, { gen: 4, cells: [] }];
  const list = gaps(rows), groups = groupGaps(list);
  t("order: gap list is in generation order (never gen 2 after gen 4)", list.every((x, i) => i === 0 || (x.gen ?? 0) >= (list[i - 1].gen ?? 0)));
  t("order: each generation appears exactly once when grouped, in order", groups.map((x) => x.gen).join(",") === "2,3,4" && new Set(groups.map((x) => x.gen)).size === groups.length);
  t("order: grouped items drop the repeated 'Generation N' prefix", groups.every((grp) => grp.items.every((x) => !/^Generation \d/.test(x.short))));
  t("order: action plan lists each generation once, in order", (() => { const st = actionPlan(rows).find((x) => x.items); return st.items.map((i) => i.text).join("|") === "Generation 2: Your parent|Generation 3: Your grandparent|Generation 4: Your great-grandparent"; })());
}
const every = JSON.stringify([evaluateCell(full), evaluateCell({}), gaps([{ gen: 1, cells: [full] }]), LABELS]);
t('the word "Documented" never appears in output', !/documented/i.test(every));
let p = 0; for (const [n, ok] of T) { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (ok) p++; }
console.log(`\nLineage Evidence Matrix: ${p}/${T.length} sanity checks passed.`); process.exit(p === T.length ? 0 : 1);
