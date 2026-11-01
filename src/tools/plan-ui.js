// Renders a "What to do next" plan (from nextSteps() / actionPlan()) as a numbered list with a print button.
import { el } from "./storage.js";
const linkList = (links) => links?.length ? el("ul", { class: "plan-links" }, ...links.map((l) => el("li", {}, el("a", { href: l.url, rel: l.url.startsWith("http") ? "noopener" : null, text: l.label })))) : null;
const whereDiv = (w) => w ? el("div", { class: "where" }, el("strong", { text: "Where to look: " }), w.text ? `${w.text} ` : "", w.registrar,
  ...(w.notes || []).map((n) => el("p", { class: `where-note note-${n.kind || "info"}` }, n.text, n.guide ? " " : null, n.guide ? el("a", { href: n.guide.url, "data-substitute": "", text: n.guide.label }) : null)),
  linkList([...w.links, ...w.guides.map((g) => ({ label: `Our guide: ${g.label}`, url: g.url }))])) : null;
// Items may carry sub-items (one group per generation).
const itemList = (items, cls = "plan-items") => el("ul", { class: cls }, ...items.map((it) => el("li", { class: it.conflict ? "conflict" : null },
  it.sub ? el("strong", { class: "plan-group", text: it.text }) : el("span", { text: it.text }), whereDiv(it.where), linkList(it.links), it.sub?.length ? itemList(it.sub, "plan-sub") : null)));
export function renderPlan(steps, { printable = true, heading = true } = {}) {
  const ol = el("ol", { class: "plan-steps" }, ...steps.map((s) => el("li", {},
    el("strong", { class: "plan-title", text: s.title }), s.text ? el("p", { text: s.text }) : null,
    s.items?.length ? itemList(s.items) : null,
    linkList(s.links))));
  const btn = printable ? el("button", { type: "button", class: "big", "data-print-plan": "", onclick: () => {
    document.body.classList.add("print-plan"); const done = () => { document.body.classList.remove("print-plan"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print(); setTimeout(done, 1000); }, text: "Print or save this plan" }) : null;
  return el("div", { class: "plan" }, heading ? el("h2", { class: "plan-h", text: "What to do next" }) : null,
    el("p", { class: "small", text: "Your plan, built from what you entered. Tip: in the print window you can choose \"Save as PDF\"." }), ol, btn);
}
