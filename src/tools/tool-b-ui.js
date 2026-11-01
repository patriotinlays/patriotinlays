// Tool B browser UI: Lineage Evidence Matrix editor, embed card, and report page.
// State lives only in localStorage under "pi.toolB.v1"; no network requests are made.
import { actionPlan, evaluateCell, gaps, groupGaps, filledCells, countEntries, patriotGen, LABELS, FACTS, FACT_LABELS, DOC_TYPES, MODE_HELP, genLabel, genTitle, isEmptyCell } from "./tool-b.js";
import { SERVICE_KINDS, PATRIOT_HELP, patriotDates, hasPatriot, kindOf } from "./patriot.js";
import { STATES, stateName } from "./places.js";
import { ns, el } from "./storage.js";
import { renderPlan } from "./plan-ui.js";
const store = ns("pi.toolB.");
const blank = () => ({ version: 1, generations: [newGen(1), newGen(2)], patriot: newPatriot(), updated: null });
function newGen(gen) { return { gen, who: "", living: gen === 1, born: "", died: "", state: "", cells: [] }; }
const newPatriot = () => ({ name: "", state: "", unit: "", kind: "", start: "", end: "", gen: "" });
let uid = 0; const newCell = (o = {}) => ({ id: `c${Date.now().toString(36)}${(uid++).toString(36)}`, fact: "", docType: "", mode: "", conflict: false, citation: "", ...o });
const load = () => { const s = store.get("v1", null); if (!s || !Array.isArray(s.generations)) return blank(); s.patriot = { ...newPatriot(), ...(s.patriot || {}) }; return s; };
const save = (s) => { s.updated = new Date().toISOString(); store.set("v1", s); };
const labelClass = (l) => l === LABELS.entered ? "b-entered" : l === LABELS.conflict ? "b-conflict" : l === LABELS.incomplete ? "b-incomplete" : "b-none";
const MODE_TEXT = { direct: "Says it in words", indirect: "Only hints at it" };

// Made-up example family so a visitor can see results right away (a Virginia militiaman and four generations after him).
const EXAMPLE = () => ({ version: 1, updated: null, example: true,
  patriot: { name: "John (made up)", state: "VA", unit: "Culpeper County militia (made up)", kind: "militia", start: "1777-05", end: "1779-10", gen: "5" },
  generations: [
  { gen: 1, who: "Example: Jane (made up)", living: true, born: "1948", died: "", state: "PA", cells: [
    newCell({ fact: "birth", docType: "birth_cert_long", mode: "direct", citation: "Long-form birth certificate, state vital records office" }),
    newCell({ fact: "parentage", docType: "birth_cert_long", mode: "direct", citation: "Same long-form birth certificate, names her father Robert" })] },
  { gen: 2, who: "Example: Robert (made up)", living: false, born: "1915", died: "1990", state: "PA", cells: [
    newCell({ fact: "birth", docType: "birth_cert_long", mode: "direct", citation: "Long-form birth certificate, county clerk, book 4 page 88" }),
    newCell({ fact: "parentage", docType: "census_1850_1870", mode: "indirect", citation: "Census, county and page as on image, Robert in William's household" })] },
  { gen: 3, who: "Example: William (made up)", living: false, born: "1878", died: "1940", state: "VA", cells: [
    newCell({ fact: "death", docType: "death_cert", mode: "direct", citation: "Death certificate, state archives, certificate 1234" })] },
  { gen: 4, who: "Example: Thomas (made up)", living: false, born: "1810", died: "1880", state: "VA", cells: [
    newCell({ fact: "parentage", docType: "probate", mode: "direct", citation: "Will of Thomas, county will book 9, page 12, names his son William" })] },
  { gen: 5, who: "Example: John, the patriot (made up)", living: false, born: "1755", died: "1838", state: "VA", cells: [
    newCell({ fact: "parentage", docType: "probate", mode: "direct", citation: "Will of John, county will book 2, page 40, names his son Thomas" })] },
] });

function select(name, options, value, label, id) {
  const s = el("select", { name, id }, el("option", { value: "", text: `— ${label} —` }));
  for (const [v, t] of options) s.append(el("option", { value: v, text: t, selected: v === value }));
  return s;
}
// Blank records get a plain prompt instead of a label; they are never labelled or counted.
const statusFor = (c) => isEmptyCell(c) ? [el("div", { class: "small hint", "data-blank": "", text: "Empty record: answer A to D, or remove it." })] : statusKids(evaluateCell(c));
const statusKids = (ev) => [el("span", { class: `badge ${labelClass(ev.label)}`, text: ev.label }),
  ...ev.issues.map((i) => el("div", { class: "small issue", text: i })), ...ev.cautions.map((k) => el("div", { class: "small caution", text: k.text }))];

