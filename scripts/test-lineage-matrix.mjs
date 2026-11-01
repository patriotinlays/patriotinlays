// Sanity tests for Tool B (not part of the 25-scenario requirement).
import { actionPlan, evaluateCell, gaps, groupGaps, countEntries, filledCells, LABELS, FACTS, genLabel, genTitle, isEmptyCell, WHERE_TO_LOOK, WHERE_SOURCES, GUIDES, whereToLook, MODE_HELP, relationName, ordinal, HAVE_ITEMS, DOC_TYPES } from "../src/tools/tool-b.js";
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
t("generation names: 1 You, 2 Your parent, 3 Your grandparent, 4 Your great-grandparent, 5 Your 2nd-great-grandparent, 6 Your 3rd-great-grandparent",
  [1, 2, 3, 4, 5].map(genLabel).join("|") === "You|Your parent|Your grandparent|Your great-grandparent|Your 2nd-great-grandparent" && genLabel(6) === "Your 3rd-great-grandparent" && genLabel(14) === "Your 11th-great-grandparent" && genTitle(1) === "Generation 1: You");
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

// ---- Round 5: patriot step, era- and state-tailored "Where to look" ----
{ const { SERVICE_KINDS, patriotDates, serviceWhere, patriotSteps, kindOf, WIDOW_TOOL } = await import("../src/tools/patriot.js");
  const { SERVICE_RULES } = await import("../src/tools/tool-a.js");
  const { STATES, STATE_VITAL, STATE_SERVICE, PLACE_SOURCES, vitalNote, censusNote } = await import("../src/tools/places.js");
  const { patriotGen } = await import("../src/tools/tool-b.js");
  const claimsOk = (cs) => cs.length > 0 && cs.every((c) => verified.has(c));
  const linkOk = (l) => manifestUrls.has(l.url) || slugs.has(l.url) || /^\/tools\/lineage-matrix\//.test(l.url);
  const p = { name: "John", state: "VA", unit: "Culpeper County militia", kind: "militia", start: "1777-05", end: "1779-10" };
  t("patriot: every service type maps to a DAR date window and cites verified claims (or none)", SERVICE_KINDS.every((k) => SERVICE_RULES.some((r) => r.id === k.rule) && k.claims.every((c) => verified.has(c))));
  t("patriot: Virginia militia 1777-05 to 1779-10 fits the period (not a ruling); Virginia Oath in 1778 does not; committee in May 1774 does",
    patriotDates(p).status === "consistent" && /not a ruling/.test(patriotDates(p).plain) && patriotDates({ ...p, kind: "va_oath", start: "1778", end: "" }).status === "inconsistent" && patriotDates({ ...p, kind: "committee", start: "1774-05", end: "" }).status === "consistent");
  t("patriot: militia advice says the National Archives has no militia records and links the Library of Virginia guide", (() => { const w = serviceWhere(p); return /does not hold state militia/.test(w.text) && /Virginia:/.test(w.text) && w.links.some((l) => l.url.includes("lva-virginia.libguides.com/revolutionary-war")) && claimsOk(w.claims); })());
  t("patriot: Continental advice names the National Archives service records (M881)", /M881/.test(serviceWhere({ ...p, kind: "continental" }).text));
  t("patriot: a state with no verified source says so honestly and falls back to the NYPL advice (no invented records)", (() => { const w = serviceWhere({ ...p, state: "TX" }); return /no verified guide yet for Texas/.test(w.text) && w.links.some((l) => l.url.includes("libguides.nypl.org")) && !/Library of Virginia/.test(w.text); })());
  t("patriot: no patriot entered -> first plan step asks for him; date problems get their own step", patriotSteps(null)[0].title === "Tell the worksheet about the patriot" && patriotSteps({ ...p, start: "1775", end: "" }).some((s) => s.title.startsWith("Pin down")) && patriotSteps({ ...p, start: "1790", end: "" }).some((s) => s.title.startsWith("Double-check")));
  t("patriot: military service gets the widow-pension step (linking the checker); civil service does not", patriotSteps(p).some((s) => s.links.some((l) => l.url === WIDOW_TOOL.url)) && !patriotSteps({ ...p, kind: "civil" }).some((s) => /widow/i.test(s.title)));
  t("patriot: the plan leads with his service and drops the old standalone date-check step", (() => { const plan = actionPlan([{ gen: 1, living: true, cells: [] }, { gen: 2, cells: [] }], p); return plan[0].title === "Prove the patriot's service" && !plan.some((s) => /service dates/.test(s.title) && s.links?.some((l) => /service-window/.test(l.url))); })());
  t("patriot: every plan link is a manifest source or a site page, every claim verified", [p, { ...p, kind: "continental", state: "NC" }, { ...p, kind: "civil", state: "TX" }, { ...p, kind: "galvez_troops", state: "" }].every((x) => patriotSteps(x).every((s) => s.links.every(linkOk) && s.claims.every((c) => verified.has(c)))));
  t("patriot: the oldest generation is the patriot unless another is picked; groups label it", (() => { const rows = [{ gen: 1, cells: [] }, { gen: 2, cells: [] }, { gen: 3, cells: [] }];
    return patriotGen(rows, p) === 3 && patriotGen(rows, { ...p, gen: "2" }) === 2 && patriotGen(rows, null) === null && groupGaps(gaps(rows, p), 3).at(-1).title.endsWith("(the patriot)"); })());
  // Era and state
  const w = (fact, gen, ctx) => whereToLook(fact, gen, ctx);
  t("era: an ancestor born 1820 in Virginia gets no birth-certificate advice (Virginia did not record births before 1853)", (() => { const x = w("birth", 2, { born: "1820", state: "VA" }); return x.era === "older" && !/birth certificate/i.test(x.text) && x.notes.some((n) => /before 1853/.test(n.text)) && claimsOk(x.claims); })());
  t("era: Virginia 1880 birth -> county registers 1853-1896; 1900 -> the 1897-1911 gap; 1920 -> recording resumed 1912",
    /1853 to 1896/.test(w("birth", 5, { born: "1880", state: "VA" }).notes[0].text) && w("birth", 5, { born: "1880", state: "VA" }).era === "recent"
    && /1897 to 1911/.test(w("birth", 2, { born: "1900", state: "VA" }).notes[0].text) && w("birth", 2, { born: "1900", state: "VA" }).era === "older" && /1912/.test(w("birth", 2, { born: "1920", state: "VA" }).notes[0].text));
  t("era: New Jersey before 1848 not filed; North Carolina before 1913 -> county Register of Deeds; Pennsylvania before 1906 -> county courthouse",
    /not filed/.test(w("birth", 4, { born: "1840", state: "NJ" }).notes[0].text) && /Register of Deeds/.test(w("birth", 3, { born: "1900", state: "NC" }).notes[0].text) && /county courthouse/.test(w("death", 3, { died: "1890", state: "PA" }).notes[0].text));
  t("era: death with only a birth year lists just the periods it could fall in", (() => { const n = w("death", 3, { born: "1890", state: "VA" }).notes[0].text; return !/before 1853/.test(n) && /1897 to 1911/.test(n) && /1912/.test(n); })());
  t("state: no verified source -> says so, gives the census/National Archives fallback, never claims a record exists", (() => { const x = w("birth", 3, { born: "1900", state: "TX" }); return /no verified source yet on when Texas/.test(x.notes[0].text) && x.links.some((l) => l.url.includes("archives.gov/research/vital-records")) && claimsOk(x.notes[0].claims); })());
  t("state: no state picked -> a plain hint, not a guess", /Add the state/.test(w("birth", 3, { born: "1900" }).notes[0].text));
  t("census: only censuses in the lifetime are listed; the patriot alive in 1840 gets the pensioner note",
    (() => { const a = censusNote(1820, 1845).text, b = censusNote(1860, null).text, c = censusNote(1755, 1845, { patriot: true }).text, d = censusNote(1755, 1838, { patriot: true }).text;
      return /1790–1840/.test(a) && !/1850/.test(a) && !/1790/.test(b) && /1850–1870/.test(b) && /1880–1900/.test(b) && /pensioners/.test(c) && !/pensioners/.test(d); })());
  t("sources: every state entry cites verified claims; every link is a Source Manifest URL; every state code is real",
    Object.entries(STATE_VITAL).every(([st, v]) => STATES.some(([c]) => c === st) && v.links.every((l) => manifestUrls.has(l.url)) && ["birth", "death", "marriage"].every((f) => !v[f] || v[f].every((x) => claimsOk(x.claims))))
    && Object.entries(STATE_SERVICE).every(([st, v]) => STATES.some(([c]) => c === st) && claimsOk(v.claims) && v.links.every((l) => manifestUrls.has(l.url)))
    && Object.values(PLACE_SOURCES).every((l) => manifestUrls.has(l.url)));
  t("sources: every vital period is in year order with no overlaps", Object.values(STATE_VITAL).every((v) => ["birth", "death", "marriage"].every((f) => !v[f] || v[f].every((x, i, a) => i === 0 || (a[i - 1].to != null && x.from === a[i - 1].to + 1)))));
  t("gaps: a patriot row with no state of its own uses the patriot's state", gaps([{ gen: 1, living: true, cells: [] }, { gen: 2, born: "1760", cells: [] }], { ...p, state: "NJ" }).filter((g) => g.gen === 2 && g.fact === "birth").every((g) => /New Jersey/.test(g.where.notes[0].text)));
}
// ---- Audit 2 regressions ----
{ const { patriotGen, SUBSTITUTE_GUIDE } = await import("../src/tools/tool-b.js"); const { STATE_VITAL } = await import("../src/tools/places.js");
  const p = { name: "John", state: "VA", kind: "militia", start: "1777", end: "1779" }; const rows = [{ gen: 1, cells: [] }, { gen: 2, cells: [] }, { gen: 3, cells: [] }];
  t("audit 2: Generation 1 can never be the patriot; a saved '1' falls back to the oldest generation", patriotGen(rows, { ...p, gen: "1" }) === 3 && patriotGen(rows, { ...p, gen: "" }) === 3 && patriotGen([{ gen: 1, cells: [] }], p) === null);
  t("audit 2: gaps never label Generation 1 as the patriot", !groupGaps(gaps(rows, { ...p, gen: "1" }), patriotGen(rows, { ...p, gen: "1" })).some((g) => g.gen === 1 && /the patriot/.test(g.title)));
  const vaOld = whereToLook("birth", 4, { born: "1810", state: "VA" }).notes[0];
  t("audit 2: a Virginia birth before 1853 says plainly there was no statewide birth recording, and links the substitute-evidence guide at that gap",
    /no statewide recording of births before 1853/.test(vaOld.text) && vaOld.guide?.url === "/guides/substitute-evidence/" && vaOld.claims.includes("lva-bmd-pre1853") && slugs.has(SUBSTITUTE_GUIDE.url));
  t("audit 2: the same link appears for New Jersey before 1848, South Carolina before 1915 and Virginia 1897-1911 (sourced 'no record' periods)",
    ["NJ:1840", "SC:1900", "VA:1900"].every((x) => { const [st, y] = x.split(":"); return whereToLook("birth", 3, { born: y, state: st }).notes[0].guide?.url === "/guides/substitute-evidence/"; }));
  t("audit 2: no 'no record' claim where the source points to county records or the state has records (NC 1900, PA 1890, VA 1880, MD, Texas), and never on deaths",
    ["NC:1900", "PA:1890", "VA:1880", "MD:1880", "TX:1880"].every((x) => { const [st, y] = x.split(":"); return !whereToLook("birth", 3, { born: y, state: st }).notes[0].guide; }) && !whereToLook("death", 4, { died: "1840", state: "VA" }).notes[0].guide);
  t("audit 2: every 'no record' period cites verified claims", Object.values(STATE_VITAL).flatMap((v) => v.birth || []).filter((x) => x.noRecord).every((x) => x.claims.length && x.claims.every((c) => verified.has(c))));
}
const every = JSON.stringify([evaluateCell(full), evaluateCell({}), gaps([{ gen: 1, cells: [full] }]), LABELS]);
t('the word "Documented" never appears in output', !/documented/i.test(every));
t("plain relationship names map to generations (2 father, 3 grandfather, 4 great-, 5 2nd-great, 6 3rd-great)", relationName(2) === "my father" && relationName(3) === "my grandfather" && relationName(4) === "my great-grandfather" && relationName(5) === "my 2nd-great-grandfather" && relationName(6) === "my 3rd-great-grandfather" && relationName(14) === "my 11th-great-grandfather");
t("ordinals: 1st 2nd 3rd 4th 11th 12th 13th 21st 22nd", [1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal).join(" ") === "1st 2nd 3rd 4th 11th 12th 13th 21st 22nd");
t("'What do you have?' items use real record kinds and facts", HAVE_ITEMS.length >= 8 && HAVE_ITEMS.every((h) => h.label && (h.docType === "" || h.docType in DOC_TYPES) && (h.fact === "" || FACTS.includes(h.fact))));
t("checklist covers birth record, will, census, Bible record and pension file", ["birth_cert", "will", "census", "bible", "pension"].every((id) => HAVE_ITEMS.some((h) => h.id === id)));
t("plan items carry the generation and fact so the report can point to 'Where to look' once", (() => { const st = actionPlan([{ gen: 1, cells: [] }, { gen: 2, cells: [] }]).find((x) => x.items); return st && st.items.every((i) => i.sub.every((s) => /^Gen \d+$/.test(s.who) && "fact" in s)); })());
let p = 0; for (const [n, ok] of T) { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (ok) p++; }
console.log(`\nLineage Evidence Matrix: ${p}/${T.length} sanity checks passed.`); process.exit(p === T.length ? 0 : 1);
