// The patriot step of the Lineage Evidence Matrix: who he was, where and how he served, and roughly when.
// It drives the service advice (by type of service and state), checks his dates against the DAR period for that
// type of service, and hands his service end date to the widow-pension checker. Pure logic; no network, no storage.
// Every sentence lists its Source Manifest claims; every link is a manifest source_url or a page on this site (tested).
import { checkServiceWindow, MSG } from "./tool-a.js";
import { STATE_SERVICE, NO_STATE_SERVICE, PLACE_SOURCES, stateName } from "./places.js";

// Types of service, using only categories the site's sources define. rule = the DAR date window that applies.
export const SERVICE_KINDS = Object.freeze([
  { id: "continental", label: "Continental Army (the Continental Line)", rule: "core", military: true, claims: ["nara-act-1832-categories"] },
  { id: "militia", label: "State troops, volunteers or militia", rule: "core", military: true, claims: ["nara-act-1832-categories"] },
  { id: "navy", label: "Navy (an officer, marine or mariner)", rule: "core", military: true, claims: ["stat-1848-service", "stat-1855feb-navy"] },
  { id: "military", label: "Military, not sure which kind", rule: "core", military: true, claims: [] },
  { id: "civil", label: "Civil service (for example town clerk, juror, constable, justice of the peace)", rule: "core", claims: ["dar-civil-service", "dar-civil-examples"] },
  { id: "patriotic", label: "Patriotic service (for example furnishing supplies, lending money, signing an oath of allegiance)", rule: "core", claims: ["dar-material-aid", "dar-oaths"] },
  { id: "committee", label: "A committee that furthered the cause (counts from April 1774)", rule: "committee", claims: ["dar-committee-1774"] },
  { id: "va_oath", label: "Virginia Oath of Fidelity (counts from October 1779)", rule: "va_oath", claims: ["dar-va-oath"] },
  { id: "galvez_troops", label: "Spanish troops under Gálvez, or the Louisiana Militia", rule: "galvez_troops", claims: ["dar-galvez-troops"] },
  { id: "galvez_cattle", label: "Supplying cattle for Gálvez's forces", rule: "galvez_cattle", claims: ["dar-galvez-cattle"] },
]);
export const kindOf = (id) => SERVICE_KINDS.find((k) => k.id === id) || null;
export const PATRIOT_HELP = Object.freeze({
  state: { text: "For military service, DAR records only the state that controlled his unit, not every state he passed through.", claims: ["dar-unit-state"] },
  kind: { text: "Not sure? Pick \"Military, not sure which kind\". Some types have their own dates.", claims: [] },
});
const NARA = { amrev: { label: "National Archives: The American Revolution (service records, rolls and pension files)", url: "https://www.archives.gov/research/military/american-revolution" },
  svc: { label: "National Archives: Revolutionary War service records (PDF)", url: "https://www.archives.gov/files/research/military/american-revolution/service-records.pdf" } };
const GUIDE = { service: { label: "Guide: Patriotic Service Without a Musket", url: "/guides/patriotic-service/" },
  byState: { label: "Guide: Revolutionary War Records by State", url: "/guides/records-by-state/" },
  pension: { label: "Guide: How to Read a Revolutionary War Pension File", url: "/guides/read-pension-file/" } };
export const WIDOW_TOOL = { label: "Widow Pension Law Checker (free tool on this site)", url: "/tools/widow-pension-checker/" };

// Is anything typed in yet?
export const hasPatriot = (p) => !!(p && (p.name || p.state || p.kind || p.start || p.end || p.unit));

// Date check against the DAR period for his type of service (the old standalone "service window" check, folded in).
export function patriotDates(p) {
  if (!p || !p.start) return null;
  const k = kindOf(p.kind) || kindOf("military");
  const r = checkServiceWindow({ serviceType: k.rule, start: p.start, end: p.end || p.start });
  return { ...r, kind: k.id, plain: r.status === "consistent" ? "His dates fall inside the period DAR accepts for this type of service. This is not a ruling: your society decides." : r.message };
}

