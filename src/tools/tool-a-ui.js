// Tool A browser UI: the Widow Pension Law Checker (form, "fill in from my worksheet", plan) and its report page.
// localStorage key prefix "pi.toolA."; it may read the worksheet's patriot ("pi.toolB.v1") on request. No network calls.
import { checkWidowActs, FIELD_HELP, nextSteps, plural } from "./tool-a.js";
import { renderPlan } from "./plan-ui.js";
import { ns, el } from "./storage.js";
import { kindOf } from "./patriot.js";
import { stateName } from "./places.js";
const store = ns("pi.toolA.");
const worksheet = ns("pi.toolB.");
// Badges are deliberately not green: a matching date is a starting point, never an approval.
const WIDOW_LABEL = { consistent: "Fits this law's date rule (not a ruling)", partial: "Too rough to tell", inconsistent: "Doesn't fit as typed", invalid: "Couldn't read the dates", not_evaluated: "Not checked" };
const badge = (s) => el("span", { class: `badge b-${s}`, text: WIDOW_LABEL[s] || s });

function renderWidow(rows) {
  if (rows.length === 1 && rows[0].act === "input") return el("div", { class: "result r-invalid" }, badge("invalid"), el("p", { text: rows[0].message }));
  const t = el("table", { class: "widow" }, el("thead", {}, el("tr", {}, el("th", { text: "Pension law" }), el("th", { text: "Result" }), el("th", { text: "The rule, and what to do next" }))));
  const tb = el("tbody");
  // data-label lets narrow screens show each row as a stacked card (see site.css).
  for (const r of rows) tb.append(el("tr", {}, el("td", { "data-label": "Pension law", text: r.label || r.act }), el("td", { "data-label": "Result" }, badge(r.status), el("div", { class: "small", text: r.message })),
    el("td", { "data-label": "The rule, and what to do next" }, el("div", { class: "small", text: `Rule: ${r.ruleText || ""}` }),
      r.why && r.why !== "Missing information." ? el("div", { class: "small", text: r.why }) : null,
      r.next ? el("div", { class: "small next", text: r.next }) : null,
      r.uiNote ? el("div", { class: "small note", text: r.uiNote }) : null,
      r.nextNote ? el("div", { class: "small next", text: r.nextNote }) : null,
      r.links?.length ? el("ul", { class: "where-links small" }, ...r.links.map((l) => el("li", {}, el("a", { href: l.url, rel: "noopener", text: l.label })))) : null)));
  t.append(tb); return el("div", { class: "table-wrap" }, t);
}
// The plan follows only a check run on this visit (button or example), never a result left over from an earlier visit.
let ranThisVisit = null;
function updatePlan(root) {
  const box = root.querySelector("[data-plan]"); if (!box) return;
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
  const input = { marriage: f.marriage || null, serviceEnd: f.serviceEnd || null, serviceMonths: num(f.serviceMonths), serviceDays: num(f.serviceDays), engagement: f.engagement === "on" ? true : null };
  const rows = checkWidowActs(input);
  store.set("widow", { input: { ...f, engagement: f.engagement === "on" }, result: rows, at: new Date().toISOString() });
  ranThisVisit = rows; out.replaceChildren(renderWidow(rows)); const root = form.closest("[data-tool]"); updatePlan(root); savedNotice(root);
}
function bindWidow(root) {
  const form = root.querySelector("form[data-form=widow]"); if (!form) return;
  const out = root.querySelector("[data-out=widow]");
  // "Why it matters" lines come from FIELD_HELP (each tied to Source Manifest claims).
  for (const [k, h] of Object.entries(FIELD_HELP)) { const p = form.querySelector(`[data-why="${k}"]`); if (p) p.textContent = h.text; }
  // Every visit starts with an empty, unticked form and no results: results appear only after the button is pressed.
  // (Earlier visits restored the last entries, including the example's ticked battle box, and showed old results.)
  form.reset(); out.replaceChildren(); savedNotice(root);
  form.addEventListener("submit", (ev) => { ev.preventDefault(); runWidow(form, out); out.focus(); });
}
// "Fill in from my worksheet": copies the patriot's service end date from the Lineage Evidence Matrix (same browser).
function fromWorksheet(root, auto = false) {
  const form = root.querySelector("form[data-form=widow]"); const msg = root.querySelector("[data-worksheet-msg]");
  const p = worksheet.get("v1", null)?.patriot;
  if (!p || !p.end && !p.start) { if (msg) msg.replaceChildren("No patriot service dates are saved in the worksheet in this browser yet. ", el("a", { href: "/tools/lineage-matrix/#tb-patriot", text: "Add them in the worksheet's patriot step" }), "."); return false; }
  form.elements.serviceEnd.value = p.end || p.start;
  const k = kindOf(p.kind);
  if (msg) msg.textContent = `Filled in from your worksheet: ${p.name || "the patriot"}${p.state ? `, ${stateName(p.state)}` : ""}${k ? `, ${k.label.toLowerCase()}` : ""}, service ended ${p.end || p.start}. Add the marriage date and, if you know them, his months or days of service.`;
  if (!auto) form.elements.marriage.focus();
  return true;
}
function bindExample(root) {
  root.querySelector("[data-load-example]")?.addEventListener("click", () => {
    const d = root.querySelector("form[data-form=widow]");
    d.elements.marriage.value = "1777-05"; d.elements.serviceEnd.value = "1778-03"; d.elements.serviceMonths.value = "20"; d.elements.serviceDays.value = ""; d.elements.engagement.checked = true;
    runWidow(d, root.querySelector("[data-out=widow]"));
    const m = root.querySelector("[data-example-msg]"); if (m) m.textContent = "Example loaded: a made-up couple who married in May 1777; his service ended in March 1778. The results are in the table below.";
    root.querySelector("[data-out=widow]").focus();
  });
}
function bindClear(root) {
  root.querySelectorAll("[data-clear=toolA]").forEach((b) => b.addEventListener("click", () => {
    const n = store.clear(); ranThisVisit = null; root.querySelectorAll("form").forEach((f) => f.reset());
    root.querySelectorAll("[data-example-msg], [data-worksheet-msg]").forEach((m) => { m.textContent = ""; });
    const msg = n ? `Started over: deleted ${plural(n, "saved item")} from this browser.` : "Started over. Nothing was saved in this browser.";
    if (root.matches("[data-tool-report]")) { renderReport(root); root.querySelector("[data-report]").prepend(el("p", { class: "small", role: "status", text: msg })); }
    else root.querySelectorAll("[data-out]").forEach((o) => o.replaceChildren(el("p", { class: "small", role: "status", text: msg })));
    updatePlan(root); savedNotice(root);
  }));
}
function renderReport(root) {
  const d = store.get("widow", null);
  const body = root.querySelector("[data-report]");
  if (!d) { body.replaceChildren(el("p", { text: "Nothing saved in this browser yet. Open the checker, type the dates (or press \"Load an example\"), then come back." }),
    el("p", {}, el("a", { class: "button-link", href: "/tools/widow-pension-checker/", text: "Go to the Widow Pension Law Checker" }))); return; }
  body.replaceChildren(el("p", { class: "small", text: "These results compare your dates with the published pension laws. They are not a ruling: only your lineage society decides." }),
    el("h2", { text: "Widow pension and bounty-land laws" }), el("p", { class: "small", text: `Saved ${new Date(d.at).toLocaleString()}. Marriage: ${d.input.marriage || "—"}. His last service ended: ${d.input.serviceEnd || "—"}. Months of service: ${d.input.serviceMonths || "—"}. Days of service: ${d.input.serviceDays || "—"}. In a battle: ${d.input.engagement ? "yes" : "—"}.` }),
    renderWidow(d.result), renderPlan(nextSteps(null, d.result)));
}
document.querySelectorAll('[data-tool="widow"]').forEach((root) => { bindWidow(root); bindExample(root); bindClear(root); updatePlan(root);
  root.querySelector("[data-from-worksheet]")?.addEventListener("click", () => fromWorksheet(root));
  if (new URLSearchParams(location.search).get("from") === "worksheet") fromWorksheet(root, true); });
document.querySelectorAll('[data-tool-report="widow"]').forEach((root) => { renderReport(root); bindClear(root);
  root.querySelector("[data-print]")?.addEventListener("click", () => window.print()); });
