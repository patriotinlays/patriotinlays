// Static site build (no dependencies). `prebuild` runs the tests and the Source Manifest gate first.
// Renders src/content/*.md (guides + tool pages) and src/pages/*.md (site pages) into dist/, plus home,
// sources page, tool report pages, sitemap.xml, robots.txt and 404.html.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "dist");
const SITE = "https://patriotinlays.com";
const BUILD_DATE = "2026-10-31";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "assets/js"), { recursive: true });
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest/claims.json"), "utf8"));
const claims = new Map(manifest.claims.map((c) => [c.claim_id, c]));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Cache-busting: every script/CSS URL carries ?v=<content hash>. Relative ES-module imports between the tool
// files are rewritten the same way, and a module's hash covers its rewritten imports, so any change to a
// dependency also changes the URL of every module that imports it.
const hash8 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);
const ASSET_V = new Map(); // "/assets/js/x.js" -> hash
const toolSrc = new Map(readdirSync(join(ROOT, "src/tools")).filter((f) => f.endsWith(".js")).map((f) => [f, readFileSync(join(ROOT, "src/tools", f), "utf8")]));
const IMPORT_RE = /(\bfrom\s+|\bimport\s*\(?\s*)"\.\/([\w.-]+\.js)"/g;
function versionModule(f, seen = new Set()) {
  const key = `/assets/js/${f}`; if (ASSET_V.has(key)) return ASSET_V.get(key);
  if (seen.has(f)) throw new Error(`build: import cycle at ${f}`); seen.add(f);
  if (!toolSrc.has(f)) throw new Error(`build: ${f} imports a file not in src/tools`);
  const out = toolSrc.get(f).replace(IMPORT_RE, (_, pre, dep) => `${pre}"./${dep}?v=${versionModule(dep, seen)}"`);
  const v = hash8(out); writeFileSync(join(OUT, "assets/js", f), out); ASSET_V.set(key, v); return v;
}
for (const f of toolSrc.keys()) versionModule(f);
const css = readFileSync(join(ROOT, "src/assets/site.css"), "utf8"); writeFileSync(join(OUT, "assets/site.css"), css); ASSET_V.set("/assets/site.css", hash8(css));
const versionUrls = (html) => html.replace(/(src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g, (m, a, u) => ASSET_V.has(u) ? `${a}="${u}?v=${ASSET_V.get(u)}"` : m);
copyFileSync(join(ROOT, "src/assets/favicon.svg"), join(OUT, "favicon.svg"));

function parseFront(raw) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw); const fm = {};
  if (m) for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, ""); }
  return { fm, body: m ? raw.slice(m[0].length) : raw };
}
function inline(text, ctx) {
  let s = esc(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/\s*\[\[claim:([a-z0-9-]+)\]\]/g, (_, id) => {
    const c = claims.get(id); if (!c) throw new Error(`build: unknown claim ${id}`);
    let n = ctx.sources.indexOf(c.source_url) + 1; if (!n) { ctx.sources.push(c.source_url); n = ctx.sources.length; }
    ctx.claimCount++; return `<sup><a href="#src-${n}" title="${esc(c.source_title)}">[${n}]</a></sup>`;
  });
  return s;
}
const DATE_HINT = `<p class="small hint" id="date-hint">Numbers only, e.g. 1776 or 1776-07 (a full date like 1776-07-04 also works).</p>`;
const TOOL_A_FORM = (full) => `<section class="tool" data-tool="service-window" aria-labelledby="ta-h">
<h2 id="ta-h">${full ? "Use the checker" : "Try it: Service Window Checker"}</h2>
<div class="howto"><p><strong>How this works.</strong> This checker does not search any records or databases. You type the dates you already know about your ancestor. It compares them with the published date rules and tells you whether they fit. Nothing you type leaves your device; it is saved only in this browser.</p>
<p><button type="button" class="secondary" data-load-example>Load an example</button> <span class="small" data-example-msg aria-live="polite">Fills in a made-up soldier so you can see a result right away.</span></p></div>
<h3 class="step"><span class="num">1</span> ${full ? "Check the service dates" : "Check service dates"}</h3>
<form data-form="window"><label for="ta-type">What kind of service was it?</label>
<p class="small hint">Not sure? Pick the first choice. The others have their own start dates.</p><select id="ta-type" name="serviceType">
<option value="core">General military, civil or patriotic service</option><option value="committee">Committee that furthered the cause (from April 1774)</option>
<option value="va_oath">Virginia Oath of Fidelity</option><option value="galvez_troops">Spanish troops under Gálvez / Louisiana Militia</option>
<option value="galvez_cattle">Supplying cattle for Gálvez's forces</option></select>
<label for="ta-start">When did the service start?</label>${DATE_HINT}<input id="ta-start" name="start" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 1776 or 1776-07" aria-describedby="date-hint" required>
<label for="ta-end">When did it end? (leave blank if you only have one date)</label><input id="ta-end" name="end" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 1778 or 1778-03">
<button type="submit" class="big">Check these dates</button></form>
<div data-out="window" tabindex="-1" aria-live="polite"></div>
${full ? `<h3 class="step"><span class="num">2</span> Optional: widow pension and bounty-land laws</h3>
<p class="small">Only needed if you are looking for a widow's pension or bounty-land papers. Fill in what you know and leave the rest blank.</p>
<form data-form="widow"><label for="tw-m">When did the couple marry?</label><p class="small hint" data-why="marriage"></p><input id="tw-m" name="marriage" type="text" autocomplete="off" placeholder="e.g. 1776 or 1776-07">
<label for="tw-e">When did his last period of service end?</label><p class="small hint" data-why="serviceEnd"></p><input id="tw-e" name="serviceEnd" type="text" autocomplete="off" placeholder="e.g. 1776 or 1776-07">
<label for="tw-mo">Total months of service (a number)</label><p class="small hint" data-why="serviceMonths"></p><input id="tw-mo" name="serviceMonths" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 24">
<label for="tw-d">Total days of service (a number, if you know it)</label><p class="small hint" data-why="serviceDays"></p><input id="tw-d" name="serviceDays" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 730">
<label class="check"><input type="checkbox" name="engagement"> He was in at least one battle</label>
<button type="submit" class="big">Check the widow pension laws</button></form>
<div data-out="widow" tabindex="-1" aria-live="polite"></div>
<h3 class="step"><span class="num">3</span> Print or save your results</h3>
<p><a class="button-link no-print" href="/tools/service-window-checker/report/">Open my printable report</a></p>
<button type="button" class="secondary" data-clear="toolA">Delete my saved checker data</button>` : `<p class="small">Widow-pension checks and a printable report are on the <a href="/tools/service-window-checker/">full checker page</a>.</p>`}
<p class="small">Saved only in this browser (keys starting "pi.toolA"). Nothing is sent anywhere.</p>
<noscript><p>This checker needs JavaScript. The published date windows are listed on the <a href="/tools/service-window-checker/">checker page</a>.</p></noscript>
</section><script type="module" src="/assets/js/tool-a-ui.js"></script>`;
const TOOL_B_FULL = `<section class="tool" data-tool="lineage-matrix" aria-labelledby="tb-h"><h2 id="tb-h">Use the worksheet</h2>
<div class="howto"><p><strong>How this works.</strong> This worksheet does not search any records or databases. You type in the records you already have for each person in your line. It shows what is still missing for each generation and where to look for it. Nothing you type leaves your device; it is saved only in this browser.</p>
<p><button type="button" class="secondary" data-load-example>Load an example</button> <span class="small">Fills in a made-up family so you can see how it works.</span></p></div>
<h3 class="step"><span class="num">1</span> Start with yourself, then go back one generation at a time</h3>
<p class="small">Generation 1 is you. Generation 2 is your parent, 3 your grandparent, and so on back to the patriot. For each person, press "Add a record" and answer A to D.</p>
<div data-matrix></div>
<h3 class="step"><span class="num">2</span> Add or remove generations</h3>
<button type="button" class="secondary" data-add-gen>+ Add an older generation</button><button type="button" class="secondary" data-remove-gen>Remove the oldest generation</button>
<p class="small" data-cleared aria-live="polite"></p>
<h3 class="step"><span class="num">3</span> See what's missing, and where to look</h3><div data-gaps aria-live="polite"></div>
<h3 class="step"><span class="num">4</span> Print or save</h3>
<p><a class="button-link" href="/tools/lineage-matrix/report/">Open my printable report</a></p>
<button type="button" class="secondary" data-clear="toolB">Delete all my worksheet data</button>
<noscript><p>The worksheet needs JavaScript. The rules it applies are listed below.</p></noscript>
</section><script type="module" src="/assets/js/tool-b-ui.js"></script>`;
const TOOL_B_CARD = `<aside class="card" data-tool-card="lineage-matrix"><strong>Lineage Evidence Matrix</strong>
<p>A free worksheet: type in the records you have for each generation, and it shows what's missing and where to look. Everything stays in your browser.</p>
<p class="small" data-card-status aria-live="polite"></p>
<p><a href="/tools/lineage-matrix/">Open the worksheet</a> · <a href="/tools/lineage-matrix/report/">View your report</a></p></aside><script type="module" src="/assets/js/tool-b-ui.js"></script>`;
const TOOLS = { "service-window": TOOL_A_FORM(false), "service-window-full": TOOL_A_FORM(true), "lineage-matrix": TOOL_B_CARD, "lineage-matrix-full": TOOL_B_FULL };