// How to prove his service: by type of service, then by state. Returns { text, claims, links }.
export function serviceWhere(p) {
  const k = kindOf(p?.kind);
  const parts = [];
  if (!k || k.id === "military") parts.push({ text: "First find out whether he served in the Continental Line or in the state troops or militia: the National Archives holds Continental records, but not state militia records, which are at the archives of the state he served.", claims: ["nara-svc-holds", "nara-svc-custody", "nara-svc-state"], links: [NARA.svc] });
  else if (k.id === "continental") parts.push({ text: "The National Archives holds records of Continental troops, including compiled service records (M881) and the Revolutionary War rolls (M246).", claims: ["nara-svc-holds", "nara-amrev-m881", "nara-amrev-m246"], links: [NARA.amrev, NARA.svc] });
  else if (k.id === "militia") parts.push({ text: "The National Archives does not hold state militia records; check the archives of the state he served. The 1832 pension law opened pensions to militia service of at least six months, so look for his pension file too.", claims: ["nara-svc-custody", "nara-svc-state", "nps-1832"], links: [NARA.svc, NARA.amrev] });
  else if (k.id === "navy") parts.push({ text: "Look for his pension file too: the 1848 widows' law named the naval service, and a February 1855 law covered widows of navy officers, marines and mariners of the Revolutionary War.", claims: ["stat-1848-service", "stat-1855feb-navy"], links: [NARA.amrev] });
  else if (k.id === "galvez_troops" || k.id === "galvez_cattle") parts.push({ text: "DAR's Patriot Records Project includes some French and Spanish records.", claims: ["prp-french-spanish"], links: [PLACE_SOURCES.darPrp] });
  else parts.push({ text: "DAR proves this kind of service with original records such as oaths of allegiance, town meeting minutes and county court orders.", claims: ["dar-service-sources"], links: [GUIDE.service] });
  if (k?.military) parts.push({ text: "DAR also asks for original records such as pensions, muster rolls and pay vouchers.", claims: ["dar-service-sources"], links: [] });
  if (p?.state) {
    const s = STATE_SERVICE[p.state] || NO_STATE_SERVICE(stateName(p.state));
    parts.push({ text: `${stateName(p.state)}: ${s.text}`, claims: s.claims, links: [...s.links, GUIDE.byState] });
  } else parts.push({ text: "Add the state he served for to see that state's records.", claims: [], links: [GUIDE.byState] });
  parts.push({ text: "SAR does not take family tradition as proof of service.", claims: ["sar-tradition"], links: [] });
  return { parts, text: parts.map((x) => x.text).join(" "), claims: [...new Set(parts.flatMap((x) => x.claims))], links: dedupe(parts.flatMap((x) => x.links)) };
}
const dedupe = (ls) => ls.filter((l, i) => ls.findIndex((m) => m.url === l.url) === i);

// Plan steps that come from the patriot step.
export function patriotSteps(p) {
  if (!hasPatriot(p)) return [{ title: "Tell the worksheet about the patriot", text: "Fill in step 1: his name, the state he served for, the type of service and rough dates. The advice then fits how and where he served.", claims: [], links: [] }];
  const steps = [];
  const missing = [!p.state && "the state he served for", !p.kind && "the type of service", !p.start && "rough service dates"].filter(Boolean);
  if (missing.length) steps.push({ title: "Finish the patriot step", text: `Still needed in step 1: ${missing.join(", ")}.`, claims: [], links: [] });
  const d = patriotDates(p);
  if (d && d.status === "invalid") steps.push({ title: "Fix his service dates", text: d.message, claims: [], links: [] });
  else if (d && d.status === "inconsistent") steps.push({ title: "Double-check his service dates and type of service", text: "His dates fall outside the period DAR accepts for the type of service you picked. Some types have their own start dates. If the dates are right, ask your society's registrar before going further.", claims: [d.claim, "dar-committee-1774", "dar-va-oath"].filter(Boolean), links: [GUIDE.service] });
  else if (d && d.status === "partial") steps.push({ title: "Pin down his exact service dates", text: "Part of his date range falls outside the period DAR accepts for this type of service. The exact dates in the original records will settle it.", claims: [d.claim].filter(Boolean), links: [] });
  const w = serviceWhere(p);
  steps.push({ title: "Prove the patriot's service", text: "Where to look, based on his type of service and the state he served for:", items: w.parts.map((x) => ({ text: x.text })), claims: w.claims, links: w.links });
  const k = kindOf(p.kind);
  if (!k || k.military) steps.push({ title: "Check the widow-pension laws for him", text: "Widows could apply for pensions from 1836. A widow's application may give her maiden name and the date and place of the marriage, so her file can prove a link in your line. The free checker shows which widow laws fit; it can fill in his service end date from this worksheet.", claims: ["nara-amrev-1836", "m804-widow-info"], links: [WIDOW_TOOL, GUIDE.pension] });
  return steps;
}
