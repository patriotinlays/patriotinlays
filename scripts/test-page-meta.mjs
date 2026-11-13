// t157: unique 120–155 character meta descriptions; title suffix policy; sitemap lastmod from git content history.
import { META_DESCRIPTIONS, META_MIN, META_MAX, TITLE_SUFFIX, TITLE_BUDGET, withSuffixIfFits, validateMeta, metaFor } from "./lib/page-meta.mjs";
import { allPageLastmods, chicagoDate, lastmodFor } from "./lib/page-lastmod.mjs";
import { chicagoLongDate, chicagoISO } from "./lib/chicago-date.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
let ok = 0, fail = 0;
const t = (name, cond, extra = "") => { const p = !!cond; p ? ok++ : fail++; console.log(`${p ? "PASS" : "FAIL"}  ${name}${p || !extra ? "" : " — " + extra}`); };

const problems = validateMeta();
t("every meta description is unique and 120–155 characters", problems.length === 0, problems.join("; "));
t("the map covers every built page (home, 10 guides, 2 tools, 2 reports, 6 site pages, sources, 404)", Object.keys(META_DESCRIPTIONS).length === 23);

const lens = Object.entries(META_DESCRIPTIONS).map(([p, d]) => `${p}:${[...d].length}`);
t("metaFor('/') returns the home description and throws on an unknown path", metaFor("/") === META_DESCRIPTIONS["/"] && (() => { try { metaFor("/no-such/"); return false; } catch { return true; } })());

t("withSuffixIfFits adds the site-name suffix only when the full title is ≤ 60 characters",
  withSuffixIfFits("Contact") === `Contact${TITLE_SUFFIX}` && withSuffixIfFits("Contact").length <= TITLE_BUDGET
  && withSuffixIfFits("How to Read a Revolutionary War Pension File, Page by Page") === "How to Read a Revolutionary War Pension File, Page by Page"
  && withSuffixIfFits("How to Read a Revolutionary War Pension File, Page by Page").length === 58);

t("a 37-character title plus the 23-character suffix lands on 60 and keeps the suffix; 38 drops it",
  withSuffixIfFits("A".repeat(37)).length === 60 && withSuffixIfFits("A".repeat(37)).endsWith(TITLE_SUFFIX)
  && withSuffixIfFits("A".repeat(38)).length === 38 && !withSuffixIfFits("A".repeat(38)).includes("|"));

t("the existing share image is present at src/assets/og-image.png", existsSync(join(ROOT, "src/assets/og-image.png")));
// PNG IHDR is 16 bytes in, 4-byte width + 4-byte height, big-endian.
{ const b = readFileSync(join(ROOT, "src/assets/og-image.png"));
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  t("the share image is 1200×630 (large enough for twitter:card summary_large_image)", w === 1200 && h === 630, `${w}×${h}`); }

const mods = allPageLastmods();
const sitemapPaths = Object.keys(META_DESCRIPTIONS).filter((p) => p !== "/404.html" && !p.includes("/report/"));
t("lastmod is a YYYY-MM-DD Chicago date for every sitemap page (not reports or 404, which are not in the sitemap)",
  sitemapPaths.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(mods[p])), sitemapPaths.filter((p) => !/^\d{4}-\d{2}-\d{2}$/.test(mods[p] || "")).join(", "));

t("lastmod dates are not in the future and are on or after the Oct 31, 2026 launch",
  sitemapPaths.every((p) => mods[p] >= "2026-10-31" && mods[p] <= chicagoDate(new Date().toISOString())));

t("Same Name lastmod is 2026-11-13 (t172 glossary junior-membership line) and About is 2026-11-10 (t138 content), not a template-only date",
  lastmodFor("/guides/same-name/") === "2026-11-13" && lastmodFor("/about/") === "2026-11-10",
  `same-name=${mods["/guides/same-name/"]} about=${mods["/about/"]}`);

t("widow-pension-checker and lineage-matrix lastmod is 2026-11-13 (t172 accuracy batch); FAQ stays 2026-11-10",
  lastmodFor("/tools/widow-pension-checker/") === "2026-11-13" && lastmodFor("/tools/lineage-matrix/") === "2026-11-13"
  && lastmodFor("/faq/") === "2026-11-10",
  `widow=${mods["/tools/widow-pension-checker/"]} matrix=${mods["/tools/lineage-matrix/"]} faq=${mods["/faq/"]}`);

t("chicagoDate converts a UTC instant to the America/Chicago calendar date",
  chicagoDate("2026-11-11T05:30:00.000Z") === "2026-11-10" && chicagoDate("2026-11-11T06:30:00.000Z") === "2026-11-11");

t("t158: Same Name description uses 'not to someone else with the same name' and stays 120–155",
  /not to someone else with the same name\.$/.test(META_DESCRIPTIONS["/guides/same-name/"])
  && META_DESCRIPTIONS["/guides/same-name/"].length >= META_MIN && META_DESCRIPTIONS["/guides/same-name/"].length <= META_MAX
  && !/another man of the same name/.test(META_DESCRIPTIONS["/guides/same-name/"]));
t("t158: Application Problems description ends exactly with \"from DAR guidance and SAR's national application rules.\" and stays 120–155",
  META_DESCRIPTIONS["/guides/application-problems/"].endsWith("from DAR guidance and SAR's national application rules.")
  && META_DESCRIPTIONS["/guides/application-problems/"].length >= META_MIN && META_DESCRIPTIONS["/guides/application-problems/"].length <= META_MAX);

t("t158: a live-check instant after 6 PM Central (2026-11-12T04:10:43Z) displays as 2026-11-11 / November 11, 2026, and is recorded with a Central offset",
  chicagoDate("2026-11-12T04:10:43.461Z") === "2026-11-11"
  && chicagoLongDate("2026-11-12T04:10:43.461Z") === "November 11, 2026"
  && chicagoISO(new Date("2026-11-12T04:10:43.461Z")) === "2026-11-11T22:10:43.461-06:00"
  && Date.parse(chicagoISO(new Date("2026-11-12T04:10:43.461Z"))) === Date.parse("2026-11-12T04:10:43.461Z"));

console.log(`t157 page-meta: ${ok}/${ok + fail} passed.`);
process.exit(fail ? 1 : 0);
