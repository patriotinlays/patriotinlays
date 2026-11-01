// Tool B browser UI: Lineage Evidence Matrix editor, embed card, and report page.
// State lives only in localStorage under "pi.toolB.v1"; no network requests are made.
import { actionPlan, evaluateCell, gaps, LABELS, FACTS, FACT_LABELS, DOC_TYPES, MODE_HELP, genLabel, genTitle, isEmptyCell } from "./tool-b.js";
import { ns, el } from "./storage.js";
import { renderPlan } from "./plan-ui.js";
const store = ns("pi.toolB.");
const blank = () => ({ version: 1, generations: [newGen(1), newGen(2)], updated: null });
function newGen(gen) { return { gen, who: "", living: gen === 1, cells: [] }; }
let uid = 0; const newCell = (o = {}) => ({ id: `c${Date.now().toString(36)}${(uid++).toString(36)}`, fact: "", docType: "", mode: "", conflict: false, citation: "", ...o });
const load = () => { const s = store.get("v1", null); return s && Array.isArray(s.generations) ? s : blank(); };
const save = (s) => { s.updated = new Date().toISOString(); store.set("v1", s); };
const labelClass = (l) => l === LABELS.entered ? "b-entered" : l === LABELS.conflict ? "b-conflict" : l === LABELS.incomplete ? "b-incomplete" : "b-none";
const MODE_TEXT = { direct: "Says it in words", indirect: "Only hints at it" };

// Made-up example family so a visitor can see results right away.
const EXAMPLE = () => ({ version: 1, updated: null, example: true, generations: [
  { gen: 1, who: "Example: Jane (made up)", living: true, cells: [
    newCell({ fact: "birth", docType: "birth_cert_long", mode: "direct", citation: "Long-form birth certificate, state vital records office" }),
    newCell({ fact: "parentage", docType: "birth_cert_long", mode: "direct", citation: "Same long-form birth certificate, names her father Robert" })] },
  { gen: 2, who: "Example: Robert (made up)", living: false, cells: [
    newCell({ fact: "birth", docType: "birth_cert_long", mode: "direct", citation: "Long-form birth certificate, county clerk, book 4 page 88" }),
    newCell({ fact: "parentage", docType: "census_1850_1870", mode: "indirect", citation: "Census, county and page as on image, Robert in William's household" })] },
  { gen: 3, who: "Example: William (made up)", living: false, cells: [
    newCell({ fact: "death", docType: "death_cert", mode: "direct", citation: "Death certificate, state archives, certificate 1234" })] },
  { gen: 4, who: "Example: John, the patriot (made up)", living: false, cells: [
    newCell({ fact: "parentage", docType: "probate", mode: "direct", citation: "Will of John, county will book 2, page 40, names his son William" })] },
] });

function select(name, options, value, label, id) {
  const s = el("select", { name, id }, el("option", { value: "", text: `— ${label} —` }));
  for (const [v, t] of options) s.append(el("option", { value: v, text: t, selected: v === value }));
  return s;
}
const statusKids = (ev) => [el("span", { class: `badge ${labelClass(ev.label)}`, text: ev.label }),
  ...ev.issues.map((i) => el("div", { class: "small issue", text: i })), ...ev.cautions.map((k) => el("div", { class: "small caution", text: k.text }))];

// "Where to look" block shared by the editor and the report.
export function whereBlock(w) {
  if (!w) return null;
  const links = [...w.links.map((l) => el("li", {}, el("a", { href: l.url, rel: "noopener", text: l.label }))),
    ...w.guides.map((g) => el("li", {}, "Our guide: ", el("a", { href: g.url, text: g.label })))];
  return el("div", { class: "where" }, el("strong", { text: "Where to look: " }), w.text ? `${w.text} ` : "", w.registrar,
    links.length ? el("ul", { class: "where-links" }, ...links) : null);
}
function renderGaps(state) {
  const list = gaps(state.generations);
  if (!list.length) return el("p", { class: "small", text: "Nothing missing by the tool's rules. That is not a proof: a society's genealogist still reviews every entry." });
  return el("ol", { class: "gaps" }, ...list.map((g) => el("li", { class: g.priority === 0 ? "conflict" : "" }, el("div", { class: "gap-text", text: g.text }), whereBlock(g.where))));
}

