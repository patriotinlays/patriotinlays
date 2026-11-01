// Renders a "What to do next" plan (from nextSteps() / actionPlan()) as a numbered list with a print button.
import { el } from "./storage.js";
const linkList = (links) => links?.length ? el("ul", { class: "plan-links" }, ...links.map((l) => el("li", {}, el("a", { href: l.url, rel: l.url.startsWith("http") ? "noopener" : null, text: l.label })))) : null;
export function renderPlan(steps, { printable = true, heading = true } = {}) {
  const ol = el("ol", { class: "plan-steps" }, ...steps.map((s) => el("li", {},
    el("strong", { class: "plan-title", text: s.title }), s.text ? el("p", { text: s.text }) : null,
    s.items?.length ? el("ul", { class: "plan-items" }, ...s.items.map((it) => el("li", {}, el("span", { text: it.text }),
      it.where ? el("div", { class: "where" }, el("strong", { text: "Where to look: " }), it.where.text ? `${it.where.text} ` : "", it.where.registrar,
        linkList([...it.where.links, ...it.where.guides.map((g) => ({ label: `Our guide: ${g.label}`, url: g.url }))])) : null))) : null,
    linkList(s.links))));
  const btn = printable ? el("button", { type: "button", class: "big", "data-print-plan": "", onclick: () => {
    document.body.classList.add("print-plan"); const done = () => { document.body.classList.remove("print-plan"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print(); setTimeout(done, 1000); }, text: "Print or save this plan" }) : null;
  return el("div", { class: "plan" }, heading ? el("h2", { class: "plan-h", text: "What to do next" }) : null,
    el("p", { class: "small", text: "Your plan, built from what you entered. Tip: in the print window you can choose \"Save as PDF\"." }), ol, btn);
}
