// Renders a "What to do next" plan (from nextSteps() / actionPlan()) as a numbered list with a print button.
import { el } from "./storage.js";
const linkList = (links) => links?.length ? el("ul", { class: "plan-links" }, ...links.map((l) => el("li", {}, el("a", { href: l.url, rel: l.url.startsWith("http") ? "noopener" : null, text: l.label })))) : null;
// One "Where to look" note. A "no verified source for this state" note is printed in full the first time on a page and
// as a one-line pointer after that (seen = a Set shared by everything rendered on the page; audit 3).
export function noteEl(n, seen = null) {
  if (n.kind === "nosource" && seen) {
    if (seen.has(n.key)) return el("p", { class: "where-note note-nosource note-ref", "data-note": "nosource-ref" }, `No verified source yet for ${n.place}'s ${n.fact} records; see the ${n.place} note above.`);
    seen.add(n.key);
  }
  return el("p", { class: `where-note note-${n.kind || "info"}`, "data-note": n.kind || "info" }, n.text, n.guide ? " " : null, n.guide ? el("a", { href: n.guide.url, "data-substitute": "", text: n.guide.label }) : null);
}
const whereDiv = (w, seen = null) => w ? el("div", { class: "where" }, el("strong", { text: "Where to look: " }), w.text ? `${w.text} ` : "", w.registrar,
  ...(w.notes || []).map((n) => noteEl(n, seen)),
  linkList([...w.links, ...w.guides.map((g) => ({ label: `Our guide: ${g.label}`, url: g.url }))])) : null;
// In the report, "Where to look" advice is printed once and items point to it by letter (whereRef returns the letters).
const refSpan = (letters) => letters?.length ? el("span", { class: "where-ref", "data-where-ref": letters.join(",") }, " Where to look: ",
  ...letters.flatMap((L, i) => [i ? ", " : null, el("a", { href: `#where-${L}`, text: L })])) : null;
// Items may carry sub-items (one group per generation).
// In the report (whereRef set), unfinished records use a brief line, and a missing record gets an "Add it" link to that
// generation in the worksheet (screen only), so the patriot's generation has a clear way to add the record it asks for.
const addLink = (it, opts) => opts.addHref && it.add && it.gen ? el("a", { class: "add-link no-print", "data-add-link": `${it.gen}:${it.add}`, href: opts.addHref(it), text: "Add it in the worksheet" }) : null;
const itemList = (items, cls = "plan-items", opts = {}) => el("ul", { class: cls }, ...items.map((it) => el("li", { class: it.conflict ? "conflict" : null },
  it.sub ? el("strong", { class: "plan-group", text: it.text }) : el("span", { text: opts.whereRef && it.brief ? it.brief : it.text }), it.sub ? null : addLink(it, opts) ? " " : null, it.sub ? null : addLink(it, opts),
  opts.whereRef ? refSpan(it.where ? opts.whereRef(it.where, it) : null) : whereDiv(it.where, opts.seen), linkList(it.links), it.sub?.length ? itemList(it.sub, "plan-sub", opts) : null)));
export function renderPlan(steps, { printable = true, heading = true, whereRef = null, tip = true, addHref = null, seen = null } = {}) {
  const ol = el("ol", { class: "plan-steps" }, ...steps.map((s) => el("li", {},
    el("strong", { class: "plan-title", text: s.title }), s.text ? el("p", { text: s.text }) : null,
    s.items?.length ? itemList(s.items, "plan-items", { whereRef, addHref, seen }) : null,
    linkList(s.links))));
  const btn = printable ? el("button", { type: "button", class: "big", "data-print-plan": "", onclick: () => {
    document.body.classList.add("print-plan"); const done = () => { document.body.classList.remove("print-plan"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print(); setTimeout(done, 1000); }, text: "Save as PDF or print this plan" }) : null;
  return el("div", { class: "plan" }, heading ? el("h2", { class: "plan-h", text: "What to do next" }) : null,
    tip ? el("p", { class: "small", text: "Your plan, built from what you entered. To save it, press the button below and choose \"Save as PDF\" in the print window." }) : null, ol, btn);
}
export { whereDiv };
