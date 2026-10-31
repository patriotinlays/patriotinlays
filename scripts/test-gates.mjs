// Exhaustive check that the mixed-gate matrix is complete and unambiguous, plus named examples.
import { evaluateGate, RULES } from "../ops/gates.js";
let ok = 0, fail = 0;
const t = (name, got, want) => { const pass = got === want; pass ? ok++ : fail++; if (!pass) console.log(`FAIL ${name}: got ${got}, want ${want}`); };
// 1. Named examples from Tim's brief and the blueprint
t("D60 high impressions + low clicks", evaluateGate(60, { indexed: 12, impressions28: 900, clicks28: 2, urlsWithImpr: 10 }).outcome, "PARTIAL_CTR");
t("D60 high clicks + low indexation", evaluateGate(60, { indexed: 6, impressions28: 900, clicks28: 40 }).outcome, "PARTIAL_TECH");
t("D90 high impressions + low clicks", evaluateGate(90, { indexed: 12, impressions28: 2000, clicks28: 15 }).outcome, "PARTIAL_CTR");
t("D90 high clicks + low indexation", evaluateGate(90, { indexed: 8, impressions28: 2000, clicks28: 80 }).outcome, "PARTIAL_TECH");
t("D30 3-5 indexed = technical audit", evaluateGate(30, { indexed: 4, urlsWithImpr: 4 }).outcome, "PARTIAL_TECH");
t("D30 high clicks + low indexation = technical audit", evaluateGate(30, { indexed: 2, urlsWithImpr: 2, clicks28: 30 }).outcome, "PARTIAL_TECH");
t("D90 high impressions + very low clicks = PARTIAL, not FAIL", evaluateGate(90, { indexed: 12, impressions28: 3000, clicks28: 4 }).outcome, "PARTIAL_CTR");
t("D90 low impressions + low clicks = FAIL", evaluateGate(90, { indexed: 12, impressions28: 700, clicks28: 4 }).outcome, "FAIL");
t("D30 2 indexed = FAIL", evaluateGate(30, { indexed: 2, urlsWithImpr: 2 }).outcome, "FAIL");
t("D60 150-299 impressions = freeze expansion", evaluateGate(60, { indexed: 11, impressions28: 200, clicks28: 9 }).outcome, "PARTIAL_CONTENT");
t("D60 manual action overrides strong metrics", evaluateGate(60, { indexed: 12, impressions28: 5000, clicks28: 300, manualAction: true }).outcome, "STOP");
t("D60 low impressions beats good indexation", evaluateGate(60, { indexed: 12, impressions28: 100, clicks28: 20 }).outcome, "FAIL");
t("D90 full pass", evaluateGate(90, { indexed: 12, impressions28: 1500, clicks28: 40, proxyPct: 7, toolViews28: 200 }).outcome, "PASS_ADSENSE");
t("D90 proxy insufficient data does not block", evaluateGate(90, { indexed: 12, impressions28: 1500, clicks28: 40, proxyPct: 0, toolViews28: 10 }).outcome, "PASS_ADSENSE");
t("D90 second PARTIAL = FAIL", evaluateGate(90, { indexed: 12, impressions28: 800, clicks28: 20, priorPartial: true }).outcome, "FAIL");
// 1b. D90-9 PARTIAL UTILITY and its single 14-day re-test
const strong = { indexed: 12, impressions28: 1500, clicks28: 40, toolViews28: 200 };
t("D90-9 triggers: traffic passes, proxy 1.9%", evaluateGate(90, { ...strong, proxyPct: 1.9 }).rule, "D90-9");
t("D90-9 outcome is PARTIAL_UTILITY_D90 (14-day refresh + one re-test)", evaluateGate(90, { ...strong, proxyPct: 1.9 }).outcome, "PARTIAL_UTILITY_D90");
t("D90-9 boundary: proxy 2.0% is D90-8 not D90-9", evaluateGate(90, { ...strong, proxyPct: 2 }).rule, "D90-8");
t("D90-9 not triggered on insufficient data (49 tool views)", evaluateGate(90, { ...strong, toolViews28: 49, proxyPct: 1 }).outcome, "PASS_ADSENSE");
t("D90-9 not reached when clicks < 30 (CTR rule first)", evaluateGate(90, { ...strong, clicks28: 29, proxyPct: 1 }).rule, "D90-5");
t("D90-9 not reached when 11/12 indexed (tech rule first)", evaluateGate(90, { ...strong, indexed: 11, proxyPct: 1 }).rule, "D90-7");
t("Re-test PASS: proxy 5% on 25 views", evaluateGate(90, { ...strong, proxyPct: 1, utilityRetest: true, retestProxyPct14: 5, retestToolViews14: 25 }).outcome, "PASS_ADSENSE");
t("Re-test FAIL: proxy 4.9%", evaluateGate(90, { ...strong, utilityRetest: true, retestProxyPct14: 4.9, retestToolViews14: 100 }).rule, "D90-R2");
t("Re-test FAIL: 24 tool views (insufficient data does not pass a re-test)", evaluateGate(90, { ...strong, utilityRetest: true, retestProxyPct14: 20, retestToolViews14: 24 }).outcome, "FAIL");
t("Re-test FAIL: clicks fell to 29", evaluateGate(90, { ...strong, clicks28: 29, utilityRetest: true, retestProxyPct14: 9, retestToolViews14: 100 }).outcome, "FAIL");
t("Re-test FAIL: indexation fell to 11", evaluateGate(90, { ...strong, indexed: 11, utilityRetest: true, retestProxyPct14: 9, retestToolViews14: 100 }).outcome, "FAIL");
t("Re-test with manual action = STOP", evaluateGate(90, { ...strong, manualAction: true, utilityRetest: true, retestProxyPct14: 9, retestToolViews14: 100 }).outcome, "STOP");
t("Re-test never yields another PARTIAL (no second refresh)", evaluateGate(90, { ...strong, utilityRetest: true, retestProxyPct14: 3, retestToolViews14: 100 }).outcome, "FAIL");
// 2. Exhaustive band sweep: every combination resolves to exactly one known rule (first match), none throws
const vals = { indexed: [0, 2, 3, 5, 6, 9, 10, 11, 12], urlsWithImpr: [0, 2, 3, 12], impressions28: [0, 149, 150, 299, 300, 499, 500, 999, 1000, 5000],
  clicks28: [0, 4, 5, 9, 10, 29, 30, 100], proxyPct: [0, 1.9, 2, 4.9, 5, 20], toolViews28: [0, 49, 50, 500], manualAction: [false, true], imprDeclining3w: [false, true], priorPartial: [false, true],
  utilityRetest: [false, true], retestProxyPct14: [0, 4.9, 5], retestToolViews14: [24, 25] };