function md(body, ctx) {
  const lines = body.split("\n"); const out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith("::tool ")) { const k = l.slice(7).trim(); if (!TOOLS[k]) throw new Error(`unknown tool ${k}`); out.push(TOOLS[k]); ctx.tools.add(k.replace("-full", "")); i++; continue; }
    const h = /^(#{1,3}) (.*)$/.exec(l);
    if (h) { const lvl = h[1].length; const txt = inline(h[2], ctx); const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); out.push(`<h${lvl}${lvl > 1 ? ` id="${id}"` : ""}>${txt}</h${lvl}>`); i++; continue; }
    if (l.startsWith("|")) {
      const rows = []; while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]); const bodyRows = rows.slice(2).map(cells);
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c, ctx)}</th>`).join("")}</tr></thead><tbody>${bodyRows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, ctx)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^- /.test(l)) { const items = []; while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2)); out.push(`<ul>${items.map((t) => `<li>${inline(t, ctx)}</li>`).join("")}</ul>`); continue; }
    if (/^\d+\. /.test(l)) { const items = []; while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, "")); out.push(`<ol>${items.map((t) => `<li>${inline(t, ctx)}</li>`).join("")}</ol>`); continue; }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(#|\||- |\d+\. |::tool )/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(" "), ctx)}</p>`);
  }
  return out.join("\n");
}
const NAV = `<header class="site"><div class="wrap"><a class="brand" href="/">Patriot In Lay Terms</a><nav class="top" aria-label="Main"><a href="/#guides">Guides</a><a href="/#tools">Tools</a><a href="/about/">About</a></nav></div></header>`;
const FOOT = `<footer class="site"><div class="wrap"><a href="/about/">About &amp; AI disclosure</a><a href="/sources/">Sources &amp; Methodology</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a><p>Not affiliated with DAR, SAR, NSCDA or the National Archives. Not legal or professional genealogical advice.</p></div></footer>`;
function page({ title, description, path, body, noindex = false }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Patriot In Lay Terms</title><meta name="description" content="${esc(description || "")}">
<link rel="canonical" href="${SITE}${path}">${noindex ? '<meta name="robots" content="noindex">' : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/site.css"></head><body>${NAV}<main><div class="wrap">${body}</div></main>${FOOT}</body></html>`;
}
function write(path, html) { const f = join(OUT, path, "index.html"); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, versionUrls(html)); }
const sitemap = []; const built = [];
function renderFile(dir, f) {
  const raw = readFileSync(join(ROOT, dir, f), "utf8"); const { fm, body } = parseFront(raw);
  const ctx = { sources: [], tools: new Set(), claimCount: 0 };
  const html = md(body, ctx);
  const srcList = ctx.sources.length ? `<h2 id="sources">Sources</h2><ol class="sources">${ctx.sources.map((u, i) => { const c = manifest.claims.find((x) => x.source_url === u);
    return `<li id="src-${i + 1}"><a href="${esc(u)}">${esc(c.source_title)}</a>. Retrieved ${c.last_retrieved}. <span class="url">${esc(u)}</span></li>`; }).join("")}</ol>` : "";
  const meta = fm.cornerstone ? `<p class="meta">Guide ${fm.cornerstone} of 10 · Sources last checked ${BUILD_DATE} · Written with AI; every fact is tied to a quoted official source (<a href="/about/">how this works</a>)</p>` : "";
  const path = `/${fm.slug}/`;
  write(fm.slug, page({ title: fm.title, description: fm.description, path, body: meta + html + srcList }));
  if (fm.launch_setup) console.log(`LAUNCH SETUP REQUIRED (${path}): ${fm.launch_setup}`);
  sitemap.push(path); built.push({ ...fm, path, words: body.replace(/\[\[claim:[^\]]+\]\]/g, "").split(/\s+/).filter(Boolean).length, claims: ctx.claimCount, sources: ctx.sources.length, tools: [...ctx.tools] });
}
for (const f of readdirSync(join(ROOT, "src/content")).filter((x) => x.endsWith(".md"))) renderFile("src/content", f);
for (const f of readdirSync(join(ROOT, "src/pages")).filter((x) => x.endsWith(".md"))) renderFile("src/pages", f);

