// Tool B browser UI: Lineage Evidence Matrix editor, embed card, and report page.
// State lives only in localStorage under "pi.toolB.v1"; no network requests are made.
import { evaluateCell, gaps, LABELS, FACTS, DOC_TYPES } from "./tool-b.js";
import { ns, el } from "./storage.js";
const store = ns("pi.toolB.");
const blank = () => ({ version: 1, generations: [newGen(1), newGen(2)], updated: null });
function newGen(gen) { return { gen, who: "", living: false, cells: [] }; }
let uid = 0; const newCell = () => ({ id: `c${Date.now().toString(36)}${(uid++).toString(36)}`, fact: "", docType: "", mode: "", conflict: false, citation: "" });
const load = () => { const s = store.get("v1", null); return s && Array.isArray(s.generations) ? s : blank(); };
const save = (s) => { s.updated = new Date().toISOString(); store.set("v1", s); };
const labelClass = (l) => l === LABELS.entered ? "b-entered" : l === LABELS.conflict ? "b-conflict" : l === LABELS.incomplete ? "b-incomplete" : "b-none";
const genName = (g) => g.gen === 1 ? "Generation 1 (you, the applicant)" : g.gen === 2 ? "Generation 2 (your parents)" : g.gen === 3 ? "Generation 3 (grandparents)" : `Generation ${g.gen}`;

