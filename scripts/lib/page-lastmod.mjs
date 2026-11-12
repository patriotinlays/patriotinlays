// t157: sitemap <lastmod> is the date each page's *content* last changed, from git history.
// Method:
//  1. Map each sitemap URL to its content files (the page's Markdown, any ::partial or ::archive-figure
//     it includes, glossary/next-steps boxes that appear on it, and figure JSON).
//  2. Walk `git log` of those files, newest first, in America/Chicago. A commit counts if it changed
//     the visible body (or a visible title). It does not count if it only changed frontmatter
//     `description` / `launch_setup` (the guide-list blurb is home-page content, not the guide's),
//     or only comments.
//  3. For visible body strings that live in scripts/build.mjs (home intro/cards, tool callout,
//     sources, report and 404 bodies), a build.mjs commit counts only when its diff contains a
//     marker for that page. Head-template, sitemap, NAV/FOOT and meta-tag edits do not count.
//  4. A frontmatter `description` change on a guide *does* count for the home page, where that
//     blurb is shown.
// Meta-only files (this module, page-meta.mjs) are never content files.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chicagoDate } from "./chicago-date.mjs";

const ROOT = new URL("../..", import.meta.url).pathname;

function git(args, opts = {}) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...opts });
}

function parseFront(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return { fm, body: m[2] };
}

function contentBody(raw) {
  // Body plus visible frontmatter (title). Drop description / launch_setup, which are not this page's body.
  const { fm, body } = parseFront(raw);
  const vis = Object.entries(fm)
    .filter(([k]) => k !== "description" && k !== "launch_setup" && k !== "meta_description")
    .map(([k, v]) => `${k}:${v}`)
    .join("\n");
  return vis + "\n" + body;
}

function fileAt(rev, file) {
  try { return git(["show", `${rev}:${file}`]); } catch { return null; }
}

function commitChangesContent(hash, file) {
  const now = fileAt(hash, file);
  if (now === null) return false;
  const parent = fileAt(`${hash}^`, file);
  if (parent === null) return true; // added
  if (parent === now) return false;
  // Markdown (or any file we treat as content): ignore description-only frontmatter edits.
  if (file.endsWith(".md")) return contentBody(parent) !== contentBody(now);
  return true;
}

const BUILD_MARKERS = {
  "/": ["START_CARDS", "data-home-h1", "data-home-intro", "data-independent", "data-see-how", "homeMission", "HOME_MORE_SUMMARY", "data-home-glossary", "Words You'll See Here", "home-help", "home-guides", "home-mission"],
  "/tools/widow-pension-checker/": ["data-roadmap-callout", "data-roadmap-pointer", "fm.tool)"],
  "/tools/lineage-matrix/": ["data-roadmap-callout", "data-roadmap-pointer", "fm.tool)", "form-note"],
  "/sources/": ["Sources & Methodology", "Sources in the manifest", "write(\"sources\""],
  "/tools/widow-pension-checker/report/": ["data-tool-report=\"widow\"", "Widow Pension Law Checker: your report", "write(\"tools/widow-pension-checker/report\""],
  "/tools/lineage-matrix/report/": ["data-tool-report=\"lineage-matrix\"", "Lineage Evidence Matrix: your report", "write(\"tools/lineage-matrix/report\""],
  "/404.html": ["Page not found", "404.html"],
};

// Start cards appear on every src/pages body (and 404). A change to START_CARDS is content for those pages.
const START_CARD_PAGES = ["/about/", "/ai-disclosure/", "/contact/", "/faq/", "/privacy/", "/walkthroughs/", "/sources/", "/404.html"];

function buildMjsDiff(hash) {
  try { return git(["show", hash, "--format=", "--", "scripts/build.mjs"]); } catch { return ""; }
}

function changedLines(diff) {
  // Only added/removed lines, not hunk headers (@@) or context. Avoids false hits when a
  // nearby marker appears in a hunk header or an unchanged context line.
  return diff.split("\n").filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---")).join("\n");
}
function commitTouchesBuildMarkers(hash, markers) {
  const diff = changedLines(buildMjsDiff(hash));
  if (!diff) return false;
  return markers.some((m) => diff.includes(m));
}

function logCommits(files) {
  const existing = files.filter((f) => {
    try { git(["ls-files", "--error-unmatch", f], { stdio: ["ignore", "pipe", "ignore"] }); return true; } catch { return existsSync(join(ROOT, f)) && git(["log", "-1", "--format=%H", "--", f]).trim(); }
  });
  if (!existing.length) return [];
  const out = git(["log", "--format=%H\t%cI", "--", ...existing]);
  return out.trim().split("\n").filter(Boolean).map((line) => {
    const i = line.indexOf("\t");
    return { hash: line.slice(0, i), iso: line.slice(i + 1) };
  });
}

function guideFiles() {
  const dir = join(ROOT, "src/content");
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => `src/content/${f}`);
}

