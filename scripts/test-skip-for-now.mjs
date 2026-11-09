// Tim t119u #3: every question on a worksheet record (A to D) can be skipped or left blank. Anything skipped shows in the
// gap report as "Still needed", never as an error or a conflict.
import { readFileSync } from "node:fs";
import { evaluateCell, gaps, isEmptyCell, setSkip, isSkipped, SKIPPABLE, SKIP_TEXT, LABELS, countEntries, actionPlan } from "../src/tools/tool-b.js";
const T = []; const t = (name, cond) => T.push([name, !!cond]);
const full = { id: "x", docType: "birth_cert_long", fact: "birth", mode: "direct", conflict: false, citation: "Ohio Dept of Health cert #123, image saved" };
const rows = (cell) => [{ gen: 1, cells: [] }, { gen: 2, cells: [cell] }];
const BAD = /\berror\b|invalid|isn't one|not allowed|required field/i;
t('the choice is labelled exactly "Skip for now" and covers all four questions (A to D)', SKIP_TEXT === "Skip for now" && ["fact", "docType", "mode", "citation"].every((k) => SKIPPABLE.includes(k)));
for (const k of SKIPPABLE) {
  const c = setSkip({ ...full }, k, true); const ev = evaluateCell(c);
  t(`skipping ${k} clears that answer and marks it skipped`, c[k] === "" && isSkipped(c, k));
  t(`skipping ${k}: the record reads "Needs details", not a conflict`, ev.label === LABELS.incomplete);
  t(`skipping ${k}: its note reads "Still needed (skipped for now): ..."`, ev.issues.length === 1 && ev.issues[0].startsWith("Still needed (skipped for now): "));
  const g = gaps(rows(c)).filter((x) => x.gen === 2 && x.brief);
  t(`skipping ${k}: the gap report lists it as "Still needed", never as an error`, g.length === 1 && /Still needed: /.test(g[0].brief) && g[0].priority !== 0 && !BAD.test(g[0].text + g[0].brief));
}
{ const c = { id: "y", fact: "", docType: "", mode: "", conflict: false, citation: "" }; for (const k of SKIPPABLE) setSkip(c, k, true);
  const ev = evaluateCell(c); const g = gaps(rows(c)).filter((x) => x.gen === 2 && x.brief);
  t("a record with all four questions skipped is kept (not treated as blank) and counted", !isEmptyCell(c) && countEntries([{ gen: 2, cells: [c] }]) === 1);
  t('a fully skipped record lists all four answers as "Still needed" and reads "the record" (no "record record")', ev.label === LABELS.incomplete && ev.issues.length === 4 && ev.issues.every((i) => i.startsWith("Still needed (skipped for now): "))
    && g.length === 1 && /^The record isn't finished\. Still needed: /.test(g[0].brief) && !/record record/.test(JSON.stringify(gaps(rows(c)))));
  t("a fully skipped record never produces an error or conflict anywhere in the plan", !BAD.test(JSON.stringify(actionPlan(rows(c)).items ?? actionPlan(rows(c)))) && !gaps(rows(c)).some((x) => x.priority === 0)); }
{ const c = setSkip({ ...full }, "mode", true); setSkip(c, "mode", false); c.mode = "indirect";
  t("answering a skipped question clears the skip", !isSkipped(c, "mode") && evaluateCell(c).label === LABELS.entered); }
{ const ev = evaluateCell({ id: "z", fact: "birth", docType: "", mode: "", conflict: false, citation: "" });
  t('fields left blank (without pressing Skip) also read "Still needed", never an error', ev.label === LABELS.incomplete && ev.issues.every((i) => i.startsWith("Still needed: ")) && !BAD.test(ev.issues.join(" "))); }
{ const ui = readFileSync(new URL("../src/tools/tool-b-ui.js", import.meta.url), "utf8"); const css = readFileSync(new URL("../src/assets/site.css", import.meta.url), "utf8");
  t("the worksheet offers Skip for now on A and B (menus), C (a third choice) and D (a tick box)", /select\("fact",[^\n]*isSkipped\(c, "fact"\)\)/.test(ui) && /select\("docType",[^\n]*isSkipped\(c, "docType"\)\)/.test(ui) && /"data-skip": "mode"/.test(ui) && /"data-skip": "citation"/.test(ui));
  t("no record question is marked required in the worksheet", !/\brequired\s*:/.test(ui));
  t('"Still needed" notes are styled as to-dos (amber), not in the error red', /\.issue\{color:#6b4500\}/.test(css));
  t('the report table shows "Still needed" for an unanswered or skipped field (no dash)', (ui.match(/\|\| STILL_NEEDED/g) || []).length >= 3); }
let p = 0; for (const [n, ok] of T) { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (ok) p++; }
console.log(`Skip for now: ${p}/${T.length} passed.`); process.exit(p === T.length ? 0 : 1);