function select(name, options, value, label, id) {
  const s = el("select", { name, id, "aria-label": label }, el("option", { value: "", text: `— ${label} —` }));
  for (const [v, t] of options) s.append(el("option", { value: v, text: t, selected: v === value }));
  return s;
}
function cellEditor(state, g, c, rerender) {
  const ev = evaluateCell(c);
  const base = `g${g.gen}-${c.id}`;
  const upd = (k, v) => { c[k] = v; save(state); rerender(); };
  const modeGroup = el("fieldset", { class: "mode" }, el("legend", { class: "small", text: "Does the document state the fact?" }),
    ...[["direct", "States it directly"], ["indirect", "Only implies it"]].map(([v, t]) => el("label", {},
      el("input", { type: "radio", name: `${base}-mode`, value: v, checked: c.mode === v, onchange: () => upd("mode", v) }), " ", t)));
  return el("div", { class: "cell", "data-cell": c.id },
    el("div", { class: "row" },
      el("label", { for: `${base}-fact` , class: "small", text: "Fact" }), select("fact", FACTS.map((f) => [f, f[0].toUpperCase() + f.slice(1)]), c.fact, "Fact claimed", `${base}-fact`),
      el("label", { for: `${base}-doc`, class: "small", text: "Document" }), select("docType", Object.entries(DOC_TYPES), c.docType, "Document type", `${base}-doc`)),
    modeGroup,
    el("label", { class: "small", for: `${base}-cite`, text: "Citation (record, repository, page or image)" }),
    el("input", { id: `${base}-cite`, name: "citation", type: "text", value: c.citation, autocomplete: "off" }),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "conflict", checked: c.conflict, onchange: (e) => upd("conflict", e.target.checked) }), " Conflicts with another record"),
    el("div", { class: "status", "aria-live": "polite" }, el("span", { class: `badge ${labelClass(ev.label)}`, text: ev.label }),
      ...ev.issues.map((i) => el("div", { class: "small issue", text: i })), ...ev.cautions.map((k) => el("div", { class: "small caution", text: k.text }))),
    el("button", { type: "button", class: "link danger", onclick: () => { g.cells = g.cells.filter((x) => x !== c); save(state); rerender(); }, text: "Remove this evidence" }));
}
function bindEditorEvents(container, state, rerender) {
  container.addEventListener("change", (e) => {
    const cellEl = e.target.closest("[data-cell]"); if (!cellEl) return;
    const name = e.target.name; if (!["fact", "docType"].includes(name)) return;
    for (const g of state.generations) for (const c of g.cells) if (c.id === cellEl.dataset.cell) { c[name] = e.target.value; save(state); rerender(); return; }
  });
  container.addEventListener("input", (e) => {
    if (e.target.name !== "citation") return; const cellEl = e.target.closest("[data-cell]");
    for (const g of state.generations) for (const c of g.cells) if (c.id === cellEl.dataset.cell) { c.citation = e.target.value; save(state);
      const ev = evaluateCell(c); const st = cellEl.querySelector(".status");
      st.replaceChildren(el("span", { class: `badge ${labelClass(ev.label)}`, text: ev.label }), ...ev.issues.map((i) => el("div", { class: "small issue", text: i })), ...ev.cautions.map((k) => el("div", { class: "small caution", text: k.text }))); }
  });
}
function renderGaps(state) {
  const list = gaps(state.generations);
  if (!list.length) return el("p", { class: "small", text: "No gaps found by the tool's rules. That is not a proof: a society's genealogist still reviews every entry." });
  return el("ol", { class: "gaps" }, ...list.map((g) => el("li", { class: g.priority === 0 ? "conflict" : "", text: g.text })));
}
function mountEditor(root) {
  const state = load(); const box = root.querySelector("[data-matrix]"); const gapBox = root.querySelector("[data-gaps]");
  const rerender = () => {
    const focusId = document.activeElement?.id;
    box.replaceChildren(...state.generations.map((g) => el("section", { class: "gen", "data-gen": g.gen },
      el("h3", { text: genName(g) }),
      el("div", { class: "row" },
        el("label", { class: "small", for: `who-${g.gen}`, text: "Who (optional, stays in this browser)" }),
        el("input", { id: `who-${g.gen}`, type: "text", value: g.who, autocomplete: "off", oninput: (e) => { g.who = e.target.value; save(state); } }),
        el("label", { class: "check" }, el("input", { type: "checkbox", checked: g.living, onchange: (e) => { g.living = e.target.checked; save(state); rerender(); } }), " Living")),
      ...g.cells.map((c) => cellEditor(state, g, c, rerender)),
      el("button", { type: "button", "data-add-evidence": g.gen, onclick: () => { g.cells.push(newCell()); save(state); rerender(); }, text: `Add evidence to generation ${g.gen}` }))));
    gapBox.replaceChildren(renderGaps(state));
    if (focusId) document.getElementById(focusId)?.focus();
  };
  bindEditorEvents(box, state, rerender);
  root.querySelector("[data-add-gen]").addEventListener("click", () => { state.generations.push(newGen(state.generations.length + 1)); save(state); rerender(); });
  root.querySelector("[data-remove-gen]").addEventListener("click", () => { if (state.generations.length > 2) { state.generations.pop(); save(state); rerender(); } });
  root.querySelector("[data-clear=toolB]").addEventListener("click", () => {
    if (!confirm("Delete all Lineage Evidence Matrix data saved in this browser?")) return;
    store.clear(); const fresh = blank(); state.generations = fresh.generations; rerender();
    root.querySelector("[data-cleared]").textContent = "All matrix data was deleted from this browser.";
  });
  rerender();
}
function mountCard(root) {
  const s = store.get("v1", null); const out = root.querySelector("[data-card-status]");
  if (!s) { out.textContent = "Nothing saved in this browser yet."; return; }
  const n = s.generations.reduce((a, g) => a + g.cells.length, 0);
  out.textContent = `Saved in this browser: ${s.generations.length} generations, ${n} evidence entries, ${gaps(s.generations).length} open gaps or flags.`;
}
function mountReport(root) {
  const s = store.get("v1", null); const body = root.querySelector("[data-report]");
  if (!s) { body.replaceChildren(el("p", { text: "No matrix saved in this browser yet. Open the Lineage Evidence Matrix and enter some evidence first." })); return; }
  const kids = [el("p", { class: "small", text: `Saved ${s.updated ? new Date(s.updated).toLocaleString() : ""}. Every entry below still needs review by the society's genealogists.` }),
    el("h2", { text: "Open gaps and flags" }), renderGaps(s), el("h2", { text: "Evidence by generation" })];
  for (const g of s.generations) {
    const rows = g.cells.map((c) => { const ev = evaluateCell(c);
      return el("tr", {}, el("td", { text: c.fact || "—" }), el("td", { text: DOC_TYPES[c.docType] || "—" }), el("td", { text: c.mode || "—" }),
        el("td", { text: c.citation || "—" }), el("td", {}, el("span", { class: `badge ${labelClass(ev.label)}`, text: ev.label }), ...ev.cautions.map((k) => el("div", { class: "small caution", text: k.text })))); });
    kids.push(el("h3", { text: `${genName(g)}${g.who ? ` — ${g.who}` : ""}${g.living ? " (living)" : ""}` }),
      rows.length ? el("div", { class: "table-wrap" }, el("table", {}, el("thead", {}, el("tr", {}, ...["Fact", "Document", "Direct/indirect", "Citation", "Label"].map((h) => el("th", { text: h })))), el("tbody", {}, ...rows)))
        : el("p", { class: "small", text: "No evidence entered." }));
  }
  body.replaceChildren(...kids);
  root.querySelector("[data-print]")?.addEventListener("click", () => window.print());
  root.querySelector("[data-clear=toolB]")?.addEventListener("click", () => { if (!confirm("Delete all Lineage Evidence Matrix data saved in this browser?")) return; store.clear(); mountReport(root); });
}
document.querySelectorAll('[data-tool="lineage-matrix"]').forEach(mountEditor);
document.querySelectorAll('[data-tool-card="lineage-matrix"]').forEach(mountCard);
document.querySelectorAll('[data-tool-report="lineage-matrix"]').forEach(mountReport);
