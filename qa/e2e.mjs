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
check("Tool A: core window 1775-04-19..1776-01-01 shows mandated consistent sentence", txt.includes("Date range appears consistent with published rule; verify service category and primary evidence."), txt.slice(0, 120));
await page.selectOption("#ta-type", "galvez_cattle"); await page.fill("#ta-start", "1776-12-24"); await page.fill("#ta-end", ""); await page.click('form[data-form=window] button[type=submit]');
txt = await page.textContent('[data-out=window]');
check("Tool A: Gálvez cattle 24 Dec 1776 is outside the rule", /Outside the rule/.test(txt), txt.slice(0, 100));
await page.fill("#tw-m", "1780-05-01"); await page.fill("#tw-e", "1781-10-19"); await page.fill("#tw-mo", "24"); await page.fill("#tw-d", "730"); await page.click('form[data-form=widow] button[type=submit]');
txt = await page.textContent('[data-out=widow]');
check("Tool A: widow table shows 1836 note about 1832 service categories", /1832/.test(txt) && /Continental Line/.test(txt), "");
const rows = await page.$$eval('[data-out=widow] tbody tr', (trs) => trs.map((tr) => [tr.cells[0].textContent, tr.cells[1].textContent]));
const r1853 = rows.find((r) => r[0].includes("1853")); const r1855 = rows.find((r) => r[0].includes("February 28, 1855"));
check("Tool A: 1853 and Feb-1855 acts display 'Not evaluated'", r1853?.[1].includes("Not evaluated") && r1855?.[1].includes("Not evaluated"), `${r1853?.[1].slice(0, 30)} | ${r1855?.[1].slice(0, 30)}`);
const bodyA = await page.textContent("body"); check("Tool A page: no 'Qualif' anywhere in rendered text", !/qualif/i.test(bodyA));
let store = await ls();
check("Tool A: saved under namespaced keys only", Object.keys(store).filter((k) => k.startsWith("pi.toolA.")).sort().join(",") === "pi.toolA.widow,pi.toolA.window", Object.keys(store).join(","));
await page.screenshot({ path: join(SHOTS, "desktop-tool-a.png"), fullPage: false });
// Report page
phase("load"); await page.goto(`${BASE}/tools/service-window-checker/report/`); phase("interact");
txt = await page.textContent("[data-report]");
check("Tool A report renders saved checks from localStorage", txt.includes("Service window check") && txt.includes("Widow pension"), "");
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
check("Tool A embed on guide #3 works (27 Nov 1783 outside)", /Outside the rule/.test(txt));

// ---- Tool B ----
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
check("Tool B: starts with 2 generations", (await page.$$("section.gen")).length === 2);
await page.click('[data-add-evidence="1"]');
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
check("Tool B: gap list shows conflict first and missing items", /conflict flagged/.test(gapsTxt) && /no death evidence/.test(gapsTxt), gapsTxt.slice(0, 120));
await page.screenshot({ path: join(SHOTS, "desktop-tool-b.png"), fullPage: false });
phase("load"); await page.reload(); phase("interact");
check("Tool B: state persists after reload (localStorage)", (await page.$$("section.gen")).length === 3 && (await page.$$("section.gen .cell")).length === 2);
const bText = await page.textContent('[data-tool="lineage-matrix"]'); check("Tool B: the word 'Documented' never appears in tool output", !/\bdocumented\b/i.test(bText), "");
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/report/`); phase("interact");
txt = await page.textContent("[data-report]");
check("Tool B report page renders generations, labels and gaps", /Generation 1/.test(txt) && /Conflict Flagged/.test(txt) && /Open gaps/.test(txt));
phase("load"); await page.goto(`${BASE}/guides/same-name/`); phase("interact");
txt = await page.textContent("[data-card-status]");
check("Tool B embed card on guide #8 reads saved state", /3 generations, 2 evidence entries/.test(txt), txt);
store = await ls();
check("Tool B: saved under pi.toolB.v1 only", Object.keys(store).filter((k) => k.startsWith("pi.toolB")).join(",") === "pi.toolB.v1");
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
await page.click("[data-clear=toolB]");
store = await ls();
check("Tool B clear: removes pi.toolB.* only, keeps unrelated key", !Object.keys(store).some((k) => k.startsWith("pi.toolB")) && store["other.app.key"] === "keep-me", Object.keys(store).join(","));

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
check("Mobile: tool buttons are at least 44px tall", tapTargets === 0, `${tapTargets} small`);
for (const [p, name] of [["/", "m-home"], ["/guides/substitute-evidence/", "m-guide-table"], ["/tools/service-window-checker/", "m-tool-a"], ["/tools/lineage-matrix/", "m-tool-b"]]) {
  await mp.goto(BASE + p); if (name === "m-guide-table") await mp.evaluate(() => document.querySelector(".table-wrap").scrollIntoView());
  if (name === "m-tool-b") { await mp.click('[data-add-evidence="1"]'); await mp.evaluate(() => document.querySelector("section.gen").scrollIntoView()); }
  await mp.screenshot({ path: join(SHOTS, `${name}.png`) });
}
await page.goto(`${BASE}/guides/read-pension-file/`); await page.screenshot({ path: join(SHOTS, "desktop-guide.png") });
check("No JavaScript errors in the console on any page visited", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close(); server.close();
const passed = results.filter((r) => r.ok).length;
writeFileSync(join(ROOT, "qa/e2e-results.json"), JSON.stringify({ ranAt: new Date().toString(), browser: `${CHROME || "playwright Chromium"} (headless) via playwright-core ${require("playwright-core/package.json").version}`, passed, total: results.length, results, requestsTotal: requests.length, externalRequests: external.length, interactionRequests: duringInteraction.length, faviconLate }, null, 2));
console.log(`\nE2E: ${passed}/${results.length} checks passed.`);
process.exit(passed === results.length ? 0 : 1);
