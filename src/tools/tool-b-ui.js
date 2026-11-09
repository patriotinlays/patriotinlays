// Tool B browser UI: Lineage Evidence Matrix editor, embed card, and report page.
// State lives only in localStorage under "pi.toolB.v1"; no network requests are made.
import { dateField } from "./date-ui.js";
import { dateLabel } from "./dates.js";
import { SKIP_TEXT, STILL_NEEDED, isSkipped, setSkip, relationName, HAVE_ITEMS, byFactOrder, actionPlan, evaluateCell, gaps, groupGaps, filledCells, countEntries, patriotGen, LABELS, FACTS, FACT_LABELS, DOC_TYPES, MODE_HELP, genLabel, genTitle, isEmptyCell, dateWarnings, NSCDA_TERM, birthSubstitutes, NAME_CHECKLIST } from "./tool-b.js";
import { SERVICE_KINDS, PATRIOT_HELP, patriotDates, hasPatriot, kindOf } from "./patriot.js";
import { STATES, stateName, noVitalText } from "./places.js";
import { ns, el } from "./storage.js";
import { renderPlan, noteEl } from "./plan-ui.js";
import { plural } from "./tool-a.js";
const store = ns("pi.toolB.");
const blank = () => ({ version: 1, generations: [newGen(1), newGen(2)], patriot: newPatriot(), updated: null });
function newGen(gen) { return { gen, who: "", living: gen === 1, born: "", died: "", state: "", cells: [] }; }
const MAX_PICK_GEN = 13; // up to "my 10th-great-grandfather"
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

function select(name, options, value, label, id, skip = null) {
  const s = el("select", { name, id }, el("option", { value: "", text: `— ${label} —` }));
  for (const [v, t] of options) s.append(el("option", { value: v, text: t, selected: v === value }));
  // A record's questions also offer "Skip for now" (Tim t119u #3); skip = whether this question is currently skipped.
  if (skip != null) s.append(el("option", { value: "__skip", text: SKIP_TEXT, selected: !!skip && !value, "data-skip": "" }));
  return s;
}
// Blank records get a plain prompt instead of a label; they are never labelled or counted.
const statusFor = (c) => isEmptyCell(c) ? [el("div", { class: "small hint", "data-blank": "", text: "Empty record: answer A to D, or remove it." })] : statusKids(evaluateCell(c));
const statusKids = (ev) => [el("span", { class: `badge ${labelClass(ev.label)}`, text: ev.label }),
  ev.label === LABELS.entered ? el("div", { class: "small", "data-entered-note": "", text: "You've entered evidence; a society registrar decides whether it's enough." }) : null,
  ...ev.issues.map((i) => el("div", { class: "small issue still-needed", "data-still-needed": "", text: i })), ...ev.cautions.map((k) => el("div", { class: "small caution", text: k.text }))];