function filesForMarkdown(rel) {
  const raw = readFileSync(join(ROOT, rel), "utf8");
  const { fm, body } = parseFront(raw);
  const files = [rel];
  for (const m of body.matchAll(/::partial ([a-z0-9-]+)/g)) files.push(`src/partials/${m[1]}.md`);
  for (const m of body.matchAll(/::archive-figure ([a-z0-9-]+)/g)) {
    const json = `src/figures/${m[1]}.json`;
    files.push(json);
    if (existsSync(join(ROOT, json))) {
      try {
        const fig = JSON.parse(readFileSync(join(ROOT, json), "utf8"));
        if (fig.src) files.push(fig.src.startsWith("src/") ? fig.src : `src/assets/archives/${fig.src.replace(/^.*\//, "")}`);
      } catch { /* ignore */ }
    }
  }
  if (fm.cornerstone) {
    files.push("src/partials/glossary.md");
    const own = (fm.tools || fm.tool || "").includes && false;
    // cornerstone guides get next-steps based on tool affinity in the body/fm; include both and let unused ones
    // only bump lastmod if they actually changed — that's slightly conservative (a widow next-steps edit
    // would also bump a lineage guide). Prefer precision: widow vs lineage from ctx.tools is decided at
    // build from claims. We inspect fm.tools or the slug.
    const widow = /widow|pension/i.test(rel) || /widow/.test(JSON.stringify(fm));
    files.push(widow ? "src/partials/next-steps-widow.md" : "src/partials/next-steps-lineage.md");
  }
  if (fm.tool) files.push("src/partials/glossary.md");
  return [...new Set(files)].filter((f) => existsSync(join(ROOT, f)));
}

function pageSourceMap() {
  const map = {};
  for (const f of readdirSync(join(ROOT, "src/content")).filter((x) => x.endsWith(".md"))) {
    const raw = readFileSync(join(ROOT, "src/content", f), "utf8");
    const { fm } = parseFront(raw);
    if (!fm.slug) continue;
    const path = `/${fm.slug}/`;
    map[path] = { files: filesForMarkdown(`src/content/${f}`), markers: BUILD_MARKERS[path] || [] };
  }
  for (const f of readdirSync(join(ROOT, "src/pages")).filter((x) => x.endsWith(".md"))) {
    const raw = readFileSync(join(ROOT, "src/pages", f), "utf8");
    const { fm } = parseFront(raw);
    if (!fm.slug) continue;
    const path = `/${fm.slug}/`;
    const markers = [...(BUILD_MARKERS[path] || [])];
    if (START_CARD_PAGES.includes(path) && !markers.includes("START_CARDS")) markers.push("START_CARDS");
    map[path] = { files: filesForMarkdown(`src/pages/${f}`), markers };
  }
  map["/"] = {
    files: ["src/partials/home.md", "src/partials/glossary.md"],
    markers: BUILD_MARKERS["/"],
    descriptionFiles: guideFiles(), // description-only edits count here
  };
  map["/sources/"] = { files: [], markers: BUILD_MARKERS["/sources/"].concat(["START_CARDS"]) };
  map["/tools/widow-pension-checker/report/"] = { files: [], markers: BUILD_MARKERS["/tools/widow-pension-checker/report/"] };
  map["/tools/lineage-matrix/report/"] = { files: [], markers: BUILD_MARKERS["/tools/lineage-matrix/report/"] };
  map["/404.html"] = { files: [], markers: BUILD_MARKERS["/404.html"].concat(["START_CARDS"]) };
  return map;
}

function lastContentIso(path, sources) {
  const dates = [];
  const seen = new Set();
  for (const { hash, iso } of logCommits(sources.files || [])) {
    if (seen.has(hash)) continue;
    seen.add(hash);
    const touched = (sources.files || []).some((f) => commitChangesContent(hash, f));
    if (touched) dates.push(iso);
  }
  if (sources.descriptionFiles) {
    for (const { hash, iso } of logCommits(sources.descriptionFiles)) {
      if (seen.has(`${hash}-desc`)) continue;
      seen.add(`${hash}-desc`);
      // count only if some guide's *description* (the home blurb) changed and the guide body/title did not
      // ...or even if body also changed: the home list still changed. Any description change counts.
      const changedDesc = sources.descriptionFiles.some((f) => {
        const a = fileAt(`${hash}^`, f), b = fileAt(hash, f);
        if (b === null) return false;
        if (a === null) return parseFront(b).fm.description;
        return parseFront(a).fm.description !== parseFront(b).fm.description;
      });
      if (changedDesc) dates.push(iso);
    }
  }
  if (sources.markers && sources.markers.length) {
    for (const { hash, iso } of logCommits(["scripts/build.mjs"])) {
      if (commitTouchesBuildMarkers(hash, sources.markers)) dates.push(iso);
    }
  }
  if (!dates.length) return null;
  dates.sort();
  return dates[dates.length - 1];
}

let _cache;
export function allPageLastmods() {
  if (_cache) return _cache;
  const map = pageSourceMap();
  const out = {};
  for (const [path, src] of Object.entries(map)) {
    const iso = lastContentIso(path, src);
    if (!iso) throw new Error(`t157: no content lastmod for ${path}`);
    out[path] = chicagoDate(iso);
  }
  _cache = out;
  return out;
}

export function lastmodFor(path) {
  const all = allPageLastmods();
  if (!all[path]) throw new Error(`t157: no content lastmod for ${path}`);
  return all[path];
}

export { pageSourceMap }; // for tests

export { chicagoDate } from "./chicago-date.mjs";