function cellEditor(state, g, c, rerender, n) {
  const ev = evaluateCell(c);
  const base = `g${g.gen}-${c.id}`;
  const upd = (k, v) => { c[k] = v; save(state); rerender(); };
  const modeGroup = el("fieldset", { class: "mode" }, el("legend", { text: "C. Does the record say it in words, or only hint at it?" }),
    ...["direct", "indirect"].map((v) => el("label", { class: "choice" },
      el("input", { type: "radio", name: `${base}-mode`, value: v, checked: c.mode === v, onchange: () => upd("mode", v) }),
      el("span", {}, el("strong", { text: MODE_TEXT[v] }), el("span", { class: "small", text: ` ${MODE_HELP[v]}` })))));
  return el("div", { class: "cell", "data-cell": c.id },
    el("p", { class: "cell-h", text: `Record ${n}` }),
    el("label", { for: `${base}-fact`, text: "A. What does this record show?" }), select("fact", FACTS.map((f) => [f, FACT_LABELS[f]]), c.fact, "pick one", `${base}-fact`),
    el("label", { for: `${base}-doc`, text: "B. What kind of record is it?" }), select("docType", Object.entries(DOC_TYPES), c.docType, "pick one", `${base}-doc`),
    modeGroup,
    el("label", { for: `${base}-cite`, text: "D. Where did you find it?" }),
    el("p", { class: "small hint", text: "A few words so you can find it again, e.g. \"county courthouse, will book 3, page 12\"." }),
    el("input", { id: `${base}-cite`, name: "citation", type: "text", value: c.citation, autocomplete: "off" }),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "conflict", checked: c.conflict, onchange: (e) => upd("conflict", e.target.checked) }), " This record disagrees with another record (for example, a different date)"),
    el("div", { class: "status", "aria-live": "polite" }, ...statusKids(ev)),
    el("button", { type: "button", class: "link danger", onclick: () => { g.cells = g.cells.filter((x) => x !== c); save(state); rerender(); }, text: "Remove this record" }));
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
      cellEl.querySelector(".status").replaceChildren(...statusKids(evaluateCell(c))); }
  });
}
function mountEditor(root) {
  const state = load(); const box = root.querySelector("[data-matrix]"); const gapBox = root.querySelector("[data-gaps]");
  const msg = root.querySelector("[data-cleared]");
  const rerender = () => {
    const focusId = document.activeElement?.id;
    const last = state.generations.length;
    box.replaceChildren(...state.generations.map((g) => el("section", { class: "gen", "data-gen": g.gen },
      el("h3", { text: genTitle(g.gen) }),
      el("p", { class: "small hint", text: g.gen === 1 ? "Generation 1 is always you, the person applying." :
        g.gen === last ? `Each generation is one step further back. Is this person the patriot? If not, press "Add an older generation" below.` :
        `The parent of the person in generation ${g.gen - 1}, in the line that leads to the patriot.` }),
      el("label", { for: `who-${g.gen}`, text: "Name (optional, stays in this browser)" }),
      el("input", { id: `who-${g.gen}`, type: "text", value: g.who, autocomplete: "off", oninput: (e) => { g.who = e.target.value; save(state); } }),
      el("label", { class: "check" }, el("input", { type: "checkbox", id: `living-${g.gen}`, checked: g.living, onchange: (e) => { g.living = e.target.checked; save(state); rerender(); } }), " Still living (then no death record is needed)"),
      ...g.cells.map((c, i) => cellEditor(state, g, c, rerender, i + 1)),
      el("button", { type: "button", "data-add-evidence": g.gen, onclick: () => addRecord(g), text: `+ Add a record for ${genLabel(g.gen).toLowerCase()}` }))));
    gapBox.replaceChildren(renderGaps(state));
    root.querySelector("[data-plan]")?.replaceChildren(renderPlan(actionPlan(state.generations), { heading: false }));
    if (focusId) document.getElementById(focusId)?.focus();
  };
  // Never stack blank records: if this generation already has an empty one, send the visitor to it instead.
  const addRecord = (g) => {
    const empty = g.cells.find(isEmptyCell);
    if (empty) { const f = document.getElementById(`g${g.gen}-${empty.id}-fact`); f?.focus(); f?.scrollIntoView({ block: "center" });
      if (msg) msg.textContent = `Fill in the empty record for ${genLabel(g.gen).toLowerCase()} first.`; return; }
    const c = newCell(); g.cells.push(c); save(state); rerender(); document.getElementById(`g${g.gen}-${c.id}-fact`)?.focus();
    if (msg) msg.textContent = "";
  };
  bindEditorEvents(box, state, rerender);
  root.querySelector("[data-add-gen]").addEventListener("click", () => { state.generations.push(newGen(state.generations.length + 1)); save(state); rerender(); });
  root.querySelector("[data-remove-gen]").addEventListener("click", () => { if (state.generations.length > 2) { state.generations.pop(); save(state); rerender(); } });
  root.querySelector("[data-load-example]")?.addEventListener("click", () => {
    const hasData = state.generations.some((g) => g.cells.length || g.who);
    if (hasData && !confirm("Replace what you've entered with the made-up example?")) return;
    const ex = EXAMPLE(); state.generations = ex.generations; save(state); rerender();
    if (msg) msg.textContent = "Example loaded (a made-up family). Scroll down to step 3 to see what's missing and where to look.";
  });
  root.querySelector("[data-clear=toolB]").addEventListener("click", () => {
    if (!confirm("Delete all Lineage Evidence Matrix data saved in this browser?")) return;
    store.clear(); const fresh = blank(); state.generations = fresh.generations; rerender();
    msg.textContent = "All matrix data was deleted from this browser.";
  });
  rerender();
}
function mountCard(root) {
  const s = store.get("v1", null); const out = root.querySelector("[data-card-status]");
  if (!s) { out.textContent = "Nothing saved in this browser yet."; return; }
  const n = s.generations.reduce((a, g) => a + g.cells.length, 0);
  out.textContent = `Saved in this browser: ${s.generations.length} generations, ${n} evidence entries, ${gaps(s.generations).length} things still missing or flagged.`;
}
function mountReport(root) {
  const s = store.get("v1", null); const body = root.querySelector("[data-report]");
  if (!s) { body.replaceChildren(el("p", { text: "Nothing saved in this browser yet. Open the Lineage Evidence Matrix, enter what you have (or press \"Load an example\"), then come back." }),
    el("p", {}, el("a", { class: "button-link", href: "/tools/lineage-matrix/", text: "Go to the Lineage Evidence Matrix" }))); return; }
  const kids = [el("p", { class: "small", text: `Saved ${s.updated ? new Date(s.updated).toLocaleString() : ""}. This is your own worksheet, not a decision: a society's genealogists review every entry.` }),
    renderPlan(actionPlan(s.generations)),
    el("h2", { text: "What's still missing, and where to look" }), renderGaps(s), el("h2", { text: "Your records, generation by generation" })];
  for (const g of s.generations) {
    const rows = g.cells.map((c) => { const ev = evaluateCell(c);
      return el("tr", {}, el("td", { text: FACT_LABELS[c.fact] || "—" }), el("td", { text: DOC_TYPES[c.docType] || "—" }), el("td", { text: MODE_TEXT[c.mode] || "—" }),
        el("td", { text: c.citation || "—" }), el("td", {}, el("span", { class: `badge ${labelClass(ev.label)}`, text: ev.label }), ...ev.cautions.map((k) => el("div", { class: "small caution", text: k.text })))); });
    kids.push(el("h3", { text: `${genTitle(g.gen)}${g.who ? ` — ${g.who}` : ""}${g.living ? " (living)" : ""}` }),
      rows.length ? el("div", { class: "table-wrap" }, el("table", {}, el("thead", {}, el("tr", {}, ...["What it shows", "Kind of record", "Says it in words?", "Where you found it", "Status"].map((h) => el("th", { text: h })))), el("tbody", {}, ...rows)))
        : el("p", { class: "small", text: "No records entered yet." }));
  }
  body.replaceChildren(...kids);
}
document.querySelectorAll('[data-tool="lineage-matrix"]').forEach(mountEditor);
document.querySelectorAll('[data-tool-card="lineage-matrix"]').forEach(mountCard);
document.querySelectorAll('[data-tool-report="lineage-matrix"]').forEach((root) => { mountReport(root);
  root.querySelector("[data-print]")?.addEventListener("click", () => window.print());
  root.querySelector("[data-clear=toolB]")?.addEventListener("click", () => { if (!confirm("Delete all Lineage Evidence Matrix data saved in this browser?")) return; store.clear(); mountReport(root); }); });
