// Tool A browser UI: service-window form, widow-act form, report page. localStorage key prefix "pi.toolA.".
import { checkServiceWindow, checkWidowActs, SERVICE_RULES } from "./tool-a.js";
import { ns, el } from "./storage.js";
const store = ns("pi.toolA.");
const STATUS_LABEL = { consistent: "Consistent with published rule", partial: "Partly inside the rule", inconsistent: "Outside the rule as entered", invalid: "Could not evaluate", not_evaluated: "Not evaluated" };
const badge = (s) => el("span", { class: `badge b-${s}`, text: STATUS_LABEL[s] || s });

function renderWindow(r) {
  return el("div", { class: `result r-${r.status}` }, badge(r.status), el("p", { text: r.message }),
    r.rule ? el("p", { class: "small", text: `Rule: ${r.rule}` }) : null, r.ruleNote ? el("p", { class: "small note", text: `Note: ${r.ruleNote}` }) : null);
}
function renderWidow(rows) {
  const t = el("table", { class: "widow" }, el("thead", {}, el("tr", {}, el("th", { text: "Act" }), el("th", { text: "Result" }), el("th", { text: "Published rule / note" }))));
  const tb = el("tbody");
  for (const r of rows) tb.append(el("tr", {}, el("td", { text: r.label || r.act }), el("td", {}, badge(r.status), el("div", { class: "small", text: r.message })),
    el("td", {}, el("div", { class: "small", text: r.ruleText || "" }), r.uiNote ? el("div", { class: "small note", text: r.uiNote }) : null)));
  t.append(tb); return el("div", { class: "table-wrap" }, t);
}
function bindWindow(root) {
  const form = root.querySelector("form[data-form=window]"); if (!form) return;
  const out = root.querySelector("[data-out=window]");
  const saved = store.get("window", null);
  if (saved?.input) for (const [k, v] of Object.entries(saved.input)) if (form.elements[k]) form.elements[k].value = v;
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const r = checkServiceWindow({ serviceType: f.serviceType, start: f.start, end: f.end || f.start });
    store.set("window", { input: f, result: r, at: new Date().toISOString() });
    out.replaceChildren(renderWindow(r)); out.focus();
  });
}
function bindWidow(root) {
  const form = root.querySelector("form[data-form=widow]"); if (!form) return;
  const out = root.querySelector("[data-out=widow]");
  const saved = store.get("widow", null);
  if (saved?.input) for (const [k, v] of Object.entries(saved.input)) if (form.elements[k] && form.elements[k].type !== "checkbox") form.elements[k].value = v; else if (form.elements[k]) form.elements[k].checked = !!v;
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const num = (v) => (v === "" || v == null ? null : Number(v));
    const input = { marriage: f.marriage || null, serviceEnd: f.serviceEnd || null, serviceMonths: num(f.serviceMonths), serviceDays: num(f.serviceDays), engagement: f.engagement === "on" ? true : null };
    const rows = checkWidowActs(input);
    store.set("widow", { input: { ...f, engagement: f.engagement === "on" }, result: rows, at: new Date().toISOString() });
    out.replaceChildren(renderWidow(rows)); out.focus();
  });
}
function bindClear(root) {
  root.querySelectorAll("[data-clear=toolA]").forEach((b) => b.addEventListener("click", () => {
    const n = store.clear(); root.querySelectorAll("form").forEach((f) => f.reset());
    root.querySelectorAll("[data-out]").forEach((o) => o.replaceChildren(el("p", { class: "small", text: `Cleared ${n} saved item(s) from this browser.` })));
  }));
}
function renderReport(root) {
  const w = store.get("window", null), d = store.get("widow", null);
  const body = root.querySelector("[data-report]");
  if (!w && !d) { body.replaceChildren(el("p", { text: "No saved checks in this browser yet. Run the checker first." })); return; }
  const kids = [];
  if (w) kids.push(el("h2", { text: "Service window check" }), el("p", { class: "small", text: `Saved ${new Date(w.at).toLocaleString()}. Service type: ${SERVICE_RULES.find((r) => r.id === w.input.serviceType)?.label || w.input.serviceType}; dates: ${w.input.start || "?"} to ${w.input.end || w.input.start || "?"}.` }), renderWindow(w.result));
  if (d) kids.push(el("h2", { text: "Widow pension and bounty-land acts" }), el("p", { class: "small", text: `Saved ${new Date(d.at).toLocaleString()}. Marriage: ${d.input.marriage || "—"}; last service ended: ${d.input.serviceEnd || "—"}; months: ${d.input.serviceMonths || "—"}; days: ${d.input.serviceDays || "—"}; engagement: ${d.input.engagement ? "yes" : "—"}.` }), renderWidow(d.result));
  body.replaceChildren(...kids);
}
document.querySelectorAll('[data-tool="service-window"]').forEach((root) => { bindWindow(root); bindWidow(root); bindClear(root); });
document.querySelectorAll('[data-tool-report="service-window"]').forEach((root) => { renderReport(root); bindClear(root);
  root.querySelector("[data-print]")?.addEventListener("click", () => window.print()); });
