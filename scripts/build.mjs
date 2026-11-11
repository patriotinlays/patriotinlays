// Static site build (no dependencies). `prebuild` runs the tests and the Source Manifest gate first.
// Renders src/content/*.md (guides + tool pages) and src/pages/*.md (site pages) into dist/, plus home,
// sources page, tool report pages, sitemap.xml, robots.txt and 404.html.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from "node:fs";
const LAST_PASSED = (() => { try { return JSON.parse(readFileSync(new URL("../manifest/source-last-passed.json", import.meta.url), "utf8")).sources || {}; } catch { return {}; } })();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// The same UTC calendar date the "Last checked" lines show, written out (e.g. "November 9, 2026").
const longDate = (t) => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
const lastChecked = (u, fallback) => { const t = LAST_PASSED[u]; return t && !Number.isNaN(Date.parse(t)) ? new Date(t).toISOString().slice(0, 10) : fallback; };
import { join, dirname } from "node:path";
import { sourceLabel, SOURCE_TOPICS } from "./lib/source-labels.mjs";
import { asofAllowed } from "./lib/source-scope.mjs";
import { createHash } from "node:crypto";
import { titleCase, titleCaseHeadings, titleCaseInner } from "./lib/title-case.mjs";
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
// Tim t154: a tiny deferred script, on every page, that opens a <details> when the URL hash points to it or to something inside it.
const openDetails = readFileSync(join(ROOT, "src/assets/js/open-details.js"), "utf8");
writeFileSync(join(OUT, "assets/js/open-details.js"), openDetails); ASSET_V.set("/assets/js/open-details.js", hash8(openDetails));
const versionUrls = (html) => html.replace(/(src|href|content)="((?:https:\/\/patriotinlays\.com)?)(\/(?:assets\/[^"?#]+|favicon[^"?#\/]*|apple-touch-icon\.png)\.?(?:js|css|svg|png)?)"/g, (m, a, host, u) => ASSET_V.has(u) ? `${a}="${host}${u}?v=${ASSET_V.get(u)}"` : m);
// Logo and icons (sources and rebuild scripts in tools/logo/). Images get the same ?v=<hash> cache-busting as CSS/JS.
for (const f of ["logo-horizontal-white.svg", "logo-horizontal.svg", "icon.svg", "og-image.png"]) { const b = readFileSync(join(ROOT, "src/assets", f)); writeFileSync(join(OUT, "assets", f), b); ASSET_V.set(`/assets/${f}`, hash8(b)); }
for (const [src, dst] of [["favicon.svg", "favicon.svg"], ["favicon-32.png", "favicon-32.png"], ["favicon-16.png", "favicon-16.png"], ["apple-touch-icon-180.png", "apple-touch-icon.png"]]) {
  const b = readFileSync(join(ROOT, "src/assets", src)); writeFileSync(join(OUT, dst), b); ASSET_V.set(`/${dst}`, hash8(b)); }

mkdirSync(join(OUT, "assets/archives"), { recursive: true });
for (const f of readdirSync(join(ROOT, "src/assets/archives")).filter((f) => f.endsWith(".jpg"))) { const b = readFileSync(join(ROOT, "src/assets/archives", f)); writeFileSync(join(OUT, "assets/archives", f), b); ASSET_V.set(`/assets/archives/${f}`, hash8(b)); }
for (const f of readdirSync(join(ROOT, "qa/walkthroughs")).filter((f) => f.endsWith(".png"))) { mkdirSync(join(OUT, "assets/walkthroughs"), { recursive: true });
  const b = readFileSync(join(ROOT, "qa/walkthroughs", f)); writeFileSync(join(OUT, "assets/walkthroughs", f), b); ASSET_V.set(`/assets/walkthroughs/${f}`, hash8(b)); }
// t124u #1: each Sources entry: the title (the link), its last-checked date, a "Used for:" line built from the claims this page
// cites (topics only, scripts/lib/source-labels.mjs), and the raw URL, which shows in print only.
function sourceItem(u, i, ctx) { const c = manifest.claims.find((x) => x.source_url === u);
  const ids = ctx.used?.get(u) || []; if (!ids.length) throw new Error(`build: source ${u} listed with no claims`);
  return `<li id="src-${i + 1}"><a href="${esc(u)}">${esc(c.source_title)}</a>. Last checked ${lastChecked(c.source_url, c.last_retrieved)}. <span class="source-use" data-source-use>Used for: ${esc(sourceLabel(u, ids))}.</span> <span class="url">${esc(u)}</span></li>`; }
// t124u #11: links that leave the site open in a new tab, with a small icon and screen-reader text. Internal and mailto links unchanged.
const EXT_ICON = '<svg class="ext-icon" aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 12 12"><path d="M7 1h4v4M11 1 5.5 6.5M9.5 7.5V11H1V2.5h3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sr-only"> (opens in new tab)</span>';
const isExternal = (u) => /^https?:\/\//i.test(u) && !/^https?:\/\/(www\.)?patriotinlays\.com(\/|$)/i.test(u);
const markExternal = (html) => html.replace(/<a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (m, u, rest, inner) => {
  if (!isExternal(u.replace(/&amp;/g, "&")) || /target=/.test(rest)) return m;
  return `<a href="${u}"${rest.replace(/\s*rel="[^"]*"/, "")} target="_blank" rel="noopener noreferrer" class="ext">${inner}${EXT_ICON}</a>`; });
function parseFront(raw) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw); const fm = {};
  if (m) for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, ""); }
  return { fm, body: m ? raw.slice(m[0].length) : raw };
}
function inline(text, ctx) {
  let s = esc(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  // t124u #10: "{{asof:claim-id}}" opens a sentence about a society's fees, file formats, review times or other rules with
  // "As of <date>," where <date> is that claim's source's last recorded live pass (manifest/source-last-passed.json).
  // A source with no record stops the build: a date is never invented.
  s = s.replace(/\{\{asof:([a-z0-9-]+)\}\}/g, (_, id) => {
    const c = claims.get(id); if (!c) throw new Error(`build: asof: unknown claim ${id}`);
    // t127u: "As of [date]," only for official national or state sources, never chapter-local or third-party ones.
    if (!asofAllowed(c)) throw new Error(`build: asof ${id}: its source is ${c.source_scope || "untagged"}; the "As of" format is only for national or state sources`);
    const t = LAST_PASSED[c.source_url]; if (!(t && !Number.isNaN(Date.parse(t)))) throw new Error(`build: asof ${id}: no last-passed record for ${c.source_url}; run the live-source check (never invent a date)`);
    ctx.asof = (ctx.asof || 0) + 1; return `As of <span data-asof="${esc(id)}">${longDate(t)}</span>,`;
  });
  s = s.replace(/\s*\[\[claim:([a-z0-9-]+)\]\]/g, (_, id) => {
    const c = claims.get(id); if (!c) throw new Error(`build: unknown claim ${id}`);
    let n = ctx.sources.indexOf(c.source_url) + 1; if (!n) { ctx.sources.push(c.source_url); n = ctx.sources.length; }
    (ctx.used ||= new Map()); if (!ctx.used.has(c.source_url)) ctx.used.set(c.source_url, []); if (!ctx.used.get(c.source_url).includes(id)) ctx.used.get(c.source_url).push(id);
    ctx.claimCount++; return `<sup><a href="#src-${n}" title="${esc(c.source_title)}">[${n}]</a></sup>`;
  });
  // Two claims from the same source side by side show one marker, not "[1][1]".
  return s.replace(/(<sup><a href="#src-(\d+)"[^>]*>\[\d+\]<\/a><\/sup>)(?:<sup><a href="#src-\2"[^>]*>\[\d+\]<\/a><\/sup>)+/g, "$1");
}
const WIDOW_FULL = `<section class="tool" data-tool="widow" aria-labelledby="ta-h">
<h2 id="ta-h">Use the checker</h2>
<div class="howto"><p><strong>How this works.</strong> This checker does not search any records or databases. You type the marriage date and what you know about his service. It tests them against the date rules in each federal widow pension and bounty-land law, as the National Archives describes them, and shows the result law by law. Nothing you type leaves your device; it is saved only in this browser.</p>
<p class="tool-actions"><button type="button" class="secondary" data-load-example>Load an example</button> <button type="button" class="secondary" data-from-worksheet>Fill in from my worksheet's patriot</button> <button type="button" class="secondary" data-clear="toolA" data-start-over>Clear the form</button></p>
<p class="small" data-example-msg aria-live="polite">"Load an example" fills in a made-up couple so you can see a result right away. "Clear the form" empties the form and deletes this checker's saved data.</p><p class="small" data-worksheet-msg aria-live="polite"></p><p class="small saved-msg" data-saved-msg hidden></p></div>
<h3 class="step"><span class="num">1</span> Type what you know about the widow and her husband</h3>
<p class="small">Fill in what you know and leave the rest blank. For each date, pick the month (or "Don't know"), type the day if you know it and the 4-digit year, then say how sure you are.</p>
<form data-form="widow"><div data-date-mount="marriage" data-id="tw-m" data-legend="When did the couple marry?" data-why="marriage"></div>
<div data-date-mount="serviceEnd" data-id="tw-e" data-legend="When did his last period of service end?" data-why="serviceEnd"></div>
<label for="tw-mo">Total months of service (a number)</label><p class="small hint" data-why="serviceMonths"></p><input id="tw-mo" name="serviceMonths" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 24">
<label for="tw-d">Total days of service (a number, if you know it)</label><p class="small hint" data-why="serviceDays"></p><input id="tw-d" name="serviceDays" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 730">
<label for="tw-b">Was he in at least one battle?</label><p class="small hint" data-why="engagement"></p><select id="tw-b" name="engagement"><option value="">Don't know</option><option value="yes">Yes</option><option value="no">No</option></select>
<label for="tw-k">What kind of service was it?</label><p class="small hint" data-why="kind"></p><select id="tw-k" name="kind"><option value="">Don't know</option><option value="continental">Continental Army (the Continental Line)</option><option value="militia">State troops, volunteers or militia</option><option value="navy">Navy (an officer, marine or mariner)</option><option value="other">Something else (for example civil or patriotic service)</option></select>
<button type="submit" class="big">Check the widow pension laws</button></form>
<div data-out="widow" tabindex="-1" aria-live="polite"></div>
<h3 class="step"><span class="num">2</span> What to do next</h3>
<div data-plan aria-live="polite"></div>
<h3 class="step"><span class="num">3</span> Print or save your results</h3>
<p><a class="button-link no-print" href="/tools/widow-pension-checker/report/">Open my printable report</a></p>
<button type="button" class="secondary" data-clear="toolA">Delete my saved checker data</button>
<p class="small">Nothing is sent anywhere. Your entries are saved only in this browser, and that storage isn't encrypted. On a shared or public computer, use the delete button when you're done.</p>
<noscript><p>This checker needs JavaScript. The laws it uses are listed below.</p></noscript>
</section><script type="module" src="/assets/js/tool-a-ui.js"></script>`;
const WIDOW_CARD = `<aside class="card" data-tool-card="widow"><strong>Widow Pension Law Checker</strong>
<p>Type a widow's marriage date and what you know about her husband's service. See which federal widow pension and bounty-land laws (1836 to 1878) fit, and where to look for her pension file. Free; nothing leaves your browser.</p>
<p><a href="/tools/widow-pension-checker/">Open the checker</a></p></aside>`;
const PATRIOT_CARD = `<aside class="card" data-tool-card="patriot"><strong>Record Your Patriot's Service</strong>
<p>The free worksheet's patriot step asks for your patriot's state, unit, type of service and rough dates. It checks the dates against the period DAR accepts for that type of service and points you to the records for that state.</p>
<p><a href="/tools/lineage-matrix/#tb-patriot">Open the patriot step</a> · <a href="/tools/widow-pension-checker/">Widow Pension Law Checker</a></p></aside>`;
const TOOL_B_FULL = `<section class="tool" data-tool="lineage-matrix" aria-labelledby="tb-h"><h2 id="tb-h">Use the worksheet</h2>
<p class="purpose" data-purpose><strong>What it's for:</strong> a to-do list of the records you still need for each generation, from you back to your patriot, and where to look for each one.</p>
<div class="howto"><p><strong>How this works.</strong> This worksheet does not search any records or databases. You type in the records you already have for each person in your line. It shows what is still missing for each generation and where to look for it. Nothing you type leaves your device; it is saved only in this browser.</p>
</div>
<p class="form-note" data-form-note>You can skip any field for now and come back later. Rough dates and states are enough to start.</p>
<div class="ws-start" data-ws-start><div class="ws-choices"><p class="ws-choice" data-ws-begin-wrap><button type="button" class="big" data-ws-begin>Start with just the patriot and me</button> <span class="small ws-rec">Recommended</span></p><p class="ws-choice"><button type="button" class="secondary" data-load-example>See a filled-in example</button></p></div><div data-name-checklist></div></div>
<div data-ws-body>
<details class="ws-group" data-group="patriot" open><summary><h3 class="step" id="tb-patriot"><span class="num">1</span> Your patriot</h3></summary>
<p class="small">Your patriot's state, type of service and rough dates shape the advice below. The worksheet checks those dates against the period DAR accepts for that type of service.</p>
<div data-patriot></div></details>
<section class="ws-group" data-group="generations"><h3 class="step"><span class="num">2</span> Generations</h3>
<p class="small">Start with yourself, and go back one generation at a time. Generation 1 is you. Generation 2 is your parent, 3 your grandparent, and so on back to the patriot. For each person, add a rough birth year and the state, then press "Add a record" and answer A to D: A. What does this record show? B. What kind of record is it? C. Does the record say it in words, or only hint at it? D. Where did you find it?</p>
<div data-matrix></div></section>
<h3 class="step"><span class="num">3</span> Add or remove generations</h3>
<button type="button" class="secondary" data-add-gen>+ Add an older generation</button><button type="button" class="secondary" data-remove-gen>Remove the oldest generation</button>
<p class="small" data-cleared aria-live="polite"></p>
<h3 class="step"><span class="num">4</span> See what's missing, and where to look</h3><div data-gaps aria-live="polite"></div>
<h3 class="step"><span class="num">5</span> What to do next</h3>
<div data-plan aria-live="polite"></div>
<h3 class="step"><span class="num">6</span> Print or save</h3>
<p><a class="button-link" href="/tools/lineage-matrix/report/">Open my printable report</a></p>
<button type="button" class="secondary" data-clear="toolB">Delete all my worksheet data</button>
<p class="small" data-privacy-note>Saved only in this browser. Nothing is sent anywhere. Clearing your browser data or switching browsers deletes your work. Print or save your report as a backup.</p>
</div>
<noscript><p>The worksheet needs JavaScript. The rules it applies are listed below.</p></noscript>
</section><script type="module" src="/assets/js/tool-b-ui.js"></script>`;
const TOOL_B_CARD = `<aside class="card" data-tool-card="lineage-matrix"><strong>Lineage Evidence Matrix</strong>
<p>A free worksheet: tell it about your patriot's service, type in the records you have for each generation, and it gives you a to-do list of the records still missing and where to look for each, fitted to each person's era and state. Everything stays in your browser.</p>
<p class="small" data-card-status aria-live="polite"></p>
<p><a href="/tools/lineage-matrix/">Open the worksheet</a> · <a href="/tools/lineage-matrix/report/">View your report</a></p></aside><script type="module" src="/assets/js/tool-b-ui.js"></script>`;
const TOOLS = { widow: WIDOW_CARD, "widow-full": WIDOW_FULL, patriot: PATRIOT_CARD, "lineage-matrix": TOOL_B_CARD, "lineage-matrix-full": TOOL_B_FULL };

function md(body, ctx) {
  const lines = body.split("\n"); const out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    // "::partial name" drops in a shared, sourced box (src/partials/name.md), e.g. "How to join, in short".
    if (l.startsWith("::partial ")) { const k = l.slice(10).trim(); out.push(`<aside class="card box-${k}" id="${k}">${md(readFileSync(join(ROOT, "src/partials", `${k}.md`), "utf8"), ctx)}</aside>`); i++; continue; }
        if (l.startsWith("::quote ")) { const [k, rest] = l.slice(8).split(/ (.+)/); out.push(quoteBlock(k, rest || "", ctx)); i++; continue; }
  // "::archive-figure key" drops in a real archival page (src/figures/key.json) with numbered labels and a caption naming the file.
  if (l.startsWith("::archive-figure ")) { const k = l.slice(17).trim(); const f = JSON.parse(readFileSync(join(ROOT, "src/figures", `${k}.json`), "utf8"));
      const marks = f.labels.map((x) => `<span class="af-n" aria-hidden="true" style="left:${x.x}%;top:${x.y}%">${x.n}</span>`).join("");
      out.push(`<figure class="archive-fig" data-archive-fig="${k}" data-naid="${f.naid}"><div class="af-wrap"><img src="/assets/${f.image}" alt="${esc(f.alt)}" width="${f.width}" height="${f.height}" loading="lazy" decoding="async">${marks}</div><ol class="af-key">${f.labels.map((x) => `<li value="${x.n}">${esc(x.text)}</li>`).join("")}</ol><figcaption>${esc(f.caption)}</figcaption></figure>`); i++; continue; }
  if (l.startsWith("::figure ")) { const m = /^::figure (\S+) (.+)$/.exec(l); 
      out.push(`<figure class="job-aid"><img src="/assets/walkthroughs/${m[1]}" alt="${esc(m[2])}"><figcaption>${esc(m[2])}</figcaption></figure>`); i++; continue; }
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
    const para = []; while (i < lines.length && lines[i].trim() && !/^(#|\||- |\d+\. |::tool |::partial |::figure |::quote )/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(" "), ctx)}</p>`);
  }
  return out.join("\n");
}
// Job aids: exact tool outputs are generated from qa/walkthroughs/outputs.json, which qa/walkthroughs.mjs
// refreshes by running the real tools. A build fails if a quoted output no longer matches the tool's own text.
const walkthrough = { ...JSON.parse(readFileSync(join(ROOT, "qa/walkthroughs/outputs.json"), "utf8")), ...JSON.parse(readFileSync(join(ROOT, "qa/walkthroughs/texts.json"), "utf8")) };
function quoteBlock(key, text, ctx) {
  const html = inline(text, ctx);
  if (!walkthrough.texts.some((t) => t === text)) throw new Error(`walkthrough quote not produced by the tools: ${text.slice(0, 90)}`);
  return `<blockquote class="tool-output" data-tool-output="${esc(key)}"><p>${html}</p></blockquote>`;
}
const NAV = `<header class="site"><div class="wrap"><a class="brand" href="/" aria-label="Patriot, In Lay Terms: home"><img class="logo" src="/assets/logo-horizontal-white.svg" alt="Patriot, In Lay Terms" width="161" height="44"></a><nav class="top" aria-label="Main"><a href="/guides/lineage-proof-roadmap/">Start Here</a><a href="/tools/widow-pension-checker/">Widow Pension Check</a><a href="/tools/lineage-matrix/">Worksheet</a><a href="/#guides">Guides</a><a href="/faq/">FAQ</a><a href="/about/">About</a></nav></div></header>`;
const FOOT = `<footer class="site"><div class="wrap"><a href="/about/" data-foot-about>About</a><a href="/ai-disclosure/" data-foot-ai>AI Disclosure</a><a href="/faq/">FAQ</a><a href="/walkthroughs/">Walkthroughs</a><a href="/sources/">Sources</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a><p>Not affiliated with DAR, SAR, NSCDA or the National Archives. Not legal or professional genealogical advice.</p></div></footer>`;
function page({ title, description, path, body, noindex = false }) {
  // Tim t146 #4: Title Case for the page <title> (and og:title) and every heading on the page.
  title = titleCase(title); body = titleCaseHeadings(body);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Patriot In Lay Terms</title><meta name="description" content="${esc(description || "")}">
<link rel="canonical" href="${SITE}${path}">${noindex ? '<meta name="robots" content="noindex">' : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32"><link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16"><link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180"><meta name="theme-color" content="#13294b">
<meta property="og:type" content="website"><meta property="og:site_name" content="Patriot, In Lay Terms"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description || "")}"><meta property="og:url" content="${SITE}${path}"><meta property="og:image" content="${SITE}/assets/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Patriot, In Lay Terms logo: an open book"><meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/site.css"></head><body>${NAV}<main><div class="wrap">${body}</div></main>${FOOT}<script src="/assets/js/open-details.js" defer></script></body></html>`;
}
function write(path, html) { const f = join(OUT, path, "index.html"); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, versionUrls(markExternal(html))); }
const sitemap = []; const built = []; const guideChecked = [];
const GUIDE_ORDER = readdirSync(join(ROOT, "src/content")).filter((x) => x.endsWith(".md")).map((f) => parseFront(readFileSync(join(ROOT, "src/content", f), "utf8")).fm).filter((fm) => fm.cornerstone);
// Tim t130 #1: the home page "Start here" cards. Tim t133 #3: the same three cards replace the old "Ready to start?" box on every other page.
const START_CARDS = `<section class="start-cards" aria-label="Start here" data-start-cards>
<div class="start-card" data-start-card="matrix"><h2 class="start-card-h">Build your to-do list</h2><p>Enter the records you already have. The worksheet shows what's still missing for each generation and where to look.</p><p class="start-card-btn"><a class="button-link" href="/tools/lineage-matrix/">Open the Lineage Evidence Matrix</a></p></div>
<div class="start-card" data-start-card="widow"><h2 class="start-card-h">Check a widow's pension</h2><p>Compare a widow's marriage date and her husband's service with each federal widow pension law.</p><p class="start-card-btn"><a class="button-link" href="/tools/widow-pension-checker/">Open the Widow Pension Law Checker</a></p></div>
<div class="start-card" data-start-card="roadmap"><h2 class="start-card-h">Read the full plan</h2><p>A generation-by-generation roadmap for DAR and SAR applications.</p><p class="start-card-btn"><a class="button-link" href="/guides/lineage-proof-roadmap/" data-start-button>Open the Roadmap guide</a></p></div>
</section>`;
const START_HERE = START_CARDS.replace('class="start-cards"', 'class="start-cards start-cards-page"');
// Every guide and tool page opens with a short, sourced definitions box (the home page's glossary, reused).
const DEFS_MD = readFileSync(join(ROOT, "src/partials/glossary.md"), "utf8").replace(/^## .*\n/, "");
// Tim t132 #1: collapsed by default on guides and tool pages under this title; the home page glossary stays open; print shows it expanded.
const DEFS_SUMMARY = "Terms Used on This Page";
function renderFile(dir, f) {
  const raw = readFileSync(join(ROOT, dir, f), "utf8"); let { fm, body } = parseFront(raw);
  // Tim t146 #3: each guide opens with a small "In Short" box (under the title, before the glossary): what the guide helps
  // you do, where to start, and a link to the matching tool or the next guide. Written only from the guide's own text.
  const IS = /^::in-short\n([\s\S]*?)\n::end\n/m; const isM = body.match(IS); let inShortLines = null;
  if (isM) { body = body.replace(IS, ""); inShortLines = isM[1].split("\n").filter((l) => l.trim()); }
  if (fm.cornerstone && (!inShortLines || inShortLines.length !== 3)) throw new Error(`${f}: guides need an ::in-short box with three lines`);
  const ctx = { sources: [], tools: new Set(), claimCount: 0 };
  const defs = dir === "src/content" ? `<details class="defs" data-defs><summary>${esc(DEFS_SUMMARY)}</summary>${md(DEFS_MD, ctx)}<p class="small"><a href="/#glossary">The same definitions on the home page</a></p></details>` : "";
  let html = md(body, ctx);
  const IS_KEYS = { "This guide helps you": "helps", "Start by": "start", "Then": "then" };
  const inShort = inShortLines ? `<aside class="in-short" data-in-short aria-labelledby="in-short-h"><h2 class="in-short-h" id="in-short-h">In Short</h2><ul>${inShortLines.map((l) => {
    const m = l.match(/^(This guide helps you|Start by|Then): (.+)$/); if (!m) throw new Error(`${f}: bad In Short line: ${l}`);
    return `<li data-in-short-line="${IS_KEYS[m[1]]}"><strong>${m[1]}:</strong> ${inline(m[2], ctx)}</li>`; }).join("")}</ul></aside>` : "";
  // Tool pages: title, purpose, limits box, tool first; glossary and long copy sit below the tool.
  // Tim t119u #2 / t155 / t156: on tool pages, one line right under the one-sentence purpose (above the "What it does" box) points beginners to the Roadmap. t156 drops the t119 "New to this?" pointer and keeps only the t155 callout.
  if (fm.tool) { const i = html.indexOf("</p>", html.indexOf("</h1>")); if (i < 0) throw new Error(`tool page ${f}: no purpose line`);
    html = html.slice(0, i + 4) + '<p class="roadmap-pointer" data-roadmap-callout>New here? Start with the <a href="/guides/lineage-proof-roadmap/">Roadmap guide</a> for the full step-by-step process.</p>' + html.slice(i + 4); }
  if (fm.tool && defs) html = html.replace(/(<\/section><script type="module" src="\/assets\/js\/tool-[ab]-ui\.js"><\/script>)/, `$1${defs}`);
  else if (defs || inShort) html = html.replace("</h1>", `</h1>${inShort}${defs}`);
  // Guides end with a "What to do next" block (its own tool first) and a link to the next guide, so no guide is a dead end.
  if (fm.cornerstone) {
    const own = [...ctx.tools][0] === "widow" ? "widow" : "lineage";
    html += "\n" + md(readFileSync(join(ROOT, "src/partials", `next-steps-${own}.md`), "utf8"), ctx);
    const next = GUIDE_ORDER.find((g) => +g.cornerstone === +fm.cornerstone + 1);
    html += `<p class="next-guide">${next ? `Next guide: <a href="/${next.slug}/">${esc(next.title)}</a> · ` : ""}<a href="/#guides">All 10 Guides</a> · <a href="/faq/">FAQ</a></p>`;
  }
  // t124u #9: the Roadmap's Step 0 heading was renamed; keep the old anchor working for saved links.
  html = html.replace('<h2 id="step-0-find-your-patriot-s-name">', '<span id="step-0-find-the-soldier-s-name" aria-hidden="true"></span><h2 id="step-0-find-your-patriot-s-name">');
  if (dir === "src/pages") html += START_HERE;
  const srcList = ctx.sources.length ? `<h2 id="sources">Sources</h2><ol class="sources">${ctx.sources.map((u, i) => sourceItem(u, i, ctx)).join("")}</ol>` : "";
  // t123u: the guide's top line shows the OLDEST recorded live pass among this page's own sources (the list at its foot),
  // read from manifest/source-last-passed.json. A source with no record is never given a date: the build stops and names it.
  let oldest = null;
  if (fm.cornerstone) {
    const noRecord = ctx.sources.filter((u) => !(LAST_PASSED[u] && !Number.isNaN(Date.parse(LAST_PASSED[u]))));
    if (noRecord.length) throw new Error(`${fm.slug}: no last-passed record for ${noRecord.join(", ")}; run the live-source check (never invent a date)`);
    oldest = ctx.sources.map((u) => ({ u, t: Date.parse(LAST_PASSED[u]) })).sort((a, b) => a.t - b.t)[0];
    guideChecked.push({ slug: fm.slug, date: oldest ? lastChecked(oldest.u) : null, source: oldest?.u || null, sources: ctx.sources.length });
  }
  const meta = fm.cornerstone ? `<p class="meta" data-sources-checked="${oldest ? lastChecked(oldest.u) : ""}">Guide ${fm.cornerstone} of 10 · Sources last checked ${oldest ? lastChecked(oldest.u) : ""} · Written with AI; every fact is tied to a quoted official source (<a href="/ai-disclosure/">how this works</a>)</p>` : "";
  const path = `/${fm.slug}/`;
  write(fm.slug, page({ title: fm.title, description: fm.description, path, body: meta + html + srcList }));
  if (fm.launch_setup) console.log(`LAUNCH SETUP REQUIRED (${path}): ${fm.launch_setup}`);
  sitemap.push(path); built.push({ ...fm, path, words: body.replace(/\[\[claim:[^\]]+\]\]/g, "").split(/\s+/).filter(Boolean).length, claims: ctx.claimCount, sources: ctx.sources.length, tools: [...ctx.tools] });
}
for (const f of readdirSync(join(ROOT, "src/content")).filter((x) => x.endsWith(".md"))) renderFile("src/content", f);
for (const f of readdirSync(join(ROOT, "src/pages")).filter((x) => x.endsWith(".md"))) renderFile("src/pages", f);

// Home page (Nov 5 full-page replacement): the flowing mission text in src/partials/home.md (Source Manifest gated like
// every page), a "Ready to get started?" box, the guide list and the sourced glossary. The old "Just starting?" path and
// "How to join, in short" box live on in the Roadmap guide, which opens with both.
const HOME = (() => { const ctx = { sources: [], tools: new Set(), claimCount: 0 };
  const body = md(readFileSync(join(ROOT, "src/partials/home.md"), "utf8"), ctx);
  const html = md(readFileSync(join(ROOT, "src/partials/glossary.md"), "utf8"), ctx).replace(/<h2 id="words-you-ll-see-here">[\s\S]*?<\/h2>\s*/, "");
  const sources = `<h2 id="sources">Sources</h2><ol class="sources">${ctx.sources.map((u, i) => sourceItem(u, i, ctx)).join("")}</ol>`;
  // Tim t152 #1: the home glossary is a second native expand, closed by default, same pattern as "Why This Site Exists".
  // id="glossary" stays on the details so in-page links (/#glossary) still land on it; opening on hash needs JS, which we don't add.
  return { body, html: `<details class="home-more" data-home-glossary id="glossary"><summary>Words You'll See Here</summary><div class="glossary">${html}</div></details>`, sources }; })();
// Tim t150: the longer explanation (from "Somewhere in your family's past" through "What this site does is explain ...")
// sits in a native <details>, closed by default, so a skimming visitor sees the short version first. Wording is unchanged
// (homepage-LOCK); the purpose paragraph, the "It's free" line and the AI line stay visible.
const HOME_MORE_SUMMARY = "Why This Site Exists";
function homeMission(html) {
  const start = html.indexOf("<p>Somewhere in your family"); const endP = html.indexOf("What this site does is explain");
  const end = html.indexOf("</p>", endP) + 4;
  if (start < 0 || endP < 0 || end < 4) throw new Error("home: could not find the longer explanation to put in the expand");
  return html.slice(0, start) + `<details class="home-more" data-home-more><summary>${HOME_MORE_SUMMARY}</summary>\n` + html.slice(start, end) + "\n</details>" + html.slice(end);
}
const guides = built.filter((b) => b.cornerstone).sort((a, b) => a.cornerstone - b.cornerstone);
write("", page({ title: "Patriot, In Lay Terms: plain-English help for DAR and SAR applications", description: "Plain-English guides and free browser tools for documenting descent from a Revolutionary War patriot for a DAR or SAR application.", path: "/",
  body: `<h1 class="home-h1" data-home-h1><span class="sr-only">Patriot, In Lay Terms: </span><span class="subtitle" data-subtitle>Plain-English help with DAR and SAR applications, for the Daughters and the Sons of the American Revolution</span></h1>
<p class="independent" data-independent>An independent guide: not affiliated with DAR, SAR or any lineage society, and it doesn't search records for you.</p>
<p class="home-intro" data-home-intro>Two free tools and ten guides help you organize what you have and see what's still missing. What you type into the tools stays in your own browser.</p>
${START_CARDS}
<p class="see-how" data-see-how><a href="/walkthroughs/">See how the tools work</a></p>
<section class="home-mission" data-mission>${homeMission(HOME.body).replace(/<p>Written with AI assistance/, '<p class="ai-line" data-ai-line>Written with AI assistance')}</section>
<h2 id="guides">The guides</h2><ol class="guide-list home-guides">${guides.map((g) => `<li><a class="guide-title" href="${g.path}">${esc(g.title)}</a><br><span class="small">${esc(g.description)}</span></li>`).join("")}</ol>
<p class="home-help">Questions? <a href="/faq/">Questions, Answered Simply</a> · New to the tools? <a href="/walkthroughs/">See them in action</a>, with a made-up family.</p>
${HOME.html}
${HOME.sources}` }));
sitemap.unshift("/");
// Sources & methodology page
const bySource = new Map(); for (const c of manifest.claims) { if (!bySource.has(c.source_url)) bySource.set(c.source_url, { t: c.source_title, n: 0 }); bySource.get(c.source_url).n++; }
write("sources", page({ title: "Sources & Methodology", description: "How every fact on this site is tied to an official source.", path: "/sources/",
  body: `<h1>Sources &amp; Methodology</h1><p>Every factual sentence on this site carries a reference to an entry in a Source Manifest. Each entry quotes the exact passage from an official or institutional source. When the site is built, a script fetches every source and confirms that each quoted passage still appears in it. If a quote cannot be found, or a factual sentence has no entry, the build fails and the page is not published. Statements that cannot be verified this way are left out.</p>
<p>Written with AI assistance and reviewed by the site's owner. See the <a href="/ai-disclosure/">AI disclosure</a>.</p><h2>Sources in the manifest</h2><ol class="sources">${[...bySource].map(([u, v]) => `<li><a href="${esc(u)}">${esc(v.t)}</a> (${v.n} ${v.n === 1 ? "claim" : "claims"}). <span class="source-use" data-source-use>Used for: ${esc(SOURCE_TOPICS[u].def)}.</span> <span class="url">${esc(u)}</span></li>`).join("")}</ol><p class="small">Manifest: ${manifest.claims.length} verified claims, last retrieved ${BUILD_DATE}.</p>${START_HERE}` }));
sitemap.push("/sources/");
// Report pages (noindex; render from localStorage only)
write("tools/widow-pension-checker/report", page({ title: "Widow Pension Law Checker: Your Report", description: "Printable report of your last widow-pension check, rendered from this browser only.", path: "/tools/widow-pension-checker/report/", noindex: true,
  body: `<h1>Widow Pension Law Checker: your report</h1><p>The dates you checked and what the published pension laws say about them. <a class="small" href="/#glossary">New here? What DAR, SAR, "bounty land" and "Stat." mean</a></p><section class="tool" data-tool-report="widow"><div data-report><p>Loading your saved check…</p></div><button type="button" data-print>Print this report</button><button type="button" class="secondary" data-clear="toolA">Delete my saved checker data</button><div data-out="report" aria-live="polite"></div></section><p class="small">This report is built in your browser from what you typed on this device. Nothing is uploaded. It compares dates with published laws; it is not a decision about membership or a pension.</p><p><a href="/tools/widow-pension-checker/">Back to the checker</a></p><script type="module" src="/assets/js/tool-a-ui.js"></script>` }));
write("tools/lineage-matrix/report", page({ title: "Lineage Evidence Matrix: Your Report", description: "Printable gap report rendered from this browser only.", path: "/tools/lineage-matrix/report/", noindex: true,
  body: `<h1>Lineage Evidence Matrix: your report</h1><p>What's still missing in your line, where to look for it, and the records you've entered. <a class="small" href="/#glossary">New here? What DAR, SAR, NSCDA, "lineage society" and "patriot" mean</a></p><section class="tool" data-tool-report="lineage-matrix"><p class="report-actions"><button type="button" class="big" data-save-pdf>Save as PDF</button> <span class="small" data-page-claim data-summary-pages="2" data-full-pages="3">Saves the summary and "Where to look": in the print window, choose "Save as PDF". The made-up example takes 2 Letter pages this way. Ctrl+P (your browser's own Print) and the "Print the full report" button print every record as well: 3 pages for the example. A longer family line prints longer.</span></p><div data-report><p>Loading your saved matrix…</p></div><button type="button" data-print>Print the full report (with every record)</button><button type="button" class="secondary" data-clear="toolB">Delete all my worksheet data</button></section><p class="small">Built in your browser from what you typed on this device. Nothing is uploaded. Every label means "still needs review": only a society's genealogists decide what is proven.</p><p class="no-print"><a href="/tools/lineage-matrix/">Back to the matrix</a></p><script type="module" src="/assets/js/tool-b-ui.js"></script>` }));
writeFileSync(join(OUT, "404.html"), versionUrls(page({ title: "Page Not Found", path: "/404.html", noindex: true, body: `<h1>Page not found</h1><p>That page doesn't exist. <a href="/">Go to the home page</a>.</p>${START_HERE}` })));
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.filter((p) => !p.includes("/contact/") || true).map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${BUILD_DATE}</lastmod></url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nDisallow: /tools/widow-pension-checker/report/\nDisallow: /tools/lineage-matrix/report/\nSitemap: ${SITE}/sitemap.xml\n`);
// The standalone service-date checker was folded into the worksheet's patriot step; old URLs redirect (Cloudflare Pages _redirects).
writeFileSync(join(OUT, "_redirects"), ["/tools/service-window-checker /tools/widow-pension-checker/ 301", "/tools/service-window-checker/ /tools/widow-pension-checker/ 301",
  "/tools/service-window-checker/report /tools/widow-pension-checker/report/ 301", "/tools/service-window-checker/report/ /tools/widow-pension-checker/report/ 301"].join("\n") + "\n");
writeFileSync(join(ROOT, "build-report.json"), JSON.stringify({ builtAt: new Date().toString(), guideSourcesChecked: guideChecked, pages: built, sitemapUrls: sitemap.length }, null, 2));
for (const b of built) console.log(`built ${b.path.padEnd(42)} ${String(b.words).padStart(5)} words  ${String(b.claims).padStart(3)} claim refs  ${String(b.sources).padStart(2)} sources  tools: ${b.tools.join(",") || "-"}`);
console.log(`sitemap.xml: ${sitemap.length} URLs; robots.txt, 404.html, 2 report pages written.`);