const guides = built.filter((b) => b.cornerstone).sort((a, b) => a.cornerstone - b.cornerstone);
write("", page({ title: "Revolutionary War lineage, explained step by step", description: "Plain-English procedures and free browser tools for proving descent from a Revolutionary War patriot.", path: "/",
  body: `<h1>Revolutionary War lineage, explained step by step</h1><p>Procedures for proving each generation back to a Revolutionary War patriot, built from National Archives, National Park Service, DAR and SAR guidance. Every fact links to its official source.</p>
<h2 id="guides">The 10 guides</h2><ol class="guide-list">${guides.map((g) => `<li><a href="${g.path}">${esc(g.title)}</a><br><span class="small">${esc(g.description)}</span></li>`).join("")}</ol>
<h2 id="tools">Free tools</h2><ul class="guide-list"><li><a href="/tools/service-window-checker/">Service Window &amp; Widow-Act Date Checker</a></li><li><a href="/tools/lineage-matrix/">Lineage Evidence Matrix</a></li></ul>
<p class="small">Written with AI and checked against quoted official sources at build time. <a href="/about/">About this site</a>.</p>` }));
sitemap.unshift("/");
// Sources & methodology page
const bySource = new Map(); for (const c of manifest.claims) { if (!bySource.has(c.source_url)) bySource.set(c.source_url, { t: c.source_title, n: 0 }); bySource.get(c.source_url).n++; }
write("sources", page({ title: "Sources & Methodology", description: "How every fact on this site is tied to an official source.", path: "/sources/",
  body: `<h1>Sources &amp; Methodology</h1><p>Every factual sentence on this site carries a reference to an entry in a Source Manifest. Each entry quotes the exact passage from an official or institutional source. When the site is built, a script fetches every source and confirms that each quoted passage still appears in it. If a quote cannot be found, or a factual sentence has no entry, the build fails and the page is not published. Statements that cannot be verified this way are left out.</p>
<p>The guides and tools are written by AI software. See <a href="/about/">About</a>.</p><h2>Sources in the manifest</h2><ol class="sources">${[...bySource].map(([u, v]) => `<li><a href="${esc(u)}">${esc(v.t)}</a> (${v.n} claims). <span class="url">${esc(u)}</span></li>`).join("")}</ol><p class="small">Manifest: ${manifest.claims.length} verified claims, last retrieved ${BUILD_DATE}.</p>` }));
sitemap.push("/sources/");
// Report pages (noindex; render from localStorage only)
write("tools/service-window-checker/report", page({ title: "Service Window Checker — your report", description: "Printable report of your last checks, rendered from this browser only.", path: "/tools/service-window-checker/report/", noindex: true,
  body: `<h1>Service Window Checker: your report</h1><p>The dates you checked and what the published rules say about them.</p><section class="tool" data-tool-report="service-window"><div data-report><p>Loading your saved checks…</p></div><button type="button" data-print>Print this report</button><button type="button" class="secondary" data-clear="toolA">Delete my saved checker data</button><div data-out="report" aria-live="polite"></div></section><p class="small">This report is built in your browser from what you typed on this device. Nothing is uploaded. It compares dates with published rules; it is not a decision about membership or a pension.</p><p><a href="/tools/service-window-checker/">Back to the checker</a></p><script type="module" src="/assets/js/tool-a-ui.js"></script>` }));
