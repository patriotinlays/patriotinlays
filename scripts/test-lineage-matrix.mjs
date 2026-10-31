// Sanity tests for Tool B (not part of the 25-scenario requirement).
import { evaluateCell, gaps, LABELS } from "../src/tools/tool-b.js";
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
t("gaps: gen 2 without death/parentage listed", gaps([{ gen: 1, cells: [full] }, { gen: 2, cells: [full] }]).some((g) => /Generation 2: no death/.test(g.text)));
const every = JSON.stringify([evaluateCell(full), evaluateCell({}), gaps([{ gen: 1, cells: [full] }]), LABELS]);
t('the word "Documented" never appears in output', !/documented/i.test(every));
let p = 0; for (const [n, ok] of T) { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (ok) p++; }
console.log(`\nLineage Evidence Matrix: ${p}/${T.length} sanity checks passed.`); process.exit(p === T.length ? 0 : 1);