let combos = 0; const hits = {};
const keys = Object.keys(vals);
(function rec(i, m) {
  if (i === keys.length) { for (const d of [30, 60, 90]) { const r = evaluateGate(d, m); if (!r || !r.outcome) throw new Error("unresolved"); const matches = RULES[d].filter(([, , test]) => test({ indexed: 0, impressions28: 0, clicks28: 0, utilityRetest: false, retestProxyPct14: 0, retestToolViews14: 0, manualAction: false, imprDeclining3w: false, priorPartial: false, toolViews28: 0, proxyPct: 0, urlsWithImpr: 0, ...m })); if (matches[0][0] !== r.rule) throw new Error("first-match mismatch"); if (d === 90 && m.utilityRetest && !["STOP", "PASS_ADSENSE", "FAIL"].includes(r.outcome)) throw new Error("re-test produced " + r.outcome); combos++; hits[r.rule] = (hits[r.rule] || 0) + 1; } return; }
  for (const v of vals[keys[i]]) rec(i + 1, { ...m, [keys[i]]: v });
})(0, {});
const allRules = Object.values(RULES).flat().map((r) => r[0]);
const unreached = allRules.filter((r) => !hits[r]);
t("every rule is reachable (no dead rows)", unreached.length, 0);
console.log(`Mixed-gate matrix: ${combos.toLocaleString()} metric combinations resolved, each to exactly one outcome; ${allRules.length} rules, unreachable: ${unreached.join(", ") || "none"}.`);
console.log(`Gate examples: ${ok}/${ok + fail} passed.`);
process.exit(fail ? 1 : 0);
