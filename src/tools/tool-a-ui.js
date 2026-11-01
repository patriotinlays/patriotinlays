// Tool A browser UI: service-window form, widow-act form, report page. localStorage key prefix "pi.toolA.".
import { checkServiceWindow, checkWidowActs, SERVICE_RULES, FIELD_HELP, nextSteps } from "./tool-a.js";
import { renderPlan } from "./plan-ui.js";
import { ns, el } from "./storage.js";
const store = ns("pi.toolA.");
// Badges are deliberately not green: a matching date is a starting point, never an approval.
const STATUS_LABEL = { consistent: "Dates fit the official period (not a ruling)", partial: "Partly inside the period", inconsistent: "Outside the period as typed", invalid: "Couldn't read the dates", not_evaluated: "Not checked" };
const WIDOW_LABEL = { ...STATUS_LABEL, consistent: "Fits this law's date rule (not a ruling)", partial: "Too rough to tell", inconsistent: "Doesn't fit as typed" };
const badge = (s, map = STATUS_LABEL) => el("span", { class: `badge b-${s}`, text: map[s] || s });

function renderWindow(r) {
  return el("div", { class: `result r-${r.status}` }, badge(r.status), el("p", { text: r.message }),
    r.rule ? el("p", { class: "small", text: `Type of service checked: ${r.rule}` }) : null, r.ruleNote ? el("p", { class: "small note", text: `Note: ${r.ruleNote}` }) : null,
    r.status === "consistent" ? el("p", { class: "small", text: "Only your lineage society can approve service. Step 2 below is optional and only matters if you're looking at a widow's pension." }) : null);
}
function renderWidow(rows) {
  if (rows.length === 1 && rows[0].act === "input") return el("div", { class: "result r-invalid" }, badge("invalid"), el("p", { text: rows[0].message }));
  const t = el("table", { class: "widow" }, el("thead", {}, el("tr", {}, el("th", { text: "Pension law" }), el("th", { text: "Result" }), el("th", { text: "The rule, and what to do next" }))));
  const tb = el("tbody");
  for (const r of rows) tb.append(el("tr", {}, el("td", { text: r.label || r.act }), el("td", {}, badge(r.status, WIDOW_LABEL), el("div", { class: "small", text: r.message })),
    el("td", {}, el("div", { class: "small", text: `Rule: ${r.ruleText || ""}` }),
      r.why && r.why !== "Missing information." ? el("div", { class: "small", text: r.why }) : null,
      r.next ? el("div", { class: "small next", text: r.next }) : null,
      r.uiNote ? el("div", { class: "small note", text: r.uiNote }) : null,
      r.nextNote ? el("div", { class: "small next", text: r.nextNote }) : null,
      r.links?.length ? el("ul", { class: "where-links small" }, ...r.links.map((l) => el("li", {}, el("a", { href: l.url, rel: "noopener", text: l.label })))) : null)));
  t.append(tb); return el("div", { class: "table-wrap" }, t);
}
// Rebuild the "What to do next" plan from whatever is saved in this browser.
function updatePlan(root) {
  const box = root.querySelector("[data-plan]"); if (!box) return;
  const w = store.get("window", null), d = store.get("widow", null);
  box.replaceChildren(renderPlan(nextSteps(w?.result || null, d?.result || null), { heading: false }));
}
function runWindow(form, out) {
  const f = Object.fromEntries(new FormData(form));
  const r = checkServiceWindow({ serviceType: f.serviceType, start: f.start, end: f.end || f.start });
  store.set("window", { input: f, result: r, at: new Date().toISOString() });
  out.replaceChildren(renderWindow(r)); updatePlan(form.closest("[data-tool]"));
}
function runWidow(form, out) {
  const f = Object.fromEntries(new FormData(form));
  const num = (v) => (v === "" || v == null ? null : Number(String(v).trim()));
  const input = { marriage: f.marriage || null, serviceEnd: f.serviceEnd || null, serviceMonths: num(f.serviceMonths), serviceDays: num(f.serviceDays), engagement: f.engagement === "on" ? true : null };
  const rows = checkWidowActs(input);
  store.set("widow", { input: { ...f, engagement: f.engagement === "on" }, result: rows, at: new Date().toISOString() });
  out.replaceChildren(renderWidow(rows)); updatePlan(form.closest("[data-tool]"));
}
function bindWindow(root) {
  const form = root.querySelector("form[data-form=window]"); if (!form) return;
  const out = root.querySelector("[data-out=window]");
  const saved = store.get("window", null);
  if (saved?.input) for (const [k, v] of Object.entries(saved.input)) if (form.elements[k]) form.elements[k].value = v;
  form.addEventListener("submit", (ev) => { ev.preventDefault(); runWindow(form, out); out.focus(); });
}
function bindWidow(root) {
  const form = root.querySelector("form[data-form=widow]"); if (!form) return;
  const out = root.querySelector("[data-out=widow]");
  // "Why it matters" lines come from FIELD_HELP (each tied to Source Manifest claims).
  for (const [k, h] of Object.entries(FIELD_HELP)) { const p = form.querySelector(`[data-why="${k}"]`); if (p) p.textContent = h.text; }
  const saved = store.get("widow", null);
  if (saved?.input) for (const [k, v] of Object.entries(saved.input)) if (form.elements[k] && form.elements[k].type !== "checkbox") form.elements[k].value = v; else if (form.elements[k]) form.elements[k].checked = !!v;
  form.addEventListener("submit", (ev) => { ev.preventDefault(); runWidow(form, out); out.focus(); });
}
// "Load an example": fills both forms with a made-up ancestor and shows the results immediately.
function bindExample(root) {
  root.querySelector("[data-load-example]")?.addEventListener("click", () => {
    const w = root.querySelector("form[data-form=window]"), d = root.querySelector("form[data-form=widow]");
    w.elements.serviceType.value = "core"; w.elements.start.value = "1776-07"; w.elements.end.value = "1778-03";
    runWindow(w, root.querySelector("[data-out=window]"));
    if (d) { d.elements.marriage.value = "1777-05"; d.elements.serviceEnd.value = "1778-03"; d.elements.serviceMonths.value = "20"; d.elements.serviceDays.value = ""; d.elements.engagement.checked = true;
      runWidow(d, root.querySelector("[data-out=widow]")); }
    const m = root.querySelector("[data-example-msg]"); if (m) m.textContent = "Example loaded: a made-up soldier who served July 1776 to March 1778. The results are shown under each step.";
    root.querySelector("[data-out=window]").focus();
  });
}
function bindClear(root) {
  root.querySelectorAll("[data-clear=toolA]").forEach((b) => b.addEventListener("click", () => {
    const n = store.clear(); root.querySelectorAll("form").forEach((f) => f.reset());
    root.querySelectorAll("[data-out]").forEach((o) => o.replaceChildren(el("p", { class: "small", text: `Cleared ${n} saved item(s) from this browser.` })));
    updatePlan(root); if (root.matches("[data-tool-report]")) renderReport(root);
  }));
}
function renderReport(root) {
  const w = store.get("window", null), d = store.get("widow", null);
  const body = root.querySelector("[data-report]");
  if (!w && !d) { body.replaceChildren(el("p", { text: "Nothing saved in this browser yet. Open the checker, type your dates (or press \"Load an example\"), then come back." }),
    el("p", {}, el("a", { class: "button-link", href: "/tools/service-window-checker/", text: "Go to the Service Window Checker" }))); return; }
  const kids = [el("p", { class: "small", text: "These results compare your dates with published rules. They are not a ruling: only your lineage society decides." })];
  if (w) kids.push(el("h2", { text: "Step 1: Service dates check" }), el("p", { class: "small", text: `Saved ${new Date(w.at).toLocaleString()}. Type of service: ${SERVICE_RULES.find((r) => r.id === w.input.serviceType)?.label || w.input.serviceType}. Dates: ${w.input.start || "?"} to ${w.input.end || w.input.start || "?"}.` }), renderWindow(w.result));
  if (d) kids.push(el("h2", { text: "Step 2: Widow pension and bounty-land laws" }), el("p", { class: "small", text: `Saved ${new Date(d.at).toLocaleString()}. Marriage: ${d.input.marriage || "—"}. His last service ended: ${d.input.serviceEnd || "—"}. Months of service: ${d.input.serviceMonths || "—"}. Days of service: ${d.input.serviceDays || "—"}. In a battle: ${d.input.engagement ? "yes" : "—"}.` }), renderWidow(d.result));
  kids.push(renderPlan(nextSteps(w?.result || null, d?.result || null)));
  body.replaceChildren(...kids);
}
document.querySelectorAll('[data-tool="service-window"]').forEach((root) => { bindWindow(root); bindWidow(root); bindExample(root); bindClear(root); updatePlan(root); });
document.querySelectorAll('[data-tool-report="service-window"]').forEach((root) => { renderReport(root); bindClear(root);
  root.querySelector("[data-print]")?.addEventListener("click", () => window.print()); });