// "Where to look" block shared by the editor and the report. Notes carry the era- and state-specific facts.
export function whereBlock(w, seen = null) {
  if (!w) return null;
  const links = [...w.links.map((l) => el("li", {}, el("a", { href: l.url, rel: "noopener", text: l.label }))),
    ...w.guides.map((g) => el("li", {}, "Our guide: ", el("a", { href: g.url, text: g.label })))];
  return el("div", { class: "where" }, el("strong", { text: "Where to look: " }), w.text ? `${w.text} ` : "", w.registrar,
    ...(w.notes || []).map((n) => noteEl(n, seen)),
    links.length ? el("ul", { class: "where-links" }, ...links) : null);
}
// A missing record gets a button that adds it to that generation with "what it shows" already picked.
const ADD_TEXT = { birth: "+ Add a birth or death record", death: "+ Add a death record", parentage: "+ Add a record that links them", marriage: "+ Add a marriage record", residence: "+ Add a record" };
function renderGaps(state, seen = null, refFor = null) {
  const list = gaps(state.generations, state.patriot);
  if (!list.length) return el("p", { class: "small", text: "Nothing missing by the tool's rules. That is not a proof: a society's genealogist still reviews every entry." });
  // Each generation is listed once, in order, with its items under it.
  return el("ol", { class: "gaps" }, ...groupGaps(list, patriotGen(state.generations, state.patriot)).map((grp) => el("li", { class: "gap-gen", "data-gap-gen": grp.gen ?? "" }, el("strong", { class: "gap-gen-h", text: grp.title }),
    el("ul", { class: "gap-items" }, ...grp.items.map((g) => el("li", { class: g.priority === 0 ? "conflict" : "" }, el("div", { class: "gap-text", text: g.short }),
      g.add ? el("button", { type: "button", class: "secondary add-for", "data-add-for": `${g.gen}:${g.add}`, text: g.add === "birth" && /birth or death/.test(g.short) ? ADD_TEXT.birth : g.add === "birth" ? "+ Add a birth record" : ADD_TEXT[g.add] || "+ Add a record" }) : null,
      refFor ? whereRefEl(refFor(g.where, { who: g.gen ? `Gen ${g.gen}` : "", fact: g.fact, anyOf: /birth or death/.test(g.short || ""), text: g.short })) : whereBlock(g.where, seen)))))));
}
const stateOptions = () => STATES.map(([c, n]) => [c, n]);
// The patriot's date check, in plain words (the old standalone service-date check, folded into this step).
function patriotCheckEl(p, rows = null) {
  const d = patriotDates(p);
  if (!d) return el("p", { class: "small hint", text: "Type his rough service dates to check them against the period DAR accepts for his type of service." });
  // His birth year and service must add up before the period check can say anything fits (audit 4).
  const warn = rows ? dateWarnings(rows, p).filter((w) => w.patriot) : [];
  // Only "can't be right" warnings hold back the period check; "unlikely" ones get a softer badge and the check still runs (code review).
  const hard = warn.filter((w) => w.kind === "impossible");
  if (hard.length && d.status !== "invalid") return el("div", { class: "result r-inconsistent", "data-date-warn": "" }, el("span", { class: "badge b-inconsistent", text: "His dates don't add up" }),
    ...warn.map((w) => el("p", { text: w.text })), el("p", { class: "small", text: "The period check waits until his birth year and service dates make sense together." }));
  const soft = warn.length && d.status !== "invalid" ? el("div", { class: "result r-possible", "data-date-warn": "", "data-date-unlikely": "" }, el("span", { class: "badge b-possible", text: "Worth a second look" }), ...warn.map((w) => el("p", { text: w.text }))) : null;
  const label = { consistent: "Dates fit DAR's period for this service (not a ruling)", partial: "Partly inside the period", inconsistent: "Outside the period as typed", invalid: "Couldn't read the dates" }[d.status];
  return el("div", {}, soft, el("div", { class: `result r-${d.status}` }, el("span", { class: `badge b-${d.status}`, text: label }), el("p", { text: d.plain }),
    el("p", { class: "small", text: `Period checked: ${d.rule || ""}` }),
    p.end ? el("p", { class: "small" }, "His service end date can feed the ", el("a", { href: "/tools/widow-pension-checker/?from=worksheet", "data-to-widow": "", text: "widow-pension check" }), ".") : null));
}
function patriotForm(state, refresh, rerender = refresh) {
  const p = state.patriot; const set = (k, v) => { p[k] = v; save(state); refresh(); };
  const inp = (k, label, hint, attrs = {}) => [el("label", { for: `pat-${k}`, text: label }), hint ? el("p", { class: "small hint", text: hint }) : null,
    el("input", { id: `pat-${k}`, name: k, type: "text", value: p[k] || "", autocomplete: "off", oninput: (e) => set(k, e.target.value.trim()), ...attrs })];
  const sel = (k, label, opts, hint) => [el("label", { for: `pat-${k}`, text: label }), hint ? el("p", { class: "small hint", text: hint }) : null,
    (() => { const x = select(k, opts, p[k], "pick one", `pat-${k}`); x.addEventListener("change", (e) => set(k, e.target.value)); return x; })()];
  // Generation 1 is the person applying, so it is never offered; the default is the oldest generation entered.
  const oldest = state.generations.at(-1)?.gen ?? 1;
  // Plain relationship choices ("my 3rd-great-grandfather") that map to generation numbers; picking one past the
  // generations entered adds the empty generations in between. Generation 1 (you) is never offered.
  const maxGen = Math.max(MAX_PICK_GEN, oldest);
  const gens = Array.from({ length: maxGen - 1 }, (_, i) => i + 2).map((g) => [String(g), `${relationName(g)[0].toUpperCase()}${relationName(g).slice(1)} (generation ${g})`]);
  const genSel = (() => { const x = select("gen", gens, p.gen === "1" ? "" : p.gen, "", "pat-gen");
    x.options[0].textContent = oldest > 1 ? `The oldest generation I've added (now ${relationName(oldest)}, generation ${oldest})` : "The oldest generation (add generations below)";
    x.addEventListener("change", (e) => { const v = e.target.value; p.gen = v;
      if (+v > state.generations.length) { for (let g = state.generations.length + 1; g <= +v; g++) state.generations.push(newGen(g)); save(state); rerender(); return; }
      x.closest("[data-patriot-form]")?.querySelector("[data-gen-warn]")?.remove(); save(state); refresh(); }); return x; })();
  const genWarn = p.gen === "1" ? "Generation 1 is you, the person applying, so it can't be the patriot. The worksheet is using your oldest generation instead."
    : oldest === 1 ? "Generation 1 is you, so it can't be the patriot. Add generations below, back to him; he'll be the oldest one unless you pick another." : null;
  return el("div", { class: "patriot-form", "data-patriot-form": "" },
    // Most beginners start without the soldier's name: point them to Roadmap Step 0 instead of leaving the step blank.
    el("p", { class: "no-name", "data-no-name": "" }, el("strong", { text: "Don't know his name yet? " }), "That's where most people start. ",
      el("a", { href: "/guides/lineage-proof-roadmap/#step-0-find-the-soldier-s-name", text: "Step 0 of our Roadmap guide: how to find the soldier's name" }),
      ". Meanwhile, fill in the people you do know below, starting with yourself; you can add him here later."),
    nameChecklistEl(false),
    ...inp("name", "His name (optional, stays in this browser)"),
    ...sel("state", "State or colony he served for", stateOptions(), PATRIOT_HELP.state.text),
    ...inp("unit", "Unit or company (optional)", "For example a county militia company or a numbered regiment, if you know it."),
    ...sel("kind", "Type of service", SERVICE_KINDS.map((k) => [k.id, k.label]), PATRIOT_HELP.kind.text),
    dateField({ id: "pat-start", name: "start", legend: "When did his service start?", hint: "A rough date is fine: pick \"About\" if you aren't sure.", value: p.start || "", onChange: (v) => set("start", v) }),
    dateField({ id: "pat-end", name: "end", legend: "When did his service end?", hint: "Leave it blank if you only have one date.", value: p.end || "", onChange: (v) => set("end", v) }),
    el("label", { for: "pat-gen", text: "How is he related to you?" }), el("p", { class: "small hint", text: "Pick the relationship, for example \"my 3rd-great-grandfather\"; the worksheet adds the generations in between. Generation 1 is you, so it isn't offered." }), genSel,
    genWarn ? el("p", { class: "small warn", role: "status", "data-gen-warn": "", text: genWarn }) : null,
    el("div", { "data-patriot-check": "", "aria-live": "polite" }, patriotCheckEl(p, state.generations)));
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

// "What do you have?": ticking an item adds a record with "what it shows" and "kind of record" already picked;
// unticking removes it again if nothing else was filled in.
const untouched = (c) => !c.mode && !c.citation && !c.conflict;
const hasItem = (g, it) => g.cells.some((c) => c.have === it.id || (it.docType && c.docType === it.docType && (!it.fact || c.fact === it.fact)));
function haveBox(state, g, rerender) {
  return el("fieldset", { class: "have", "data-have": g.gen }, el("legend", { text: `What do you have for ${g.gen === 1 ? "yourself" : "this person"}? Tick each one` }),
    el("p", { class: "small hint", text: "Each tick adds a record below with the first questions answered. Then say where you found it." }),
    ...HAVE_ITEMS.map((it) => el("label", { class: "check" }, el("input", { type: "checkbox", name: `have-${g.gen}`, value: it.id, "data-have-item": it.id, checked: hasItem(g, it), onchange: (e) => {
      if (e.target.checked) { g.cells = g.cells.filter((c) => !isEmptyCell(c)); g.cells.push(newCell({ fact: it.fact, docType: it.docType, have: it.id })); }
      else { const keep = g.cells.filter((c) => (c.have === it.id || (it.docType && c.docType === it.docType)) && !untouched(c));
        g.cells = g.cells.filter((c) => !((c.have === it.id || (it.docType && c.docType === it.docType && (!it.fact || c.fact === it.fact))) && untouched(c)));
        if (keep.length) alertMsg(`Kept the ${it.label.toLowerCase()} you already started filling in. Use "Remove this record" on it if you want it gone.`); }
      save(state); rerender(); } }), " ", it.label)));
}
let alertMsg = () => {};
// "No birth certificate? Try these substitutes, in order": a closed panel at each generation without a birth record.
function birthSubsEl(g) {
  const b = birthSubstitutes(g); if (!b) return null;
  return el("details", { class: "birth-subs", "data-birth-subs": g.gen }, el("summary", { text: b.title }),
    el("p", { class: "small", text: b.intro }),
    el("ol", { class: "birth-subs-steps" }, ...b.steps.map((x) => el("li", { "data-sub": x.id, text: x.text }))),
    el("p", { class: "small", text: b.combine.text }),
    el("ul", { class: "where-links small" }, ...b.links.map((l) => el("li", {}, el("a", { href: l.url, rel: "noopener", text: l.label }))),
      el("li", {}, "Our guide: ", el("a", { href: b.guide.url, text: b.guide.label }))));
}
// "Don't know his name yet?": a short checklist; ticks are saved in this browser only (pi.toolB.nameChecklist).
function nameChecklistEl(open = true) {
  const ticks = store.get("nameChecklist", {}) || {};
  const body = [el("ul", { class: "name-checklist" }, ...NAME_CHECKLIST.map((it) => el("li", {}, el("label", { class: "check" },
      el("input", { type: "checkbox", "data-name-check": it.id, checked: !!ticks[it.id], onchange: (e) => { const t = store.get("nameChecklist", {}) || {}; t[it.id] = e.target.checked; store.set("nameChecklist", t);
        document.querySelectorAll(`[data-name-check="${it.id}"]`).forEach((x) => { x.checked = e.target.checked; }); } }), " ", it.text)))),
    el("p", { class: "small" }, "More detail: ", el("a", { href: "/guides/lineage-proof-roadmap/#step-0-find-the-soldier-s-name", text: "Step 0 of our Roadmap guide: how to find the soldier's name" }), ".")];
  return open ? el("div", { class: "name-check", "data-name-box": "" }, el("p", {}, el("strong", { text: "Don't know his name yet? " }), "That's where most people start. A short checklist:"), ...body)
    : el("details", { class: "name-check", "data-name-box": "" }, el("summary", { text: "Don't know his name yet? A short checklist" }), ...body);
}
function cellEditor(state, g, c, rerender, n) {
  const ev = evaluateCell(c);
  const base = `g${g.gen}-${c.id}`;
  const upd = (k, v) => { c[k] = v; save(state); rerender(); };
  const modeGroup = el("fieldset", { class: "mode" }, el("legend", { text: "C. Does the record say it in words, or only hint at it?" }),
    ...["direct", "indirect"].map((v) => el("label", { class: "choice" },
      el("input", { type: "radio", name: `${base}-mode`, value: v, checked: c.mode === v, onchange: () => { setSkip(c, "mode", false); upd("mode", v); } }),
      el("span", {}, el("strong", { text: MODE_TEXT[v] }), el("span", { class: "small", text: ` ${MODE_HELP[v]}` })))),
    el("label", { class: "choice skip" }, el("input", { type: "radio", name: `${base}-mode`, value: "__skip", "data-skip": "mode", checked: !c.mode && isSkipped(c, "mode"), onchange: () => { setSkip(c, "mode", true); save(state); rerender(); } }),
      el("span", { text: SKIP_TEXT })));
  return el("div", { class: "cell", "data-cell": c.id },
    el("p", { class: "cell-h", text: `Record ${n}` }),
    el("label", { for: `${base}-fact`, text: "A. What does this record show?" }), select("fact", FACTS.map((f) => [f, FACT_LABELS[f]]), c.fact, "pick one", `${base}-fact`, isSkipped(c, "fact")),
    el("label", { for: `${base}-doc`, text: "B. What kind of record is it?" }), select("docType", Object.entries(DOC_TYPES), c.docType, "pick one", `${base}-doc`, isSkipped(c, "docType")),
    modeGroup,
    el("label", { for: `${base}-cite`, text: "D. Where did you find it?" }),
    el("p", { class: "small hint", text: "A few words so you can find it again, e.g. \"county courthouse, will book 3, page 12\"." }),
    el("input", { id: `${base}-cite`, name: "citation", type: "text", value: c.citation, autocomplete: "off" }),
    el("label", { class: "check skip" }, el("input", { type: "checkbox", name: "citationSkip", "data-skip": "citation", checked: !(c.citation || "").trim() && isSkipped(c, "citation"),
      onchange: (e) => { setSkip(c, "citation", e.target.checked); save(state); rerender(); } }), ` ${SKIP_TEXT}`),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "conflict", checked: c.conflict, onchange: (e) => upd("conflict", e.target.checked) }), " This record disagrees with another record (for example, a different date)"),
    el("div", { class: "status", "aria-live": "polite" }, ...statusFor(c)),
    el("button", { type: "button", class: "link danger", onclick: () => { g.cells = g.cells.filter((x) => x !== c); save(state); rerender(); }, text: "Remove this record" }));
}
function bindEditorEvents(container, state, rerender) {
  container.addEventListener("change", (e) => {
    const cellEl = e.target.closest("[data-cell]"); if (!cellEl) return;
    const name = e.target.name; if (!["fact", "docType"].includes(name)) return;
    for (const g of state.generations) for (const c of g.cells) if (c.id === cellEl.dataset.cell) {
      if (e.target.value === "__skip") setSkip(c, name, true); else { setSkip(c, name, false); c[name] = e.target.value; }
      save(state); rerender(); return; }
  });
  container.addEventListener("input", (e) => {
    if (e.target.name !== "citation") return; const cellEl = e.target.closest("[data-cell]");
    for (const g of state.generations) for (const c of g.cells) if (c.id === cellEl.dataset.cell) { c.citation = e.target.value; if (c.citation.trim()) { setSkip(c, "citation", false); const k = cellEl.querySelector('[data-skip="citation"]'); if (k) k.checked = false; } save(state);
      cellEl.querySelector(".status").replaceChildren(...statusFor(c)); }
  });
}
function mountEditor(root) {
  // A first visit opens with the purpose line and a Start button; the steps stay hidden until the visitor starts
  // (audit 4 proposal). Saved data, an example, or a link to a step (#tb-patriot, #gen-N) opens them straight away.
  const fresh = store.get("v1", null) == null && !/^#(tb-patriot|gen-\d+)$/.test(location.hash);
  const startBox = root.querySelector("[data-ws-start]"), wsBody = root.querySelector("[data-ws-body]");
  const open = (focus = false) => { if (startBox) startBox.hidden = true; if (wsBody) wsBody.hidden = false; if (focus) { const h = root.querySelector("#tb-patriot"); h?.setAttribute("tabindex", "-1"); h?.scrollIntoView({ block: "start" }); h?.focus(); } };
  if (fresh && startBox && wsBody) { startBox.hidden = false; wsBody.hidden = true; root.querySelector("[data-name-checklist]")?.replaceChildren(nameChecklistEl(true)); }
  root.querySelector("[data-ws-begin]")?.addEventListener("click", () => { save(state); open(true); });
  const state = load(); const box = root.querySelector("[data-matrix]"); const gapBox = root.querySelector("[data-gaps]");
  const patBox = root.querySelector("[data-patriot]");
  const msg = root.querySelector("[data-cleared]"); alertMsg = (t) => { if (msg) msg.textContent = t; };
  // Light refresh (keeps typing smooth): gaps, plan, and the patriot date check.
  const refresh = () => {
    // "Where to look" works like the report: each block is shown in full once, lettered, and the list and the plan
    // point to it by letter (audit 3 counted about 13 repeats of the same advice on this page).
    const { refFor, blocks } = whereIndex();
    const list = renderGaps(state, null, refFor);
    const plan = renderPlan(actionPlan(state.generations, state.patriot), { heading: false, whereRef: refFor, printable: false, tip: false });
    gapBox.replaceChildren(list, blocks.length ? whereIndexEl(blocks, "Each piece of advice appears once. The letters above and in \"What to do next\" point here.", "h4") : null);
    root.querySelector("[data-plan]")?.replaceChildren(plan);
    root.querySelector("[data-patriot-check]")?.replaceChildren(patriotCheckEl(state.patriot, state.generations));
    const pg = patriotGen(state.generations, state.patriot);
    box.querySelectorAll("[data-gen]").forEach((sec) => { const h = sec.querySelector("h3"); const g = +sec.dataset.gen; h.textContent = genTitle(g) + (g === pg ? " (the patriot)" : ""); });
  };
  const rerender = () => {
    const focusId = document.activeElement?.id;
    const last = state.generations.length;
    if (patBox) patBox.replaceChildren(patriotForm(state, refresh, rerender));
    box.replaceChildren(...state.generations.map((g) => el("section", { class: "gen", "data-gen": g.gen, id: `gen-${g.gen}` },
      el("h3", { text: genTitle(g.gen) }),
      el("p", { class: "small hint", text: g.gen === 1 ? "Generation 1 is always you, the person applying." :
        g.gen === last ? `Each generation is one step further back. Is this person the patriot? If not, press "Add an older generation" below.` :
        `The parent of the person in generation ${g.gen - 1}, in the line that leads to the patriot.` }),
      el("label", { for: `who-${g.gen}`, text: "Name (optional, stays in this browser)" }),
      el("input", { id: `who-${g.gen}`, type: "text", value: g.who, autocomplete: "off", oninput: (e) => { g.who = e.target.value; save(state); } }),
      el("label", { class: "check" }, el("input", { type: "checkbox", id: `living-${g.gen}`, checked: g.living, onchange: (e) => { g.living = e.target.checked; save(state); rerender(); } }), " Still living (then no death record is needed)"),
      genFields(state, g, refresh), haveBox(state, g, rerender), birthSubsEl(g),
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
  // "+ Add a … record" under a missing item: adds the record to that generation (what it shows already picked) and goes to it.
  gapBox.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add-for]"); if (!b) return;
    const [gn, fact] = b.dataset.addFor.split(":"); const g = state.generations.find((x) => x.gen === +gn); if (!g) return;
    const c = newCell({ fact }); g.cells.push(c); save(state); rerender();
    const f = document.getElementById(`g${g.gen}-${c.id}-docType`) || document.getElementById(`g${g.gen}-${c.id}-fact`); f?.scrollIntoView({ block: "center" }); f?.focus();
    if (msg) msg.textContent = `Added a ${FACT_LABELS[fact]?.toLowerCase() || ""} record for ${genLabel(g.gen).toLowerCase()}. Answer the questions for it below.`;
  });
  root.querySelector("[data-add-gen]").addEventListener("click", () => { state.generations.push(newGen(state.generations.length + 1)); save(state); rerender(); });
  root.querySelector("[data-remove-gen]").addEventListener("click", () => { if (state.generations.length > 2) { state.generations.pop(); save(state); rerender(); } });
  root.querySelector("[data-load-example]")?.addEventListener("click", () => {
    const hasData = state.generations.some((g) => g.cells.length || g.who) || hasPatriot(state.patriot);
    if (hasData && !confirm("Replace what you've entered with the made-up example?")) return;
    const ex = EXAMPLE(); state.generations = ex.generations; state.patriot = ex.patriot; save(state); open(); rerender();
    if (msg) msg.textContent = "Example loaded: a made-up Virginia militiaman and four generations after him. Scroll down to see what's missing and where to look.";
  });
  root.querySelector("[data-clear=toolB]").addEventListener("click", () => {
    if (!confirm("Delete your saved entries? This can't be undone.")) return;
    store.clear(); const fresh = blank(); state.generations = fresh.generations; state.patriot = fresh.patriot; rerender();
    msg.textContent = "All matrix data was deleted from this browser.";
  });
  rerender();
  // The report's "Add it in the worksheet" links point to #gen-N; the sections are built by script, so scroll once they exist.
  if (/^#gen-\d+$/.test(location.hash)) document.querySelector(location.hash)?.scrollIntoView();
}
function mountCard(root) {
  const s = store.get("v1", null); const out = root.querySelector("[data-card-status]");
  if (!s) { out.textContent = "Nothing saved in this browser yet."; return; }
  const n = countEntries(s.generations);
  out.textContent = `Saved in this browser: ${plural(s.generations.length, "generation")}, ${plural(n, "evidence entry", "evidence entries")}, ${plural(gaps(s.generations, s.patriot).length, "thing")} still missing or flagged.`;
}
function patriotSummary(p, gens = null) {
  const k = kindOf(p.kind);
  const rows = [["Name", p.name], ["State or colony he served for", stateName(p.state)], ["Unit or company", p.unit], ["Type of service", k?.label], ["Service dates", p.start ? `${p.start}${p.end && p.end !== p.start ? ` to ${p.end}` : ""}` : ""]];
  return el("div", { class: "patriot-summary" }, el("dl", {}, ...rows.flatMap(([a, b]) => [el("dt", { text: a }), el("dd", { text: b || "—" })])), patriotCheckEl(p, gens));
}
// "Where to look" index for the report: the general advice and each state/census note become separate lettered
// blocks, so a note shared by several gaps is printed once and the gaps point to it.
const PATRIOT_BADGE = { consistent: "dates fit DAR's period for this service (not a ruling)", partial: "partly inside the period", inconsistent: "outside the period as typed", invalid: "couldn't read the dates" };
const FACT_SHORT = { birth: "birth", death: "death", marriage: "marriage", parentage: "parent–child link", residence: "where they lived" };
const letterFor = (i) => (i < 26 ? String.fromCharCode(65 + i) : letterFor(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));
export function whereIndex() {
  const byKey = new Map(), blocks = [];
  const add = (key, make, used) => { let b = byKey.get(key); if (!b) { b = { letter: letterFor(blocks.length), used: [], ...make() }; byKey.set(key, b); blocks.push(b); } if (used) b.used.push(used); return b.letter; };
  const refFor = (w, it) => {
    const what = it?.anyOf ? "birth or death" : it?.fact ? (FACT_SHORT[it.fact] || it.fact) : it?.text || "";
    const used = it?.who ? `${it.who} ${what}` : what;
    const out = [];
    if (w.text) out.push(add(`g|${w.text}|${w.links.map((l) => l.url).join(" ")}`, () => ({ text: w.text,
      links: [...w.links.filter((l) => !(w.notes || []).some((n) => n.links?.some((m) => m.url === l.url))), ...w.guides.map((g) => ({ label: `Our guide: ${g.label}`, url: g.url }))] }), used));
    for (const n of w.notes || []) {
      if (n.kind === "hint") continue;
      // A state with no verified source gets one block naming every record type it applies to (audit 3: printed once).
      if (n.kind === "nosource") { const L = add(n.key, () => ({ place: n.place, facts: [], text: "", guide: null, links: n.links || [] }), used);
        const b = byKey.get(n.key); if (!b.facts.includes(n.fact)) b.facts.push(n.fact); out.push(L); continue; }
      // Census notes: each census fact is its own block, so a fact shared by several people is printed once (audit 3).
      if (n.kind === "census" && n.parts?.length) { for (const t of n.parts) out.push(add(`c|${t}`, () => ({ text: `Census: ${t}`, guide: null, links: [] }), used)); continue; }
      out.push(add(`n|${n.text}`, () => ({ text: n.text, guide: n.guide || null, links: n.links || [] }), used));
    }
    return [...new Set(out)];
  };
  return { refFor, blocks };
}
const whereRefEl = (letters) => letters?.length ? el("div", { class: "where-ref", "data-where-ref": letters.join(",") }, "Where to look: ",
  ...letters.flatMap((L, i) => [i ? ", " : null, el("a", { href: `#where-${L}`, text: L })])) : null;
// The lettered "Where to look" index, shared by the worksheet page and the report.
export function whereIndexEl(blocks, intro, level = "h2") {
  return el("section", { class: "report-where", "data-where-index": "" },
    el(level, { text: "Where to look" }),
    el("p", { class: "small", text: `${intro} Not sure where to order a record? Ask your society's registrar.` }),
    blocks.some((b) => /NSCDA/.test(b.text || "")) ? el("p", { class: "small term", "data-nscda-term": "" }, el("strong", { text: "NSCDA: " }), NSCDA_TERM.text.replace(/^NSCDA is /, "")) : null,
    ...blocks.map((b) => el("div", { class: "where-block", id: `where-${b.letter}`, "data-where-block": b.letter },
      el("p", {}, el("strong", { class: "where-letter", text: `${b.letter}. ` }), b.place ? noVitalText(b.place, b.facts) : b.text, b.guide ? " " : null, b.guide ? el("a", { href: b.guide.url, "data-substitute": "", text: b.guide.label }) : null),
      b.links.length ? el("ul", { class: "where-links small" }, ...b.links.map((l) => el("li", {}, el("a", { href: l.url, rel: l.url.startsWith("http") ? "noopener" : null, text: l.label })))) : null,
      el("p", { class: "small used-for", text: `For: ${[...new Set(b.used)].join("; ")}` }))));
}
function mountReport(root) {
  const s = store.get("v1", null); const body = root.querySelector("[data-report]");
  if (!s) { body.replaceChildren(el("p", { text: "Nothing saved in this browser yet. Open the Lineage Evidence Matrix, enter what you have (or press \"Load an example\"), then come back." }),
    el("p", {}, el("a", { class: "button-link", href: "/tools/lineage-matrix/", text: "Go to the Lineage Evidence Matrix" }))); return; }
  const pg = patriotGen(s.generations, s.patriot);
  const { refFor, blocks } = whereIndex();
  // Rendering the plan first fills the "Where to look" index, so each piece of advice is printed once, below, by letter.
  const plan = renderPlan(actionPlan(s.generations, s.patriot), { heading: false, printable: false, tip: false, whereRef: refFor, addHref: (it) => `/tools/lineage-matrix/#gen-${it.gen}` });
  const n = countEntries(s.generations); const missing = gaps(s.generations, s.patriot).length;
  const pd = hasPatriot(s.patriot) ? patriotDates(s.patriot) : null; const k = kindOf(s.patriot?.kind);
  const patLine = hasPatriot(s.patriot) ? `${s.patriot.name || "Not named"}${s.patriot.state ? `, ${stateName(s.patriot.state)}` : ""}${k ? `, ${k.label.toLowerCase()}` : ""}${s.patriot.start ? `, ${dateLabel(s.patriot.start)}${s.patriot.end && s.patriot.end !== s.patriot.start ? ` to ${dateLabel(s.patriot.end)}` : ""}` : ""}${pg ? ` (generation ${pg})` : ""}.${pd ? ` Date check: ${dateWarnings(s.generations, s.patriot).some((w) => w.patriot && w.kind === "impossible") && pd.status !== "invalid" ? "his birth year and service dates don't add up (see \"Check these dates first\")" : PATRIOT_BADGE[pd.status] || pd.status}.` : ""}` : "Not filled in yet.";
  const summary = el("section", { class: "report-summary", "data-summary": "" },
    el("h2", { text: "Summary" }),
    el("p", { class: "small", text: `Saved ${s.updated ? new Date(s.updated).toLocaleString() : ""}. Your own worksheet, not a decision: a society's genealogists review every entry.` }),
    el("p", {}, el("strong", { text: "The patriot: " }), patLine),
    el("p", {}, el("strong", { text: "Where you are: " }), `${plural(s.generations.length, "generation")}, ${plural(n, "evidence entry", "evidence entries")}, ${plural(missing, "thing")} still missing or flagged.`),
    el("h3", { text: "What to do next" }), plan);
  const where = whereIndexEl(blocks, "Each piece of advice appears once. The letters in the to-do list above point here.");
  const kids = [summary, where, el("section", { class: "report-detail" }, el("h2", { text: "The patriot, in full" }), hasPatriot(s.patriot) ? patriotSummary(s.patriot, s.generations) : el("p", { class: "small", text: "Not filled in yet." }), el("h2", { text: "Your records, generation by generation" }))];
  const detail = kids[2];
  for (const g of s.generations) {
    const rows = byFactOrder(filledCells(g.cells)).map((c) => { const ev = evaluateCell(c);
      return el("tr", {}, el("td", { "data-label": "What it shows", text: FACT_LABELS[c.fact] || STILL_NEEDED }), el("td", { "data-label": "Kind of record", text: c.docType === "census" ? `${DOC_TYPES.census}: ${STILL_NEEDED.toLowerCase()}` : DOC_TYPES[c.docType] || STILL_NEEDED }), el("td", { "data-label": "Says it in words?", text: MODE_TEXT[c.mode] || STILL_NEEDED }),
        el("td", { "data-label": "Where you found it", text: (c.citation || "").trim() || STILL_NEEDED }), el("td", { "data-label": "Status" }, el("span", { class: `badge ${labelClass(ev.label)}`, text: ev.label }), ...ev.cautions.map((k) => el("div", { class: "small caution", text: k.text })))); });
    const facts = [g.born && `born about ${g.born}`, !g.living && g.died && `died about ${g.died}`, g.state && stateName(g.state)].filter(Boolean).join(", ");
    detail.append(...[el("h3", { text: `${genTitle(g.gen)}${g.gen === pg ? " (the patriot)" : ""}${g.who ? ` — ${g.who}` : ""}${g.living ? " (living)" : ""}` }),
      facts ? el("p", { class: "small", text: facts }) : null,
      rows.length ? el("div", { class: "table-wrap" }, el("table", { class: `records${detail.querySelector("table.records") ? " records-more" : ""}` }, el("thead", {}, el("tr", {}, ...["What it shows", "Kind of record", "Says it in words?", "Where you found it", "Status"].map((h) => el("th", { text: h })))), el("tbody", {}, ...rows)))
        : el("p", { class: "small", text: "No records entered yet." })].filter(Boolean));
  }
  body.replaceChildren(...kids);
  // NSCDA cited only in a record's caution (not in "Where to look"): explain it once, under the records.
  if (/NSCDA/.test(body.textContent) && !body.querySelector("[data-nscda-term]")) detail.append(el("p", { class: "small term", "data-nscda-term": "" }, el("strong", { text: "NSCDA: " }), NSCDA_TERM.text.replace(/^NSCDA is /, "")));
}
document.querySelectorAll('[data-tool="lineage-matrix"]').forEach(mountEditor);
document.querySelectorAll('[data-tool-card="lineage-matrix"]').forEach(mountCard);
document.querySelectorAll('[data-tool-report="lineage-matrix"]').forEach((root) => { mountReport(root);
  root.querySelector("[data-print]")?.addEventListener("click", () => window.print());
  // "Save as PDF": prints only the summary and the "Where to look" index (the browser's print window offers "Save as PDF").
  root.querySelector("[data-save-pdf]")?.addEventListener("click", () => {
    document.body.classList.add("print-summary"); const done = () => { document.body.classList.remove("print-summary"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print(); setTimeout(done, 1000); });
  root.querySelector("[data-clear=toolB]")?.addEventListener("click", () => { if (!confirm("Delete your saved entries? This can't be undone.")) return; store.clear(); mountReport(root); }); });
