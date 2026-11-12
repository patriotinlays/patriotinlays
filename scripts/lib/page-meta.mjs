// t157: search housekeeping. Meta descriptions live here, not in frontmatter, so:
//  - the home-page guide-list blurbs (fm.description) stay unchanged (no visible page changes)
//  - a meta-only edit does not count as a content change for sitemap lastmod
// Each description is unique, 120–155 characters, and uses only wording and ideas already on that page.

export const META_MIN = 120;
export const META_MAX = 155;
export const TITLE_SUFFIX = " | Patriot In Lay Terms";
export const TITLE_BUDGET = 60;

// path -> description. Every built HTML page must have an entry.
export const META_DESCRIPTIONS = {
  "/": "Plain-English guides and free browser tools for documenting descent from a Revolutionary War patriot for a DAR or SAR application.",
  "/about/": "Who this site is for, what its ten guides and two free tools can and cannot do, and how every fact is tied to a quoted official or institutional source.",
  "/ai-disclosure/": "See how this site is written with AI assistance and reviewed by its owner, and how each fact is tied to a quoted official or institutional source.",
  "/contact/": "Email this site with a correction or a suggestion, what to include, and why it cannot review individual lineage applications or say who will be approved.",
  "/faq/": "Plain-English answers about joining DAR or SAR, what a patriot is, which records count, how this site's tools work, and where your information goes.",
  "/privacy/": "What you type into this site's two tools stays in your own browser: how that works, how to delete it, and what the site itself collects.",
  "/sources/": "See how every factual sentence on this site is tied to a quoted official or institutional source, and how the build fails if a quote cannot be found.",
  "/walkthroughs/": "Step-by-step examples of the Widow Pension Law Checker and the Lineage Evidence Matrix, using a made-up family and the tools' real results.",
  "/guides/application-problems/": "Diagnose why a DAR or SAR application or a patriot's service was questioned, and how to fix it, from DAR guidance and SAR's national application rules.",
  "/guides/bounty-land-warrants/": "How federal and state Revolutionary War bounty-land files work as evidence of service, residence and family, and where they mislead.",
  "/guides/census-bridge/": "Work across the gap between a mid-1800s named census and earlier ones that list only the household head, with a step-by-step plan.",
  "/guides/lineage-proof-roadmap/": "A generation-by-generation plan for documenting descent from a Revolutionary War patriot, with DAR and SAR rules side by side.",
  "/guides/patriot-or-loyalist/": "Test your ancestor's loyalty evidence from both sides before you apply, using SAR and DAR rules and Loyalist records to see which side they took.",
  "/guides/patriotic-service/": "Prove non-military service for DAR or SAR: committees, oaths, petitions, town office, supply taxes or furnished goods, and each type's date window.",
  "/guides/read-pension-file/": "Find a Revolutionary War pension file, decode its envelope, and read declarations, affidavits and widow's papers in the right order.",
  "/guides/records-by-state/": "Work out whether an ancestor's service records sit at the National Archives or a state archive, then search the right place.",
  "/guides/same-name/": "A disambiguation checklist for proving that a Revolutionary War record belongs to your ancestor and not to someone else with the same name.",
  "/guides/substitute-evidence/": "Prove each generation without a birth certificate, using substitute records sorted by era, and see what those records can and cannot show.",
  "/tools/lineage-matrix/": "A free worksheet that organizes the records you already have for each generation of a DAR or SAR line, shows what's still missing, and prints a gap report.",
  "/tools/widow-pension-checker/": "A free checker that compares a widow's marriage date and her husband's service with each federal widow pension and bounty-land law from 1836 to 1878.",
  "/tools/lineage-matrix/report/": "Print a gap report of what's still missing in your line, where to look, and the records you entered, built in this browser from this device only.",
  "/tools/widow-pension-checker/report/": "Print a report of the dates you checked in the Widow Pension Law Checker and what the published pension laws say about them, built in this browser only.",
  "/404.html": "That page doesn't exist. Go to the home page, or start with the Lineage Evidence Matrix, the Widow Pension Law Checker, or the Roadmap guide.",
};

export function withSuffixIfFits(title) {
  const full = `${title}${TITLE_SUFFIX}`;
  return full.length <= TITLE_BUDGET ? full : title;
}

export function validateMeta(map = META_DESCRIPTIONS) {
  const problems = [];
  const seen = new Map();
  for (const [path, desc] of Object.entries(map)) {
    if (typeof desc !== "string") { problems.push(`${path}: not a string`); continue; }
    const n = [...desc].length; // code-point length; all current strings are BMP
    if (n < META_MIN || n > META_MAX) problems.push(`${path}: ${n} characters (need ${META_MIN}–${META_MAX})`);
    if (seen.has(desc)) problems.push(`${path}: duplicate of ${seen.get(desc)}`);
    else seen.set(desc, path);
  }
  return problems;
}

export function metaFor(path) {
  const desc = META_DESCRIPTIONS[path];
  if (!desc) throw new Error(`t157: no meta description for ${path}`);
  return desc;
}