// "Where to look" block shared by the editor and the report. Notes carry the era- and state-specific facts.
export function whereBlock(w) {
  if (!w) return null;
  const links = [...w.links.map((l) => el("li", {}, el("a", { href: l.url, rel: "noopener", text: l.label }))),
    ...w.guides.map((g) => el("li", {}, "Our guide: ", el("a", { href: g.url, text: g.label })))];
  return el("div", { class: "where" }, el("strong", { text: "Where to look: " }), w.text ? `${w.text} ` : "", w.registrar,
    ...(w.notes || []).map((n) => el("p", { class: `where-note note-${n.kind || "info"}`, "data-note": n.kind || "info", text: n.text })),
    links.length ? el("ul", { class: "where-links" }, ...links) : null);
}
function renderGaps(state) {
  const list = gaps(state.generations, state.patriot);
  if (!list.length) return el("p", { class: "small", text: "Nothing missing by the tool's rules. That is not a proof: a society's genealogist still reviews every entry." });
  // Each generation is listed once, in order, with its items under it.
  return el("ol", { class: "gaps" }, ...groupGaps(list, patriotGen(state.generations, state.patriot)).map((grp) => el("li", { class: "gap-gen", "data-gap-gen": grp.gen ?? "" }, el("strong", { class: "gap-gen-h", text: grp.title }),
    el("ul", { class: "gap-items" }, ...grp.items.map((g) => el("li", { class: g.priority === 0 ? "conflict" : "" }, el("div", { class: "gap-text", text: g.short }), whereBlock(g.where)))))));
}
const stateOptions = () => STATES.map(([c, n]) => [c, n]);
// The patriot's date check, in plain words (the old standalone service-date check, folded into this step).
function patriotCheckEl(p) {
  const d = patriotDates(p);
  if (!d) return el("p", { class: "small hint", text: "Type his rough service dates to check them against the period DAR accepts for his type of service." });
  const label = { consistent: "Dates fit DAR's period for this service (not a ruling)", partial: "Partly inside the period", inconsistent: "Outside the period as typed", invalid: "Couldn't read the dates" }[d.status];
  return el("div", { class: `result r-${d.status}` }, el("span", { class: `badge b-${d.status}`, text: label }), el("p", { text: d.plain }),
    el("p", { class: "small", text: `Period checked: ${d.rule || ""}` }),
    p.end ? el("p", { class: "small" }, "His service end date can feed the ", el("a", { href: "/tools/widow-pension-checker/?from=worksheet", "data-to-widow": "", text: "widow-pension check" }), ".") : null);
}
function patriotForm(state, refresh) {
  const p = state.patriot; const set = (k, v) => { p[k] = v; save(state); refresh(); };
  const inp = (k, label, hint, attrs = {}) => [el("label", { for: `pat-${k}`, text: label }), hint ? el("p", { class: "small hint", text: hint }) : null,
    el("input", { id: `pat-${k}`, name: k, type: "text", value: p[k] || "", autocomplete: "off", oninput: (e) => set(k, e.target.value.trim()), ...attrs })];
  const sel = (k, label, opts, hint) => [el("label", { for: `pat-${k}`, text: label }), hint ? el("p", { class: "small hint", text: hint }) : null,
    (() => { const x = select(k, opts, p[k], "pick one", `pat-${k}`); x.addEventListener("change", (e) => set(k, e.target.value)); return x; })()];
  const gens = state.generations.map((g) => [String(g.gen), genTitle(g.gen)]);
  return el("div", { class: "patriot-form", "data-patriot-form": "" },
    ...inp("name", "His name (optional, stays in this browser)"),
    ...sel("state", "State or colony he served for", stateOptions(), PATRIOT_HELP.state.text),
    ...inp("unit", "Unit or company (optional)", "For example a county militia company or a numbered regiment, if you know it."),
    ...sel("kind", "Type of service", SERVICE_KINDS.map((k) => [k.id, k.label]), PATRIOT_HELP.kind.text),
    ...inp("start", "Service started (rough date)", "Numbers only, e.g. 1777 or 1777-05.", { inputmode: "numeric", placeholder: "e.g. 1777 or 1777-05" }),
    ...inp("end", "Service ended (rough date; blank if you only have one date)", null, { inputmode: "numeric", placeholder: "e.g. 1779 or 1779-10" }),
    ...sel("gen", "Which generation is he?", gens, "Leave this on \"pick one\" if he is your oldest generation."),
    el("div", { "data-patriot-check": "", "aria-live": "polite" }, patriotCheckEl(p)));
}
const genFields = (state, g, refresh) => {
  const upd = (k) => (e) => { g[k] = e.target.value.trim ? e.target.value.trim() : e.target.value; save(state); refresh(); };
  const st = select("state", stateOptions(), g.state, "pick one", `state-${g.gen}`); st.addEventListener("change", upd("state"));
  return el("div", { class: "gen-facts" },
    el("label", { for: `born-${g.gen}`, text: "Born about (year)" }), el("input", { id: `born-${g.gen}`, name: "born", type: "text", inputmode: "numeric", placeholder: "e.g. 1820", value: g.born || "", autocomplete: "off", oninput: upd("born") }),
    g.living ? null : el("label", { for: `died-${g.gen}`, text: "Died about (year)" }), g.living ? null : el("input", { id: `died-${g.gen}`, name: "died", type: "text", inputmode: "numeric", placeholder: "e.g. 1880", value: g.died || "", autocomplete: "off", oninput: upd("died") }),
    el("label", { for: `state-${g.gen}`, text: "State where they lived" }), st,
    el("p", { class: "small hint", text: "The year and state let \"Where to look\" fit this person's era and state." }));
};

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
    el("div", { class: "status", "aria-live": "polite" }, ...statusFor(c)),
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
      cellEl.querySelector(".status").replaceChildren(...statusFor(c)); }
  });
}
function mountEditor(root) {
  const state = load(); const box = root.querySelector("[data-matrix]"); const gapBox = root.querySelector("[data-gaps]");
  const patBox = root.querySelector("[data-patriot]");
  const msg = root.querySelector("[data-cleared]");
  // Light refresh (keeps typing smooth): gaps, plan, and the patriot date check.
  const refresh = () => {
    gapBox.replaceChildren(renderGaps(state));
    root.querySelector("[data-plan]")?.replaceChildren(renderPlan(actionPlan(state.generations, state.patriot), { heading: false }));
    root.querySelector("[data-patriot-check]")?.replaceChildren(patriotCheckEl(state.patriot));
    const pg = patriotGen(state.generations, state.patriot);
    box.querySelectorAll("[data-gen]").forEach((sec) => { const h = sec.querySelector("h3"); const g = +sec.dataset.gen; h.textContent = genTitle(g) + (g === pg ? " (the patriot)" : ""); });
  };
  const rerender = () => {
    const focusId = document.activeElement?.id;
    const last = state.generations.length;
    if (patBox) patBox.replaceChildren(patriotForm(state, refresh));
    box.replaceChildren(...state.generations.map((g) => el("section", { class: "gen", "data-gen": g.gen },
      el("h3", { text: genTitle(g.gen) }),
      el("p", { class: "small hint", text: g.gen === 1 ? "Generation 1 is always you, the person applying." :
        g.gen === last ? `Each generation is one step further back. Is this person the patriot? If not, press "Add an older generation" below.` :
        `The parent of the person in generation ${g.gen - 1}, in the line that leads to the patriot.` }),
      el("label", { for: `who-${g.gen}`, text: "Name (optional, stays in this browser)" }),
      el("input", { id: `who-${g.gen}`, type: "text", value: g.who, autocomplete: "off", oninput: (e) => { g.who = e.target.value; save(state); } }),
      el("label", { class: "check" }, el("input", { type: "checkbox", id: `living-${g.gen}`, checked: g.living, onchange: (e) => { g.living = e.target.checked; save(state); rerender(); } }), " Still living (then no death record is needed)"),
      genFields(state, g, refresh),
      ...g.cells.map((c, i) => cellEditor(state, g, c, rerender, i + 1)),
      el("button", { type: "button", "data-add-evidence": g.gen, onclick: () => addRecord(g), text: `+ Add a record for ${genLabel(g.gen).toLowerCase()}` }))));
    refresh();
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
    const hasData = state.generations.some((g) => g.cells.length || g.who) || hasPatriot(state.patriot);
    if (hasData && !confirm("Replace what you've entered with the made-up example?")) return;
    const ex = EXAMPLE(); state.generations = ex.generations; state.patriot = ex.patriot; save(state); rerender();
    if (msg) msg.textContent = "Example loaded: a made-up Virginia militiaman and four generations after him. Scroll down to see what's missing and where to look.";
  });
  root.querySelector("[data-clear=toolB]").addEventListener("click", () => {
    if (!confirm("Delete all Lineage Evidence Matrix data saved in this browser?")) return;
    store.clear(); const fresh = blank(); state.generations = fresh.generations; state.patriot = fresh.patriot; rerender();
    msg.textContent = "All matrix data was deleted from this browser.";
  });
  rerender();
}
function mountCard(root) {
  const s = store.get("v1", null); const out = root.querySelector("[data-card-status]");
  if (!s) { out.textContent = "Nothing saved in this browser yet."; return; }
  const n = countEntries(s.generations);
  out.textContent = `Saved in this browser: ${s.generations.length} generations, ${n} evidence entries, ${gaps(s.generations, s.patriot).length} things still missing or flagged.`;
}
function patriotSummary(p) {
  const k = kindOf(p.kind);
  const rows = [["Name", p.name], ["State or colony he served for", stateName(p.state)], ["Unit or company", p.unit], ["Type of service", k?.label], ["Service dates", p.start ? `${p.start}${p.end && p.end !== p.start ? ` to ${p.end}` : ""}` : ""]];
  return el("div", { class: "patriot-summary" }, el("dl", {}, ...rows.flatMap(([a, b]) => [el("dt", { text: a }), el("dd", { text: b || "—" })])), patriotCheckEl(p));
}
function mountReport(root) {
  const s = store.get("v1", null); const body = root.querySelector("[data-report]");
  if (!s) { body.replaceChildren(el("p", { text: "Nothing saved in this browser yet. Open the Lineage Evidence Matrix, enter what you have (or press \"Load an example\"), then come back." }),
    el("p", {}, el("a", { class: "button-link", href: "/tools/lineage-matrix/", text: "Go to the Lineage Evidence Matrix" }))); return; }
  const pg = patriotGen(s.generations, s.patriot);
  const kids = [el("p", { class: "small", text: `Saved ${s.updated ? new Date(s.updated).toLocaleString() : ""}. This is your own worksheet, not a decision: a society's genealogists review every entry.` }),
    renderPlan(actionPlan(s.generations, s.patriot)),
    el("h2", { text: "The patriot" }), hasPatriot(s.patriot) ? patriotSummary(s.patriot) : el("p", { class: "small", text: "Not filled in yet." }),
    el("h2", { text: "What's still missing, and where to look" }), renderGaps(s), el("h2", { text: "Your records, generation by generation" })];
  for (const g of s.generations) {
    const rows = filledCells(g.cells).map((c) => { const ev = evaluateCell(c);
      return el("tr", {}, el("td", { text: FACT_LABELS[c.fact] || "—" }), el("td", { text: DOC_TYPES[c.docType] || "—" }), el("td", { text: MODE_TEXT[c.mode] || "—" }),
        el("td", { text: c.citation || "—" }), el("td", {}, el("span", { class: `badge ${labelClass(ev.label)}`, text: ev.label }), ...ev.cautions.map((k) => el("div", { class: "small caution", text: k.text })))); });
    const facts = [g.born && `born about ${g.born}`, !g.living && g.died && `died about ${g.died}`, g.state && stateName(g.state)].filter(Boolean).join(", ");
    kids.push(el("h3", { text: `${genTitle(g.gen)}${g.gen === pg ? " (the patriot)" : ""}${g.who ? ` — ${g.who}` : ""}${g.living ? " (living)" : ""}` }),
      facts ? el("p", { class: "small", text: facts }) : null,
      rows.length ? el("div", { class: "table-wrap" }, el("table", {}, el("thead", {}, el("tr", {}, ...["What it shows", "Kind of record", "Says it in words?", "Where you found it", "Status"].map((h) => el("th", { text: h })))), el("tbody", {}, ...rows)))
        : el("p", { class: "small", text: "No records entered yet." }));
  }
  body.replaceChildren(...kids.filter(Boolean));
}
document.querySelectorAll('[data-tool="lineage-matrix"]').forEach(mountEditor);
document.querySelectorAll('[data-tool-card="lineage-matrix"]').forEach(mountCard);
document.querySelectorAll('[data-tool-report="lineage-matrix"]').forEach((root) => { mountReport(root);
  root.querySelector("[data-print]")?.addEventListener("click", () => window.print());
  root.querySelector("[data-clear=toolB]")?.addEventListener("click", () => { if (!confirm("Delete all Lineage Evidence Matrix data saved in this browser?")) return; store.clear(); mountReport(root); }); });
