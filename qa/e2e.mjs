// End-to-end browser verification (Chromium via playwright-core). playwright-core is NOT a site dependency.
// Run after `npm run build`:   npm install --no-save playwright-core@1.64.1 && npm run e2e
// Browser: $CHROME_PATH if set, else /usr/bin/google-chrome if present, else playwright's own Chromium
// (install it with `npx playwright-core install --with-deps chromium`).
// Serves dist/ on 127.0.0.1, drives both tools, checks localStorage isolation, network silence, mobile overflow,
// print CSS and console errors, and saves screenshots to qa/screens/.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright-core")); }
catch { console.error("playwright-core is not installed. Run: npm install --no-save playwright-core@1.64.1"); process.exit(2); }
if (!existsSync(new URL("../dist/index.html", import.meta.url))) { console.error("dist/ not built. Run: npm run build"); process.exit(2); }
const CHROME = process.env.E2E_USE_BUNDLED === "1" ? undefined : (process.env.CHROME_PATH || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined));
const ROOT = new URL("..", import.meta.url).pathname; const DIST = join(ROOT, "dist"); const SHOTS = join(ROOT, "qa/screens");
mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".xml": "application/xml", ".txt": "text/plain" };
const server = createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); let f = join(DIST, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404, { "content-type": "text/html" }); res.end(readFileSync(join(DIST, "404.html"))); return; }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise((r) => server.listen(8765, "127.0.0.1", r));
const BASE = "http://127.0.0.1:8765";
const results = []; const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const requests = []; const consoleErrors = [];
page.on("request", (r) => requests.push({ url: r.url(), phase: page.__phase || "load" }));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${page.url()}: ${m.text()}`); });
page.on("response", (r) => { if (r.status() >= 400) consoleErrors.push(`HTTP ${r.status()} ${r.url()}`); });
page.on("pageerror", (e) => consoleErrors.push(`${page.url()}: ${e.message}`));
page.on("dialog", (d) => d.accept());
const ls = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
const phase = (p) => { page.__phase = p; };

// ---- Tool A full page ----
phase("load"); await page.goto(`${BASE}/tools/service-window-checker/`); await page.evaluate(() => localStorage.setItem("other.app.key", "keep-me"));
phase("interact");
await page.selectOption("#ta-type", "core"); await page.fill("#ta-start", "1775-04-19"); await page.fill("#ta-end", "1776-01-01"); await page.click('form[data-form=window] button[type=submit]');
let txt = await page.textContent('[data-out=window]');
check("Tool A: core window 1775-04-19..1776-01-01 shows the mandated 'fits, not a ruling' sentence", txt.includes("Your dates fit the official service period for this type of service. This is not a ruling: your society decides."), txt.slice(0, 120));
const badgeBg = await page.$eval('[data-out=window] .badge', (b) => getComputedStyle(b).backgroundColor);
check("Tool A: 'fits' badge uses a neutral (not green) color", (() => { const [r, g, b] = badgeBg.match(/\d+/g).map(Number); return !(g > r + 20 && g > b + 20); })(), badgeBg);
const howA = await page.textContent('[data-tool="service-window"] .howto');
check("Tool A: 'How this works' says it doesn't search records and nothing leaves the device", /does not search any records/.test(howA) && /Nothing you type leaves your device/.test(howA));
check("Tool A: date hint reads 'e.g. 1776 or 1776-07'", (await page.textContent("#date-hint")).includes("e.g. 1776 or 1776-07"));
await page.selectOption("#ta-type", "galvez_cattle"); await page.fill("#ta-start", "1776-12-24"); await page.fill("#ta-end", ""); await page.click('form[data-form=window] button[type=submit]');
txt = await page.textContent('[data-out=window]');
check("Tool A: Gálvez cattle 24 Dec 1776 is outside the rule", /Outside the period/.test(txt), txt.slice(0, 100));
check("Tool A: plan for dates that don't fit starts with 'Double-check the dates'", (await page.textContent('[data-tool="service-window"] [data-plan] .plan-steps > li')).startsWith("Double-check the dates"));
await page.fill("#tw-m", "1780-05-01"); await page.fill("#tw-e", "1781-10-19"); await page.fill("#tw-mo", "24"); await page.fill("#tw-d", "730"); await page.click('form[data-form=widow] button[type=submit]');
txt = await page.textContent('[data-out=widow]');
check("Tool A: widow table shows 1836 note about 1832 service categories", /1832/.test(txt) && /Continental Line/.test(txt), "");
const rows = await page.$$eval('[data-out=widow] tbody tr', (trs) => trs.map((tr) => [tr.cells[0].textContent, tr.cells[1].textContent]));
const r1853 = rows.find((r) => r[0].includes("1853")); const r1855 = rows.find((r) => r[0].includes("February 28, 1855"));
check("Tool A: 1853 and Feb-1855 acts display 'Not checked'", r1853?.[1].includes("Not checked") && r1855?.[1].includes("Not checked"), `${r1853?.[1].slice(0, 30)} | ${r1855?.[1].slice(0, 30)}`);
const next1853 = await page.$$eval('[data-out=widow] tbody tr', (trs) => trs.find((tr) => tr.cells[0].textContent.includes("1853")).cells[2].textContent);
check("Tool A: 'Not checked' row says why and what to do (pension papers / registrar)", /Why:/.test(next1853) && /What to do/.test(next1853) && /registrar/.test(next1853), next1853.slice(0, 80));
check("Tool A: each widow field shows a 'Why it matters' line", (await page.$$eval("form[data-form=widow] [data-why]", (ps) => ps.filter((p) => p.textContent.startsWith("Why it matters")).length)) === 4);
await page.click('[data-tool="service-window"] [data-load-example]');
const exW = await page.textContent('[data-out=window]'), exD = await page.textContent('[data-out=widow]');
const planA = await page.textContent('[data-tool="service-window"] [data-plan]');
check("Tool A: 'What to do next' plan for fitting dates: find records, registrar (with DAR Chapter Locator link), start application", /Find the original records/.test(planA) && /Contact a local chapter's registrar/.test(planA) && /Start the application/.test(planA)
  && (await page.$$('[data-tool="service-window"] [data-plan] a[href="https://www.dar.org/discover/become-member/chapter-locator"]')).length === 1, planA.slice(0, 80));
check("Tool A: plan names the 'Not checked' laws in their own step", /For the laws marked "Not checked"/.test(planA) && /1853/.test(planA));
await page.evaluate(() => { window.__printed = 0; window.__planOnly = null; window.print = () => { window.__printed++; window.__planOnly = document.body.classList.contains("print-plan"); }; });
await page.click('[data-tool="service-window"] [data-print-plan]');
check("Tool A: 'Print or save this plan' prints in plan-only mode", (await page.evaluate(() => window.__printed === 1 && window.__planOnly === true)));
check("Tool A: no 'Not evaluated' wording anywhere on the page", !/not evaluated/i.test(await page.textContent("main")));
check("Tool A: 'Load an example' fills both steps and shows results at once", /not a ruling/.test(exW) && /Fits this law's date rule/.test(exD), exW.slice(0, 60));
const bodyA = await page.textContent("body"); check("Tool A page: no 'Qualif' anywhere in rendered text", !/qualif/i.test(bodyA));
let store = await ls();
check("Tool A: saved under namespaced keys only", Object.keys(store).filter((k) => k.startsWith("pi.toolA.")).sort().join(",") === "pi.toolA.widow,pi.toolA.window", Object.keys(store).join(","));
await page.screenshot({ path: join(SHOTS, "desktop-tool-a.png"), fullPage: false });
// Report page
phase("load"); await page.goto(`${BASE}/tools/service-window-checker/report/`); phase("interact");
txt = await page.textContent("[data-report]");
check("Tool A report renders saved checks from localStorage", txt.includes("Service dates check") && txt.includes("Widow pension"), "");
check("Tool A report: has 'What to do next' plan with a 'Print or save this plan' button", /What to do next/.test(txt) && /Contact a local chapter's registrar/.test(txt) && (await page.$$("[data-report] [data-print-plan]")).length === 1);
await page.emulateMedia({ media: "print" });
const printHidden = await page.$$eval("header.site, footer.site, .tool button", (els) => els.every((e) => getComputedStyle(e).display === "none"));
check("Tool A report: print CSS hides nav, footer and buttons", printHidden); await page.emulateMedia({ media: "screen" });
await page.click('[data-tool-report="service-window"] [data-clear=toolA]');
store = await ls();
check("Tool A clear: removes pi.toolA.* only, keeps unrelated key", !Object.keys(store).some((k) => k.startsWith("pi.toolA.")) && store["other.app.key"] === "keep-me", Object.keys(store).join(","));

// ---- Tool A embed on a guide ----
phase("load"); await page.goto(`${BASE}/guides/read-pension-file/`); phase("interact");
await page.fill("#ta-start", "1783-11-27"); await page.click('form[data-form=window] button[type=submit]');
txt = await page.textContent('[data-out=window]');
check("Tool A embed on guide #3 works (27 Nov 1783 outside)", /Outside the period/.test(txt));

// ---- Tool B ----
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
check("Tool B: starts with 2 generations", (await page.$$("section.gen")).length === 2);
check("Tool B: 'How this works' says it doesn't search records and nothing leaves the device", /does not search any records/.test(await page.textContent('[data-tool="lineage-matrix"] .howto')));
check("Tool B: generations are labelled 'Generation 1: You' and 'Generation 2: Your parent'", (await page.$$eval("section.gen h3", (hs) => hs.map((h) => h.textContent).join("|"))) === "Generation 1: You|Generation 2: Your parent");
await page.click('[data-add-evidence="1"]'); await page.click('[data-add-evidence="1"]');
check("Tool B: clicking 'Add a record' twice does not stack a second blank record", (await page.$$('section.gen[data-gen="1"] .cell')).length === 1);
const blankStatus = await page.textContent('section.gen[data-gen="1"] .cell .status');
check("Tool B (regression): a blank record shows no label at all (no 'Evidence Entered')", !/Evidence Entered/.test(blankStatus) && (await page.$$('section.gen[data-gen="1"] .cell .status .badge')).length === 0 && /Empty record/.test(blankStatus), blankStatus);
await page.selectOption('section.gen[data-gen="1"] select[name=fact]', "birth");
await page.selectOption('section.gen[data-gen="1"] select[name=docType]', "birth_cert_long");
await page.check('section.gen[data-gen="1"] input[type=radio][value=direct]');
await page.fill('section.gen[data-gen="1"] input[name=citation]', "Long-form birth certificate, state vital records office, image 1");
txt = await page.textContent('section.gen[data-gen="1"] .cell .status');
check("Tool B: complete direct entry shows 'Evidence Entered — Review Required'", txt.includes("Evidence Entered — Review Required"), txt.slice(0, 60));
await page.click('[data-add-evidence="2"]');
await page.selectOption('section.gen[data-gen="2"] select[name=fact]', "parentage");
await page.selectOption('section.gen[data-gen="2"] select[name=docType]', "census_1850_1870");
await page.check('section.gen[data-gen="2"] input[type=radio][value=direct]');
await page.fill('section.gen[data-gen="2"] input[name=citation]', "1860 census, county and page as on image");
txt = await page.textContent('section.gen[data-gen="2"] .cell .status');
check("Tool B: 1850-70 census for parentage marked direct gets NSCDA caution, not an upgrade", txt.includes("Evidence Entered — Review Required") && /do not state relationships/.test(txt));
await page.check('section.gen[data-gen="2"] input[name=conflict]');
txt = await page.textContent('section.gen[data-gen="2"] .cell .status');
check("Tool B: conflict flag changes label to 'Conflict Flagged — Review Required'", txt.includes("Conflict Flagged — Review Required"));
await page.click("[data-add-gen]");
check("Tool B: add generation works", (await page.$$("section.gen")).length === 3);
const gapsTxt = await page.textContent("[data-gaps]");
check("Tool B: gap list shows the flagged conflict and missing items", /flagged a conflict/i.test(gapsTxt) && /no death evidence/i.test(gapsTxt), gapsTxt.slice(0, 120));
const genOrder = await page.$$eval("[data-gaps] .gaps > li[data-gap-gen]", (lis) => lis.map((l) => l.dataset.gapGen));
check("Tool B (regression): gap list shows each generation once, in order", genOrder.length >= 2 && genOrder.every((g, i) => i === 0 || +g > +genOrder[i - 1]), genOrder.join(","));
const gapItems = await page.$$eval("[data-gaps] .gap-items > li", (lis) => lis.map((li) => ({ where: !!li.querySelector(".where"), text: li.textContent })));
check("Tool B: every listed gap shows a 'Where to look' line", gapItems.length > 0 && gapItems.every((g) => g.where && /Where to look/.test(g.text) && /registrar/.test(g.text)), `${gapItems.length} gaps`);
const whereHrefs = await page.$$eval("[data-gaps] .where a", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
const mUrls = new Set(JSON.parse(readFileSync(join(ROOT, "manifest/claims.json"), "utf8")).claims.map((c) => c.source_url));
check("Tool B: 'Where to look' links are only Source Manifest sources or this site's guides", whereHrefs.length > 0 && whereHrefs.every((h) => mUrls.has(h) || /^\/guides\/[a-z-]+\/$/.test(h)), whereHrefs.join(" "));
await page.screenshot({ path: join(SHOTS, "desktop-tool-b.png"), fullPage: false });
phase("load"); await page.reload(); phase("interact");
check("Tool B: state persists after reload (localStorage)", (await page.$$("section.gen")).length === 3 && (await page.$$("section.gen .cell")).length === 2);
const bText = await page.textContent('[data-tool="lineage-matrix"]'); check("Tool B: the word 'Documented' never appears in tool output", !/\bdocumented\b/i.test(bText), "");
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/report/`); phase("interact");
txt = await page.textContent("[data-report]");
check("Tool B report page renders generations, labels and gaps", /Generation 1: You/.test(txt) && /Conflict Flagged/.test(txt) && /still missing/.test(txt));
const planRep = await page.textContent("[data-report] .plan");
check("Tool B report: numbered action plan (order records with where-to-look, registrar, start application) + print button", /What to do next/.test(planRep) && /Records to find or fix, generation by generation/.test(planRep) && /registrar/.test(planRep) && /Start the application/.test(planRep) && (await page.$$("[data-report] .plan [data-print-plan]")).length === 1);
check("Tool B report: gaps carry 'Where to look' lines", (await page.$$("[data-report] .gap-items > li > .where")).length === (await page.$$("[data-report] .gap-items > li")).length && (await page.$$("[data-report] .gap-items > li")).length > 0 && /Where to look/.test(txt));
phase("load"); await page.goto(`${BASE}/guides/same-name/`); phase("interact");
txt = await page.textContent("[data-card-status]");
check("Tool B embed card on guide #8 reads saved state", /3 generations, 2 evidence entries/.test(txt), txt);
store = await ls();
// Regression: a blank record is neither counted on the card nor listed on the report.
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("pi.toolB.v1")); s.generations[0].cells.push({ id: "blank1", fact: "", docType: "", mode: "", conflict: false, citation: "" }); localStorage.setItem("pi.toolB.v1", JSON.stringify(s)); });
phase("load"); await page.reload(); phase("interact"); const cardBlank = await page.textContent("[data-card-status]");
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/report/`); phase("interact"); const repRows = await page.$$eval("[data-report] table tbody tr", (x) => x.length); const repTxt = await page.textContent("[data-report]");
check("Tool B (regression): blank record not counted on the card or shown on the report", /2 evidence entries/.test(cardBlank) && repRows === 2 && !/No Evidence Entered/.test(repTxt), `${cardBlank} | rows=${repRows}`);
phase("load"); await page.goto(`${BASE}/guides/same-name/`); phase("interact");
check("Tool B: saved under pi.toolB.v1 only", Object.keys(store).filter((k) => k.startsWith("pi.toolB")).join(",") === "pi.toolB.v1");
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
await page.click('[data-tool="lineage-matrix"] [data-load-example]');
const planB = await page.textContent('[data-tool="lineage-matrix"] [data-plan]');
const orderItems = await page.$$eval('[data-tool="lineage-matrix"] [data-plan] .plan-steps > li', (lis) => { const li = lis.find((l) => l.querySelector(".plan-title").textContent === "Records to find or fix, generation by generation"); return li ? [...li.querySelectorAll(".plan-sub > li")].map((x) => !!x.querySelector(".where a")) : []; });
const planGens = await page.$$eval('[data-tool="lineage-matrix"] [data-plan] .plan-group', (x) => x.map((e) => e.textContent));
check("Tool B (regression): action plan groups each generation once, in order", planGens.length >= 2 && new Set(planGens).size === planGens.length && planGens.every((g, i) => i === 0 || +g.match(/\d+/)[0] > +planGens[i - 1].match(/\d+/)[0]), planGens.join(" | "));
check("Tool B: action plan lists each missing record with a Where-to-look link, then registrar and application steps", orderItems.length >= 3 && orderItems.every(Boolean) && /Contact a local chapter's registrar/.test(planB) && /Start the application/.test(planB), `${orderItems.length} items`);
check("Tool B: 'Load an example' fills a made-up family and shows gaps with where to look", (await page.$$("section.gen")).length === 4 && (await page.$$("section.gen .cell")).length === 6 && (await page.$$("[data-gaps] .where a[href*='archives.gov']")).length > 0);
await page.click("[data-clear=toolB]");
store = await ls();
check("Tool B clear: removes pi.toolB.* only, keeps unrelated key", !Object.keys(store).some((k) => k.startsWith("pi.toolB")) && store["other.app.key"] === "keep-me", Object.keys(store).join(","));

// ---- Usefulness pass: home, guides, dead ends ----
phase("load"); await page.goto(`${BASE}/`); phase("interact");
const home = await page.textContent("main");
const gloss = await page.textContent(".glossary");
check("Home: short glossary defines Patriot, DAR, SAR, NSCDA and lineage society, each with a source note", ["Patriot:", "DAR:", "SAR:", "NSCDA:", "Lineage society:"].every((k) => gloss.includes(k)) && (await page.$$eval(".glossary li", (lis) => lis.every((li) => li.querySelector("sup a[href^='#src-']")))) && (await page.$$("#sources + ol.sources li")).length >= 3);
check("Home: says in plain words what you can get done and where to start", /What you can get done here/.test(home) && /Where to start/.test(home) && (await page.$$('main a.button-link[href="/tools/lineage-matrix/"]')).length === 1);
const guidePaths = ["/guides/lineage-proof-roadmap/", "/guides/substitute-evidence/", "/guides/read-pension-file/", "/guides/records-by-state/", "/guides/bounty-land-warrants/", "/guides/census-bridge/", "/guides/patriotic-service/", "/guides/same-name/", "/guides/patriot-or-loyalist/", "/guides/application-problems/"];
const guideBad = [];
for (const gp of guidePaths) { const h = readFileSync(join(DIST, gp, "index.html"), "utf8");
  if (!/<h2 id="what-to-do-next">/.test(h) || !h.includes('href="/tools/lineage-matrix/"') || !h.includes('href="/tools/service-window-checker/"') || !h.includes("chapter-locator") || !/class="next-guide"/.test(h)) guideBad.push(gp); }
check("Guides: all 10 end with 'What to do next' (both tools, chapter finder) and a next-guide link", guideBad.length === 0, guideBad.join(" "));
const toolGuideLinks = ["/tools/service-window-checker/", "/tools/lineage-matrix/"].every((p) => /href="\/guides\/[a-z-]+\/"/.test(readFileSync(join(DIST, p, "index.html"), "utf8")));
check("Tools: each tool page links to matching guides", toolGuideLinks);
const deadEnds = ["/about/", "/privacy/", "/contact/", "/sources/"].filter((p) => !readFileSync(join(DIST, p, "index.html"), "utf8").includes('class="card start-here"'));
check("No dead ends: About, Privacy, Contact, Sources and 404 offer a 'Ready to start?' box", deadEnds.length === 0 && readFileSync(join(DIST, "404.html"), "utf8").includes("start-here"), deadEnds.join(" "));

// ---- Network silence ----
const external = requests.filter((r) => !r.url.startsWith(BASE));
// The browser itself fetches /favicon.svg lazily after load; that is not tool traffic and is excluded (and reported).
const faviconLate = requests.filter((r) => r.phase === "interact" && r.url.endsWith("/favicon.svg")).length;
const duringInteraction = requests.filter((r) => r.phase === "interact" && !r.url.endsWith("/favicon.svg"));
check("Network: zero requests to any host other than the local site", external.length === 0, external.map((r) => r.url).slice(0, 3).join(" "));
check("Network: zero requests while using the tools (after page load)", duringInteraction.length === 0, duringInteraction.map((r) => r.url).slice(0, 3).join(" "));

// ---- Mobile and desktop rendering ----
const pagesToCheck = ["/", "/guides/lineage-proof-roadmap/", "/guides/substitute-evidence/", "/guides/read-pension-file/", "/guides/records-by-state/", "/guides/bounty-land-warrants/",
  "/guides/census-bridge/", "/guides/patriotic-service/", "/guides/same-name/", "/guides/patriot-or-loyalist/", "/guides/application-problems/",
  "/tools/service-window-checker/", "/tools/lineage-matrix/", "/tools/service-window-checker/report/", "/tools/lineage-matrix/report/", "/about/", "/privacy/", "/contact/", "/sources/"];
const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await mobile.newPage(); const overflow = [];
mp.on("pageerror", (e) => consoleErrors.push(`mobile ${mp.url()}: ${e.message}`));
for (const p of pagesToCheck) {
  await mp.goto(BASE + p);
  const o = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (o.sw > o.iw + 1) overflow.push(`${p} (${o.sw}px)`);
}
check(`Mobile 375px: no horizontal page overflow on ${pagesToCheck.length} pages`, overflow.length === 0, overflow.join(", "));
const tapTargets = await (async () => { await mp.goto(`${BASE}/tools/lineage-matrix/`); return mp.$$eval(".tool button:not(.link)", (bs) => bs.filter((b) => b.getBoundingClientRect().height < 44).length); })();
// Regression: widow-act table reflows into stacked cards at 360px with no horizontal page overflow.
const narrow = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const np = await narrow.newPage(); np.on("pageerror", (e) => consoleErrors.push(`360px: ${e.message}`));
await np.goto(`${BASE}/tools/service-window-checker/`); await np.click("[data-load-example]");
const wInfo = await np.evaluate(() => { const t = document.querySelector("table.widow"); const tr = t.querySelector("tbody tr"); const td = tr.querySelector("td");
  return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, tw: t.getBoundingClientRect().width, td: getComputedStyle(td).display, thead: getComputedStyle(t.querySelector("thead")).display, label: getComputedStyle(td, "::before").content }; });
check("Mobile 360px (regression): widow-act table shows stacked cards, no horizontal overflow", wInfo.sw <= wInfo.iw + 1 && wInfo.tw <= wInfo.iw && wInfo.td === "block" && wInfo.thead === "none" && /Pension law/.test(wInfo.label), JSON.stringify(wInfo));
await np.screenshot({ path: join(SHOTS, "m360-widow-cards.png"), fullPage: false }); await np.evaluate(() => document.querySelector("table.widow").scrollIntoView()); await np.screenshot({ path: join(SHOTS, "m360-widow-cards.png") });
await np.goto(`${BASE}/tools/service-window-checker/report/`);
const rInfo = await np.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, td: getComputedStyle(document.querySelector("table.widow td")).display }));
check("Mobile 360px (regression): checker report's widow table also stacks, no overflow", rInfo.sw <= rInfo.iw + 1 && rInfo.td === "block", JSON.stringify(rInfo));
await narrow.close();
check("Mobile: tool buttons are at least 44px tall", tapTargets === 0, `${tapTargets} small`);
for (const [p, name] of [["/", "m-home"], ["/guides/substitute-evidence/", "m-guide-table"], ["/tools/service-window-checker/", "m-tool-a"], ["/tools/lineage-matrix/", "m-tool-b"]]) {
  await mp.goto(BASE + p); if (name === "m-guide-table") await mp.evaluate(() => document.querySelector(".table-wrap").scrollIntoView());
  if (name === "m-tool-b") { await mp.click('[data-add-evidence="1"]'); await mp.evaluate(() => document.querySelector("section.gen").scrollIntoView()); }
  await mp.screenshot({ path: join(SHOTS, `${name}.png`) });
}
await page.goto(`${BASE}/guides/read-pension-file/`); await page.screenshot({ path: join(SHOTS, "desktop-guide.png") });
// ---- Cache-busting: every script/CSS reference and every module import carries ?v=<hash> that matches the file ----
const { createHash } = await import("node:crypto");
const htmlRefs = pagesToCheck.flatMap((p) => [...readFileSync(join(DIST, p, "index.html"), "utf8").matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css)[^"]*)"/g)].map((m) => m[1]));
const { readdirSync } = await import("node:fs");
const jsImports = readdirSync(join(DIST, "assets/js")).filter((f) => f.endsWith(".js")).flatMap((f) => [...readFileSync(join(DIST, "assets/js", f), "utf8").matchAll(/from\s+"\.\/([^"]+)"/g)].map((m) => `/assets/js/${m[1]}`));
const badRefs = [...htmlRefs, ...jsImports].filter((u) => { const [path, q] = u.split("?v="); if (!q) return true;
  return createHash("sha256").update(readFileSync(join(DIST, path))).digest("hex").slice(0, 10) !== q; });
check("Cache-busting: every page's script/CSS URL and every module import is versioned with the file's content hash", htmlRefs.length > 0 && jsImports.length >= 7 && badRefs.length === 0, badRefs.slice(0, 3).join(" "));
check("No JavaScript errors in the console on any page visited", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close(); server.close();
const passed = results.filter((r) => r.ok).length;
writeFileSync(join(ROOT, "qa/e2e-results.json"), JSON.stringify({ ranAt: new Date().toString(), browser: `${CHROME || "playwright Chromium"} (headless) via playwright-core ${require("playwright-core/package.json").version}`, passed, total: results.length, results, requestsTotal: requests.length, externalRequests: external.length, interactionRequests: duringInteraction.length, faviconLate }, null, 2));
console.log(`\nE2E: ${passed}/${results.length} checks passed.`);
process.exit(passed === results.length ? 0 : 1);
