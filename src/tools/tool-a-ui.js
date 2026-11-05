// Tool A browser UI: the Widow Pension Law Checker (form, "fill in from my worksheet", plan) and its report page.
// localStorage key prefix "pi.toolA."; it may read the worksheet's patriot ("pi.toolB.v1") on request. No network calls.
import { checkWidowActs, FIELD_HELP, nextSteps, plural, widowSummary, TERMS, verdictFor } from "./tool-a.js";
import { renderPlan } from "./plan-ui.js";
import { ns, el } from "./storage.js";
import { kindOf } from "./patriot.js";
import { stateName } from "./places.js";
import { mountDates, setDate, dateErrors } from "./date-ui.js";
import { dateLabel } from "./dates.js";
const store = ns("pi.toolA.");
const worksheet = ns("pi.toolB.");
// Badges are deliberately not green: a matching date is a starting point, never an approval.
// Labels: "Fits the rules checked here; other terms not checked" only when every rule the tool has is settled;
// "Ruled out by the dates"; "Still possible: need …"; "Can't check here".
const badge = (s, text) => el("span", { class: `badge b-${s}`, text: text || (s === "invalid" ? "Couldn't read the dates" : verdictFor({ status: s })) });

function renderWidow(rows) {
  if (rows.length === 1 && rows[0].act === "input") return el("div", { class: "result r-invalid" }, badge("invalid"), el("p", { text: rows[0].message }));
  const t = el("table", { class: "widow" }, el("thead", {}, el("tr", {}, el("th", { text: "Pension law" }), el("th", { text: "Result" }), el("th", { text: "The rule, and what to do next" }))));
  const tb = el("tbody");
  // data-label lets narrow screens show each row as a stacked card (see site.css).
  for (const r of rows) tb.append(el("tr", {}, el("td", { "data-label": "Pension law", text: r.label || r.act }), el("td", { "data-label": "Result" }, badge(r.status, r.verdict), el("div", { class: "small", text: r.message })),
    el("td", { "data-label": "The rule, and what to do next" }, el("div", { class: "small", text: `Rule: ${r.ruleText || ""}` }),
      r.why ? el("div", { class: "small", text: r.why }) : null,
      r.next ? el("div", { class: "small next", text: r.next }) : null,
      r.uiNote ? el("div", { class: "small note", text: r.uiNote }) : null,
      r.uncheckedText ? el("div", { class: "small note", "data-unchecked": "", text: r.uncheckedText }) : null,
      r.nextNote ? el("div", { class: "small next", text: r.nextNote }) : null,
      r.links?.length ? el("ul", { class: "where-links small" }, ...r.links.map((l) => el("li", {}, el("a", { href: l.url, rel: "noopener", text: l.label })))) : null)));
  t.append(tb);
  const sum = widowSummary(rows);
  // The one question that would settle the most open laws gets a link straight to its box.
  // Each box that answers it is named and linked (audit 4): two separate questions when either one settles it.
  const go = (f) => el("a", { href: `#${f.field}`, "data-ask-link": f.field, onclick: (e) => { e.preventDefault(); const x = document.getElementById(f.field); x?.scrollIntoView({ block: "center" }); x?.focus(); }, text: `Go to "${f.label}"` });
  const ask = sum?.ask ? el("div", { class: "ask", "data-ask": sum.ask.key }, el("p", {}, el("strong", { text: "One more answer would settle the most: " }), `${sum.ask.text}. It bears on the ${sum.ask.settles.length > 2 ? `${sum.ask.settles.slice(0, -1).join(", ")} and ${sum.ask.settles.at(-1)}` : sum.ask.settles.join(" and ")} law${sum.ask.settles.length > 1 ? "s" : ""}.`),
    sum.ask.fields.length > 1 ? el("ul", { class: "small" }, ...sum.ask.fields.map((f) => el("li", {}, `${f.label} ${f.hint ? `(${f.hint})` : ""} `, go(f)))) : el("p", { class: "small" }, go(sum.ask.fields[0]))) : null;
  return el("div", {}, sum ? el("div", { class: "answer", "data-answer": "", role: "status" }, el("strong", { text: "In short" }),
    el("ul", { class: "answer-lines" }, ...sum.lines.map((l) => el("li", { "data-line": l.label }, el("strong", { text: `${l.label}: ` }), l.text)))) : null, ask,
    el("div", { class: "table-wrap" }, t),
    el("p", { class: "small terms", "data-terms": "" }, el("strong", { text: "Plain terms: " }), `${TERMS.stat.text} ${TERMS.bounty.text}`));
}
// The plan follows only a check run on this visit (button or example), never a result left over from an earlier visit.
let ranThisVisit = null;
function updatePlan(root) {
  const box = root.querySelector("[data-plan]"); if (!box) return;
  // Before a check runs, show a plain placeholder instead of a generic plan that could be mistaken for a result (audit 3).
  if (!ranThisVisit) { box.replaceChildren(el("p", { class: "small hint", "data-plan-wait": "", text: "Your next steps appear here after you press \"Check the widow pension laws\". They follow from your results." })); return; }
  box.replaceChildren(renderPlan(nextSteps(null, ranThisVisit), { heading: false }));
}
function savedNotice(root) {
  const n = root.querySelector("[data-saved-msg]"); if (!n) return;
  const d = store.get("widow", null);
  if (!d || ranThisVisit) { n.replaceChildren(); n.hidden = true; return; }
  n.hidden = false;
  n.replaceChildren(`A check you ran earlier (${new Date(d.at).toLocaleDateString()}) is saved in this browser. The form starts empty; `,
    el("a", { href: "/tools/widow-pension-checker/report/", text: "see the saved check in your report" }), ", or press \"Start over\" to delete it.");
}
function runWidow(form, out) {
  const f = Object.fromEntries(new FormData(form));
  const num = (v) => (v === "" || v == null ? null : Number(String(v).trim()));
  // The battle question has three answers: yes, no, or not answered (don't know). Only "No" can rule a law out.
  const input = { marriage: f.marriage || null, serviceEnd: f.serviceEnd || null, serviceMonths: num(f.serviceMonths), serviceDays: num(f.serviceDays),
    engagement: f.engagement === "yes" ? true : f.engagement === "no" ? false : null, kind: f.kind || null };
  const bad = dateErrors(form);
  const rows = bad ? [{ act: "input", status: "invalid", message: `We couldn't read the dates: ${bad}` }] : checkWidowActs(input);
  store.set("widow", { input: { ...f }, norm: input, result: rows, at: new Date().toISOString() });
  ranThisVisit = rows; out.replaceChildren(renderWidow(rows)); const root = form.closest("[data-tool]"); updatePlan(root); savedNotice(root);
}
function bindWidow(root) {
  const form = root.querySelector("form[data-form=widow]"); if (!form) return;
  const out = root.querySelector("[data-out=widow]");
  // "Why it matters" lines come from FIELD_HELP (each tied to Source Manifest claims).
  for (const [k, h] of Object.entries(FIELD_HELP)) { const p = form.querySelector(`[data-why="${k}"]`); if (p) p.textContent = h.text; }
  // Every visit starts with an empty, unticked form and no results: results appear only after the button is pressed.
  // (Earlier visits restored the last entries, including the example's ticked battle box, and showed old results.)
  form.reset(); form.querySelectorAll("[data-date-field]").forEach((fs) => fs.setValue("")); out.replaceChildren(); savedNotice(root);
  form.addEventListener("submit", (ev) => { ev.preventDefault(); runWidow(form, out); out.focus(); });
}
// "Fill in from my worksheet": copies the patriot's service end date from the Lineage Evidence Matrix (same browser).
function fromWorksheet(root, auto = false) {
  const form = root.querySelector("form[data-form=widow]"); const msg = root.querySelector("[data-worksheet-msg]");
  const p = worksheet.get("v1", null)?.patriot;
  if (!p || !p.end && !p.start) { if (msg) msg.replaceChildren("No patriot service dates are saved in the worksheet in this browser yet. ", el("a", { href: "/tools/lineage-matrix/#tb-patriot", text: "Add them in the worksheet's patriot step" }), "."); return false; }
  setDate(form, "serviceEnd", p.end || p.start);
  const k = kindOf(p.kind);
  // His kind of service, when the worksheet's choice maps onto the 1832 law's categories (or is clearly something else).
  if (form.elements.kind && p.kind) form.elements.kind.value = ["continental", "militia"].includes(p.kind) ? p.kind : p.kind === "navy" ? "navy" : p.kind === "military" ? "" : "other";
  if (msg) msg.textContent = `Filled in from your worksheet: ${p.name || "the patriot"}${p.state ? `, ${stateName(p.state)}` : ""}${k ? `, ${k.label.toLowerCase()}` : ""}, service ended ${dateLabel(p.end || p.start)}. Add the marriage date and, if you know them, his months or days of service.`;
  if (!auto) form.querySelector("#tw-m-month")?.focus();
  return true;
}
function bindExample(root) {
  root.querySelector("[data-load-example]")?.addEventListener("click", () => {
    const d = root.querySelector("form[data-form=widow]");
    setDate(d, "marriage", "1777-05"); setDate(d, "serviceEnd", "1778-03"); d.elements.serviceMonths.value = "20"; d.elements.serviceDays.value = ""; d.elements.engagement.value = "yes"; d.elements.kind.value = "";
    runWidow(d, root.querySelector("[data-out=widow]"));
    const m = root.querySelector("[data-example-msg]"); if (m) m.textContent = "Example loaded: a made-up couple who married in May 1777; his service ended in March 1778. The results are in the table below.";
    root.querySelector("[data-out=widow]").focus();
  });
}
function bindClear(root) {
  root.querySelectorAll("[data-clear=toolA]").forEach((b) => b.addEventListener("click", () => {
    const n = store.clear(); ranThisVisit = null; root.querySelectorAll("form").forEach((f) => { f.reset(); f.querySelectorAll("[data-date-field]").forEach((fs) => fs.setValue("")); });
    root.querySelectorAll("[data-example-msg], [data-worksheet-msg]").forEach((m) => { m.textContent = ""; });
    const msg = n ? `Started over: deleted ${plural(n, "saved item")} from this browser.` : "Started over. Nothing was saved in this browser.";
    if (root.matches("[data-tool-report]")) { renderReport(root); root.querySelector("[data-report]").prepend(el("p", { class: "small", role: "status", text: msg })); }
    else root.querySelectorAll("[data-out]").forEach((o) => o.replaceChildren(el("p", { class: "small", role: "status", text: msg })));
    updatePlan(root); savedNotice(root);
  }));
}
const KIND_TEXT = { continental: "Continental Line", militia: "State troops, volunteers or militia", navy: "Navy (officer, marine or mariner)", other: "something else" };
function renderReport(root) {
  const d = store.get("widow", null);
  // Results are worked out again from what was typed, so a check saved by an older version shows today's labels.
  const rows = d ? (d.norm ? checkWidowActs(d.norm) : checkWidowActs({ marriage: d.input.marriage || null, serviceEnd: d.input.serviceEnd || null, serviceMonths: d.input.serviceMonths ? Number(d.input.serviceMonths) : null, serviceDays: d.input.serviceDays ? Number(d.input.serviceDays) : null, engagement: d.input.engagement === true || d.input.engagement === "on" ? true : null, kind: null })) : null;
  const body = root.querySelector("[data-report]");
  if (!d) { body.replaceChildren(el("p", { text: "Nothing saved in this browser yet. Open the checker, type the dates (or press \"Load an example\"), then come back." }),
    el("p", {}, el("a", { class: "button-link", href: "/tools/widow-pension-checker/", text: "Go to the Widow Pension Law Checker" }))); return; }
  body.replaceChildren(el("p", { class: "small", text: "These results compare your dates with the published pension laws. They are not a ruling: only your lineage society decides." }),
    el("h2", { text: "Widow pension and bounty-land laws" }), el("p", { class: "small", text: `Saved ${new Date(d.at).toLocaleString()}. Marriage: ${dateLabel(d.input.marriage) || "—"}. His last service ended: ${dateLabel(d.input.serviceEnd) || "—"}. Months of service: ${d.input.serviceMonths || "—"}. Days of service: ${d.input.serviceDays || "—"}. In a battle: ${d.input.engagement === "yes" || d.input.engagement === true ? "yes" : d.input.engagement === "no" ? "no" : "don't know"}. Kind of service: ${KIND_TEXT[d.input.kind] || "don't know"}.` }),
    renderWidow(rows), renderPlan(nextSteps(null, rows)));
}
document.querySelectorAll('[data-tool="widow"]').forEach((root) => { mountDates(root); bindWidow(root); bindExample(root); bindClear(root); updatePlan(root);
  root.querySelector("[data-from-worksheet]")?.addEventListener("click", () => fromWorksheet(root));
  if (new URLSearchParams(location.search).get("from") === "worksheet") fromWorksheet(root, true); });
document.querySelectorAll('[data-tool-report="widow"]').forEach((root) => { renderReport(root); bindClear(root);
  root.querySelector("[data-print]")?.addEventListener("click", () => window.print()); });
