// Memorable-date fields (GOV.UK / USWDS pattern) shared by both tools: a fieldset with a legend and an example hint,
// Month (names, "Don't know" first), Day (optional, 2 digits) and Year (4 digits) on the number pad, then
// "How sure are you?" (Exactly / About / Before / After) with the range shown in words. No calendar picker, no free text.
// The value lives in one hidden input (see dates.js for the stored format), so saved dates like "1777-05" still load.
import { el } from "./storage.js";
import { MONTHS, CERTAINTY, ABOUT_NOTE, encodeDate, decodeDate, dateProblem, rangeWords } from "./dates.js";
const OFF = { autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: "false" };

// opts: { id, name, legend, hint?, why?, example?, value?, onChange?(value) }. Returns the fieldset; fieldset.setValue(v) loads a value.
export function dateField(opts) {
  const { id, name, legend, example = "For example, May 1777, or 4 May 1777. Leave the day blank if you don't know it.", value = "" } = opts;
  const hidden = el("input", { type: "hidden", name, id: `${id}-value`, value: "" });
  const month = el("select", { id: `${id}-month`, "data-part": "month", ...OFF }, el("option", { value: "", text: "Don't know" }), ...MONTHS.map((m, i) => el("option", { value: String(i + 1), text: m })));
  const day = el("input", { id: `${id}-day`, "data-part": "day", type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: "2", size: "2", class: "date-day", ...OFF });
  const year = el("input", { id: `${id}-year`, "data-part": "year", type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: "4", size: "4", class: "date-year", ...OFF });
  const cert = el("select", { id: `${id}-cert`, "data-part": "cert", ...OFF }, ...CERTAINTY.map(([v, t]) => el("option", { value: v, text: t })));
  const range = el("p", { class: "small hint date-range", "data-range": "", "aria-live": "polite" });
  const err = el("p", { class: "small warn date-error", "data-date-error": "", role: "alert", hidden: true });
  const fs = el("fieldset", { class: "date-field", id, tabindex: "-1", "data-date-field": name },
    el("legend", { text: legend }),
    opts.why ? el("p", { class: "small hint", "data-why": opts.why }) : null,
    opts.hint ? el("p", { class: "small hint", text: opts.hint }) : null,
    el("p", { class: "small hint", id: `${id}-hint`, text: example }),
    el("div", { class: "date-parts" },
      el("div", { class: "date-part" }, el("label", { for: `${id}-month`, text: "Month" }), month),
      el("div", { class: "date-part" }, el("label", { for: `${id}-day`, text: "Day (optional)" }), day),
      el("div", { class: "date-part" }, el("label", { for: `${id}-year`, text: "Year" }), year),
      el("div", { class: "date-part" }, el("label", { for: `${id}-cert`, text: "How sure are you?" }), cert)),
    range, err, hidden);
  const parts = () => ({ year: year.value.trim(), month: month.value, day: day.value.trim(), cert: cert.value || "exact" });
  // problem() = the sentence to show, or null. Shown only once something is typed.
  fs.problem = () => dateProblem(parts());
  const update = (fire = true) => {
    const p = parts(), bad = dateProblem(p);
    hidden.value = bad ? "" : encodeDate(p);
    err.hidden = !bad || (!p.year && !p.day && !p.month); err.textContent = bad ? `Check this date: ${bad}` : "";
    const words = !bad && p.year ? rangeWords(hidden.value) : "";
    range.replaceChildren(...[words, p.cert === "about" && p.year ? `With "About", the day is ignored. ${ABOUT_NOTE}` : ""].filter(Boolean).map((t) => el("span", { text: `${t} ` })));
    fs.classList.toggle("has-error", !!bad && !err.hidden);
    if (fire) opts.onChange?.(hidden.value);
  };
  fs.setValue = (v) => { const p = decodeDate(v); month.value = p.month || ""; day.value = p.day || ""; year.value = p.year || ""; cert.value = p.cert || "exact"; update(false); };
  fs.value = () => hidden.value;
  fs.refresh = () => update(false);
  for (const c of [month, cert]) c.addEventListener("change", () => update());
  for (const c of [day, year]) c.addEventListener("input", () => { c.value = c.value.replace(/\D/g, ""); update(); });
  fs.setValue(value);
  return fs;
}
// After a form reset the controls are back at their defaults; refresh only the words shown (a prefill may follow).
// Static pages: <div data-date-mount="marriage" data-id="tw-m" data-legend="..." data-why="marriage"></div>
export function mountDates(root) {
  root.querySelectorAll("[data-date-mount]").forEach((m) => {
    const fs = dateField({ id: m.dataset.id, name: m.dataset.dateMount, legend: m.dataset.legend, why: m.dataset.why || null });
    m.replaceWith(fs);
  });
  root.querySelectorAll("form").forEach((f) => f.addEventListener("reset", () => setTimeout(() => f.querySelectorAll("[data-date-field]").forEach((fs) => fs.refresh()), 0)));
}
export const setDate = (form, name, v) => form.querySelector(`[data-date-field="${name}"]`)?.setValue(v || "");
// First problem in a form's date fields, as "<legend>: <problem>", or null.
export function dateErrors(form) {
  for (const fs of form.querySelectorAll("[data-date-field]")) { const p = fs.problem(); if (p) return `${fs.querySelector("legend").textContent} ${p}`; }
  return null;
}