write("tools/lineage-matrix/report", page({ title: "Lineage Evidence Matrix — your report", description: "Printable gap report rendered from this browser only.", path: "/tools/lineage-matrix/report/", noindex: true,
  body: `<h1>Lineage Evidence Matrix: your report</h1><p>What's still missing in your line, where to look for it, and the records you've entered.</p><section class="tool" data-tool-report="lineage-matrix"><div data-report><p>Loading your saved matrix…</p></div><button type="button" data-print>Print this report</button><button type="button" class="secondary" data-clear="toolB">Delete all my worksheet data</button></section><p class="small">Built in your browser from what you typed on this device. Nothing is uploaded. Every label means "still needs review": only a society's genealogists decide what is proven.</p><p><a href="/tools/lineage-matrix/">Back to the matrix</a></p><script type="module" src="/assets/js/tool-b-ui.js"></script>` }));
writeFileSync(join(OUT, "404.html"), versionUrls(page({ title: "Page not found", path: "/404.html", noindex: true, body: `<h1>Page not found</h1><p><a href="/">Go to the home page</a>.</p>` })));
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.filter((p) => !p.includes("/contact/") || true).map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${BUILD_DATE}</lastmod></url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nDisallow: /tools/service-window-checker/report/\nDisallow: /tools/lineage-matrix/report/\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(join(ROOT, "build-report.json"), JSON.stringify({ builtAt: new Date().toString(), pages: built, sitemapUrls: sitemap.length }, null, 2));
for (const b of built) console.log(`built ${b.path.padEnd(42)} ${String(b.words).padStart(5)} words  ${String(b.claims).padStart(3)} claim refs  ${String(b.sources).padStart(2)} sources  tools: ${b.tools.join(",") || "-"}`);
console.log(`sitemap.xml: ${sitemap.length} URLs; robots.txt, 404.html, 2 report pages written.`);
