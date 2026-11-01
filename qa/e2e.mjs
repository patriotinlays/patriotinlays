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

// ---- Audit 2 #1: a fresh first visit starts empty; results only after the button; prefill never auto-runs; Start over ----
{ const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const fp = await fresh.newPage();
  fp.on("pageerror", (e) => consoleErrors.push(`fresh: ${e.message}`));
  const formState = () => fp.evaluate(() => ({ vals: [...document.querySelectorAll("form[data-form=widow] input")].map((i) => i.type === "checkbox" ? i.checked : i.value),
    rows: document.querySelectorAll("[data-out=widow] tbody tr").length, ls: Object.keys(localStorage), plan: (document.querySelector('[data-tool="widow"] [data-plan] [data-plan-wait]')?.textContent || "") + (document.querySelector('[data-tool="widow"] [data-plan] .plan-title') ? " PLAN-SHOWN" : ""),
    saved: !document.querySelector("[data-saved-msg]").hidden }));
  await fp.goto(`${BASE}/tools/widow-pension-checker/`);
  let f = await formState();
  check("Fresh profile: widow checker starts empty and unticked, with no results and nothing saved", f.vals.every((v) => v === "" || v === false) && f.rows === 0 && (await fp.$$("[data-answer]")).length === 0 && f.ls.length === 0 && /appear here after you press/.test(f.plan) && !/PLAN-SHOWN/.test(f.plan) && !f.saved, JSON.stringify(f));
  check("Widow checker: a visible 'Start over' button", await fp.isVisible('[data-tool="widow"] [data-start-over]') && (await fp.textContent("[data-start-over]")).trim() === "Start over");
  await fp.click("[data-load-example]"); const exRows = (await formState()).rows;
  await fp.reload(); f = await formState();
  check("Returning visit: the form starts empty and unticked with no old results; a note points to the saved check and 'Start over'", exRows === 7 && f.vals.every((v) => v === "" || v === false) && f.rows === 0 && /appear here after you press/.test(f.plan) && !/PLAN-SHOWN/.test(f.plan) && f.saved && /Start over/.test(await fp.textContent("[data-saved-msg]")), JSON.stringify(f));
  await fp.evaluate(() => localStorage.setItem("pi.toolB.v1", JSON.stringify({ generations: [{ gen: 1, living: true, cells: [] }, { gen: 2, cells: [] }], patriot: { name: "Prefill Test", state: "VA", kind: "militia", start: "1777", end: "1779-10", gen: "" } })));
  await fp.goto(`${BASE}/tools/widow-pension-checker/?from=worksheet`); f = await formState();
  check("Prefill from the worksheet fills his service end but does not run the check", f.vals[1] === "1779-10" && f.vals[0] === "" && f.vals[4] === false && f.rows === 0, JSON.stringify(f));
  await fp.click('form[data-form=widow] button[type=submit]'); const afterPress = (await formState()).rows;
  await fp.click("[data-start-over]"); f = await formState();
  check("Start over: empties the form, deletes this checker's saved data only, and says so", afterPress === 7 && f.vals.every((v) => v === "" || v === false) && !f.ls.some((k) => k.startsWith("pi.toolA.")) && f.ls.includes("pi.toolB.v1") && /Started over: deleted 1 saved item from this browser/.test(await fp.textContent("[data-out=widow]")) && !f.saved, JSON.stringify(f));
  await fresh.close(); }

// ---- Widow Pension Law Checker (leads the site) ----
phase("load"); await page.goto(`${BASE}/tools/widow-pension-checker/`); await page.evaluate(() => localStorage.setItem("other.app.key", "keep-me"));
phase("interact");
const intro = await page.textContent("main");
check("Widow checker page: explains what it tells you and why it matters for finding pension files", /What it tells you/.test(intro) && /Why it matters/.test(intro) && /pension file/i.test(intro));
check("Widow checker page: the standalone service-date form is gone", (await page.$$("form[data-form=window], #ta-start")).length === 0);
const howA = await page.textContent('[data-tool="widow"] .howto');
check("Widow checker: 'How this works' says it doesn't search records and nothing leaves the device", /does not search any records/.test(howA) && /Nothing you type leaves your device/.test(howA), howA.slice(0, 160));
check("Widow checker: before any check, 'What to do next' shows only a labelled placeholder, not a generic plan (audit 3)", /appear here after you press/.test(await page.textContent('[data-tool="widow"] [data-plan]')) && (await page.$$('[data-tool="widow"] [data-plan] .plan-steps')).length === 0);
await page.fill("#tw-m", "1780-05-01"); await page.fill("#tw-e", "1781-10-19"); await page.fill("#tw-mo", "24"); await page.fill("#tw-d", "730"); await page.click('form[data-form=widow] button[type=submit]');
let txt = await page.textContent('[data-out=widow]');
check("Widow checker: table shows 1836 note about 1832 service categories", /1832/.test(txt) && /Continental Line/.test(txt), "");
const rows = await page.$$eval('[data-out=widow] tbody tr', (trs) => trs.map((tr) => [tr.cells[0].textContent, tr.cells[1].textContent]));
const r1853 = rows.find((r) => r[0].includes("1853")); const r1855 = rows.find((r) => r[0].includes("February 28, 1855"));
check("Widow checker: 1853 and Feb-1855 acts display 'Not checked'", r1853?.[1].includes("Not checked") && r1855?.[1].includes("Not checked"), `${r1853?.[1].slice(0, 30)} | ${r1855?.[1].slice(0, 30)}`);
const next1853 = await page.$$eval('[data-out=widow] tbody tr', (trs) => trs.find((tr) => tr.cells[0].textContent.includes("1853")).cells[2].textContent);
check("Widow checker: 'Not checked' row says why and what to do (pension papers / registrar)", /Why:/.test(next1853) && /What to do/.test(next1853) && /registrar/.test(next1853), next1853.slice(0, 80));
await page.fill("#tw-m", "1790"); await page.fill("#tw-e", "1779-10"); await page.fill("#tw-mo", "20"); await page.fill("#tw-d", ""); await page.click('form[data-form=widow] button[type=submit]');
const r1836 = await page.$$eval('[data-out=widow] tbody tr', (trs) => trs.find((tr) => tr.cells[0].textContent.includes("1836")).cells[1].textContent);
check("Widow checker (audit 2): 1836 'Doesn't fit' says why: married 1790, service ended 1779-10, and the rule", /Doesn't fit/.test(r1836) && /1790/.test(r1836) && /1779-10/.test(r1836) && /marriage came after his service ended/.test(r1836), r1836.slice(0, 160));
await page.fill("#tw-m", "1790"); await page.fill("#tw-e", "1779"); await page.fill("#tw-mo", ""); await page.fill("#tw-d", ""); await page.uncheck('form[data-form=widow] input[name=engagement]'); await page.click('form[data-form=widow] button[type=submit]');
const a3 = await page.evaluate(() => ({ r: [...document.querySelectorAll("[data-out=widow] tbody tr")].find((tr) => tr.cells[0].textContent.includes("1836")).cells[1].textContent, ans: document.querySelector("[data-answer]")?.textContent || "" }));
check("Widow checker (audit 3 #1): married 1790, service ended 1779, no months typed -> 1836 'Doesn't fit as typed' with the plain reason, not 'Not checked'", /Doesn't fit/.test(a3.r) && !/Not checked/.test(a3.r) && /marriage came after his service ended/.test(a3.r) && /Doesn't fit: the 1836 law/.test(a3.ans), a3.r.slice(0, 120));
check("Widow checker: each field shows a 'Why it matters' line", (await page.$$eval("form[data-form=widow] [data-why]", (ps) => ps.filter((p) => p.textContent.startsWith("Why it matters")).length)) === 4);
await page.click('[data-tool="widow"] [data-load-example]');
const exD = await page.textContent('[data-out=widow]');
const planA = await page.textContent('[data-tool="widow"] [data-plan]');
check("Widow checker: example plan -> look for the widow's pension file, registrar (DAR Chapter Locator), start application", /Look for the widow's pension file/.test(planA) && /Contact a local chapter's registrar/.test(planA) && /Start the application/.test(planA)
  && (await page.$$('[data-tool="widow"] [data-plan] a[href="https://www.dar.org/discover/become-member/chapter-locator"]')).length === 1, planA.slice(0, 80));
check("Widow checker: plan names the 'Not checked' laws in their own step", /For the laws marked "Not checked"/.test(planA) && /1853/.test(planA));
await page.evaluate(() => { window.__printed = 0; window.__planOnly = null; window.print = () => { window.__printed++; window.__planOnly = document.body.classList.contains("print-plan"); }; });
await page.click('[data-tool="widow"] [data-print-plan]');
check("Widow checker: 'Print or save this plan' prints in plan-only mode", (await page.evaluate(() => window.__printed === 1 && window.__planOnly === true)));
check("Widow checker: no 'Not evaluated' wording anywhere on the page", !/not evaluated/i.test(await page.textContent("main")));
check("Widow checker: 'Load an example' shows results at once", /Fits this law's date rule/.test(exD), exD.slice(0, 60));
const ans = await page.evaluate(() => { const a = document.querySelector("[data-out=widow] [data-answer]"); const t = document.querySelector("[data-out=widow] table.widow");
  return a && t ? { text: a.textContent, above: !!(a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) } : null; });
check("Widow checker: a one-line plain answer sits above the table ('5 of 7 widow-pension laws fit your dates…', with the next step)", ans?.above && /^In short: 5 of 7 widow-pension laws fit your dates: the 1836, 1838, 1848, March 1855 bounty-land and 1878 laws\./.test(ans.text) && /Next: look for the widow's pension file/.test(ans.text), ans?.text);
const terms = await page.textContent("[data-out=widow] [data-terms]");
check("Widow checker: results explain 'Stat.' (Statutes at Large: volume, page) and 'bounty land' in plain words", /Statutes at Large/.test(terms) && /volume 5, page 128/.test(terms) && /Bounty land was free public land/.test(terms), terms.slice(0, 120));
check("Widow checker page: no 'Qualif' anywhere in rendered text", !/qualif/i.test(await page.textContent("body")));
let store = await ls();
check("Widow checker: saved under namespaced keys only", Object.keys(store).filter((k) => k.startsWith("pi.toolA.")).sort().join(",") === "pi.toolA.widow", Object.keys(store).join(","));
await page.screenshot({ path: join(SHOTS, "desktop-widow.png"), fullPage: false });
phase("load"); await page.goto(`${BASE}/tools/widow-pension-checker/report/`); phase("interact");
txt = await page.textContent("[data-report]");
check("Widow report renders saved results from localStorage", /Widow pension/.test(txt) && /1836/.test(txt), txt.slice(0, 80));
check("Widow report: 'What to do next' plan with a 'Print or save this plan' button", /What to do next/.test(txt) && /Contact a local chapter's registrar/.test(txt) && (await page.$$("[data-report] [data-print-plan]")).length === 1);
await page.emulateMedia({ media: "print" });
const printHidden = await page.$$eval("header.site, footer.site, .tool button", (els) => els.every((e) => getComputedStyle(e).display === "none"));
check("Widow report: print CSS hides nav, footer and buttons", printHidden); await page.emulateMedia({ media: "screen" });
await page.click('[data-tool-report="widow"] [data-clear=toolA]');
store = await ls();
check("Widow clear: removes pi.toolA.* only, keeps unrelated key", !Object.keys(store).some((k) => k.startsWith("pi.toolA.")) && store["other.app.key"] === "keep-me", Object.keys(store).join(","));
phase("load"); await page.goto(`${BASE}/guides/read-pension-file/`); phase("interact");
check("Guide #3 shows the widow checker card linking the checker", (await page.$$('[data-tool-card="widow"] a[href="/tools/widow-pension-checker/"]')).length === 1);
// Retired service-date check: redirects, sitemap, no internal links left
const redirects = readFileSync(join(DIST, "_redirects"), "utf8");
check("Retired /tools/service-window-checker/ (and its report) 301-redirect to the widow checker", /^\/tools\/service-window-checker\/ \/tools\/widow-pension-checker\/ 301$/m.test(redirects) && /^\/tools\/service-window-checker\/report\/ \/tools\/widow-pension-checker\/report\/ 301$/m.test(redirects));
const sm = readFileSync(join(DIST, "sitemap.xml"), "utf8");
const { readdirSync: rd0 } = await import("node:fs");
const htmlFiles = (function walk(d) { return rd0(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".html") ? [join(d, e.name)] : []); })(DIST);
check("Sitemap lists the widow checker and not the retired URL; no page links to the retired URL", sm.includes("/tools/widow-pension-checker/") && !sm.includes("service-window-checker") && htmlFiles.every((f) => !readFileSync(f, "utf8").includes('href="/tools/service-window-checker')), "");

// ---- Worksheet patriot step ----
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
check("Worksheet: step 1 is the patriot step", /The patriot/.test(await page.textContent("#tb-patriot")) && (await page.$$("[data-patriot-form] #pat-kind option")).length >= 9);
await page.fill("#pat-name", "Test Patriot"); await page.selectOption("#pat-state", "NC"); await page.selectOption("#pat-kind", "continental"); await page.fill("#pat-start", "1776-02"); await page.fill("#pat-end", "1779-06");
txt = await page.textContent("[data-patriot-check]");
check("Patriot step: dates checked against DAR's period for that type of service (not a ruling), linking the widow checker", /Dates fit DAR's period/.test(txt) && /not a ruling/.test(txt) && (await page.$$('[data-patriot-check] a[href="/tools/widow-pension-checker/?from=worksheet"]')).length === 1, txt.slice(0, 120));
await page.fill("#pat-start", "1785"); await page.fill("#pat-end", "");
check("Patriot step: dates outside the period are flagged", /outside|does not fit|not inside/i.test(await page.textContent("[data-patriot-check]")), (await page.textContent("[data-patriot-check]")).slice(0, 100));
await page.fill("#pat-start", "1776-02"); await page.fill("#pat-end", "1779-06");
const planP = await page.textContent('[data-tool="lineage-matrix"] [data-plan]');
check("Patriot step drives the plan: prove his service (North Carolina troop returns, M881), then the widow-pension step", /Prove the patriot's service/.test(planP) && /North Carolina/.test(planP) && /M881/.test(planP) && /widow-pension laws/.test(planP), planP.slice(0, 160));
phase("load"); await page.goto(`${BASE}/tools/widow-pension-checker/?from=worksheet`); phase("interact");
check("Widow checker auto-fills his service end from the worksheet patriot", (await page.inputValue("#tw-e")) === "1779-06" && /Test Patriot/.test(await page.textContent("[data-worksheet-msg]")), await page.textContent("[data-worksheet-msg]"));
await page.click("[data-clear=toolA]");
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
await page.evaluate(() => localStorage.removeItem("pi.toolB.v1")); phase("load"); await page.reload(); phase("interact");

// ---- Tool B ----
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
check("Tool B report: numbered action plan (records with where-to-look letters, registrar, start application) + Save as PDF", /What to do next/.test(txt) && /Records to find or fix, generation by generation/.test(planRep) && /registrar/.test(planRep) && /Start the application/.test(planRep) && (await page.$$("[data-save-pdf]")).length === 1);
check("Tool B report: every gap points to a 'Where to look' block", (await page.$$("[data-report] .plan-sub > li [data-where-ref]")).length === (await page.$$("[data-report] .plan-sub > li")).length && (await page.$$("[data-report] .plan-sub > li")).length > 0 && /Where to look/.test(txt));
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
check("Tool B: 'Load an example' fills a made-up patriot and family and shows gaps with where to look", (await page.$$("section.gen")).length === 5 && (await page.inputValue("#pat-name")).length > 0 && (await page.$$("[data-gaps] .where a[href*='archives.gov']")).length > 0);
const notes = await page.$$eval("[data-gaps] .where-note", (ns) => ns.map((n) => n.textContent));
check("Where to look is tailored: Virginia's 1853-1896 birth registers and the censuses in each lifetime appear", notes.some((n) => /1853 to 1896/.test(n)) && notes.some((n) => /Censuses in their lifetime/.test(n)), notes.slice(0, 2).join(" | ").slice(0, 160));
check("Where to look: the patriot's generation is labelled", /\(the patriot\)/.test(await page.textContent("[data-gaps]")));
const noteHrefs = await page.$$eval("[data-gaps] .where a", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
check("Where to look: state/era links (Library of Virginia, Pennsylvania) are Source Manifest sources", noteHrefs.includes("https://lva-virginia.libguides.com/bmd") && noteHrefs.some((h) => h.startsWith("https://www.pa.gov/")) && noteHrefs.every((h) => mUrls.has(h) || /^\/guides\/[a-z-]+\/$/.test(h)), noteHrefs.join(" "));
// ---- Beginner changes: the example report (one-page summary, "Where to look" once, Save as PDF, page count) ----
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/report/`); phase("interact");
const rep = await page.evaluate(() => { const r = document.querySelector("[data-report]");
  const blocks = [...r.querySelectorAll("[data-where-block]")]; const texts = blocks.map((b) => b.querySelector("p").textContent.replace(/^[A-Z]+\. /, ""));
  const refs = [...r.querySelectorAll("[data-where-ref] a")].map((a) => a.getAttribute("href").slice(7));
  return { first: r.firstElementChild?.dataset.summary !== undefined, h2: [...r.querySelectorAll("h2")].map((h) => h.textContent), blocks: texts.length, unique: new Set(texts).size, refs, letters: blocks.map((b) => b.dataset.whereBlock),
    fullWhere: r.querySelectorAll(".where").length, censusDup: texts.filter((t) => /^Censuses in their lifetime/.test(t)).length, save: !!document.querySelector("[data-save-pdf]") && document.querySelector("[data-save-pdf]").offsetParent !== null }; });
check("Report: opens with a one-page summary (patriot, where you are, what to do next) before 'Where to look' and the records", rep.first && rep.h2[0] === "Summary" && rep.h2[1] === "Where to look" && /The patriot: John \(made up\)/.test(await page.textContent("[data-summary]")), rep.h2.join(" | "));
check("Report: each 'Where to look' block appears once, and every to-do points to it by letter", rep.blocks > 0 && rep.unique === rep.blocks && rep.fullWhere === 0 && rep.refs.length > 0 && rep.refs.every((L) => rep.letters.includes(L)) && rep.letters.every((L) => rep.refs.includes(L)), JSON.stringify({ blocks: rep.blocks, unique: rep.unique, refs: rep.refs.length }));
check("Report: a visible 'Save as PDF' button prints the summary only", rep.save && await (async () => { await page.evaluate(() => { window.__sp = null; window.print = () => { window.__sp = document.body.classList.contains("print-summary"); }; }); await page.click("[data-save-pdf]"); return page.evaluate(() => window.__sp === true); })());
await page.emulateMedia({ media: "print" }); await page.evaluate(() => document.body.classList.add("print-summary"));
const pdfPages = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
// Measured like Chrome's print window: Letter, the page's own margins, headers and footers on (audit 3 printed 3 and 5 pages).
const PDF_OPTS = { format: "Letter", displayHeaderFooter: true, preferCSSPageSize: true };
const summaryPages = pdfPages(await page.pdf({ ...PDF_OPTS, path: join(SHOTS, "example-report-summary.pdf") }));
const printUrls = await page.evaluate(() => [...document.querySelectorAll("main a")].filter((a) => /http/.test(getComputedStyle(a, "::after").content)).length);
await page.evaluate(() => document.body.classList.remove("print-summary")); const fullPages = pdfPages(await page.pdf({ ...PDF_OPTS, path: join(SHOTS, "example-report-full.pdf") }));
const printUrlsFull = await page.evaluate(() => [...document.querySelectorAll("main a")].filter((a) => /http/.test(getComputedStyle(a, "::after").content)).length);
const hostRefs = await page.evaluate(() => [...document.querySelectorAll("main a[data-host]")].map((a) => getComputedStyle(a, "::after").content).filter((c) => /^"\s\(/.test(c)).length);
await page.emulateMedia({ media: "screen" }); globalThis.__reportPages = { ...(globalThis.__reportPages || {}), summaryPages, fullPages };
const claim = await page.$eval("[data-page-claim]", (e) => ({ s: +e.dataset.summaryPages, f: +e.dataset.fullPages, t: e.textContent }));
check("Report: the page-count claim matches headless Chrome's print-to-PDF of the example (Save as PDF and Ctrl+P)", claim.s === summaryPages && claim.f === fullPages && claim.t.includes(`${summaryPages} Letter pages`) && claim.t.includes(`on ${fullPages} with every record`) && summaryPages <= 2 && fullPages <= 3, `summary ${summaryPages}, full ${fullPages}; claim ${claim.s}/${claim.f}`);
check("Report: printing shows no link addresses, only short source references like (archives.gov)", printUrls === 0 && printUrlsFull === 0 && hostRefs > 0, `${printUrls}/${printUrlsFull} URL expansions, ${hostRefs} short refs`);
check("Report: links to the definitions", (await page.$$('main a[href="/#glossary"]')).length >= 1);
// ---- Audit 3 regressions: persona B (Virginia militia, Ohio family, a ticked census entry) ----
{
  const cellB = (fact, docType) => ({ id: "b" + Math.random().toString(36).slice(2), fact, docType, mode: "", conflict: false, citation: "" });
  const personaB = { version: 1, updated: new Date().toISOString(), patriot: { name: "", state: "VA", unit: "", kind: "militia", start: "1777", end: "1779", gen: "6" },
    generations: [
      { gen: 1, who: "", living: true, born: "1960", died: "", state: "OH", cells: [cellB("birth", "birth_cert_long")] },
      { gen: 2, who: "", living: false, born: "1930", died: "1999", state: "OH", cells: [cellB("parentage", "probate"), cellB("birth", "birth_cert_long"), cellB("death", "death_cert")] },
      { gen: 3, who: "", living: false, born: "1900", died: "1970", state: "OH", cells: [] },
      { gen: 4, who: "", living: false, born: "1850", died: "1920", state: "VA", cells: [] },
      { gen: 5, who: "", living: false, born: "1800", died: "1870", state: "VA", cells: [cellB("parentage", "probate")] },
      { gen: 6, who: "", living: false, born: "1755", died: "1830", state: "VA", cells: [] } ] };
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); await page.evaluate((d) => localStorage.setItem("pi.toolB.v1", JSON.stringify(d)), personaB);
  await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
  await page.check('[data-have="3"] input[data-have-item="census"]');
  const g3 = await page.$eval('section.gen[data-gen="3"] .cell', (c) => ({ doc: c.querySelector("select[name=docType]").value, status: c.querySelector(".status").textContent }));
  // Repeated notes: Ohio's no-source note is printed in full once on the worksheet page; later mentions are one-line pointers.
  const ohio = await page.evaluate(() => { const ps = [...document.querySelectorAll("main .where-note")].map((p) => p.textContent);
    return { full: ps.filter((t) => /no verified source yet on when Ohio began/.test(t)).length, refs: ps.filter((t) => /see the Ohio note above/.test(t)).length }; });
  check("Audit 3 #5: the 'no verified source for Ohio' note appears in full once on the worksheet page; other mentions just point to it", ohio.full === 1 && ohio.refs >= 1, JSON.stringify(ohio));
  // Patriot generation: a missing birth or death record has a clear way to add it.
  const addBtn = await page.$('[data-gaps] [data-add-for="6:birth"]');
  const btnText = addBtn ? await addBtn.textContent() : "";
  await addBtn?.click(); const g6 = await page.$$eval('section.gen[data-gen="6"] .cell select[name=fact]', (s) => s.map((x) => x.value));
  check("Audit 3 #4: the patriot's generation's 'add a birth or death record' item has a button that adds one there", /Add a birth or death record/.test(btnText) && g6.includes("birth"), `${btnText} -> ${g6}`);
  await page.click('section.gen[data-gen="6"] [data-remove-cell]').catch(() => {});
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("pi.toolB.v1")); s.generations[5].cells = []; localStorage.setItem("pi.toolB.v1", JSON.stringify(s)); });
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/report/`); phase("interact");
  const rb = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("table.records tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent));
    const where = document.querySelector("[data-summary]").textContent.match(/(\d+) evidence entr/);
    const gen2 = [...document.querySelectorAll(".plan-group")].find((g) => /^Generation 2/.test(g.textContent))?.parentElement.querySelectorAll(".plan-sub > li");
    const blocks = [...document.querySelectorAll("[data-where-block] p:first-child")].map((p) => p.textContent);
    const g6 = [...document.querySelectorAll(".plan-group")].find((g) => /the patriot/.test(g.textContent))?.parentElement;
    const tables = [...document.querySelectorAll(".report-detail h3")].map((h) => h.textContent);
    return { rows, entries: where ? +where[1] : -1, gen2: gen2 ? [...gen2].map((li) => li.firstChild.textContent) : [], ohio: blocks.filter((t) => /no verified source yet on when Ohio/.test(t)).length,
      censusBlocks: blocks.filter((t) => /^[A-Z]+\. Census:/.test(t)).map((t) => t.replace(/^[A-Z]+\. /, "")), g6add: g6?.querySelector("[data-add-link]")?.getAttribute("href") || "" }; });
  const census = rb.rows.find((r) => /Census/.test(r[1]));
  check("Audit 3 #3: a ticked 'Census entry' shows its kind and 'Entry Incomplete' in the report, and every counted entry is a row there", g3.doc === "census" && /Entry Incomplete/.test(g3.status) && census && /Census entry/.test(census[1]) && /Entry Incomplete/.test(census[4]) && rb.entries === rb.rows.length && !rb.rows.some((r) => /No Evidence Entered/.test(r[4])), JSON.stringify({ g3, census, entries: rb.entries, rows: rb.rows.length }));
  check("Audit 3 #4: within a generation, the person's own records (birth, death) come before the link record, in the plan and in the records table", /^The birth record/.test(rb.gen2[0] || "") && /^The death record/.test(rb.gen2[1] || "") && /link/.test(rb.gen2.at(-1) || "") && rb.rows.findIndex((r) => r[0] === "Birth") < rb.rows.findIndex((r) => /Parent/.test(r[0])), rb.gen2.join(" | "));
  check("Audit 3 #4: in the report, the patriot's missing birth or death record links to his generation in the worksheet", rb.g6add === "/tools/lineage-matrix/#gen-6", rb.g6add);
  check("Audit 3 #5: the report prints the Ohio no-source note once, and each census fact once", rb.ohio === 1 && rb.censusBlocks.length === new Set(rb.censusBlocks).size && rb.censusBlocks.length >= 2, JSON.stringify(rb.censusBlocks));
  await page.emulateMedia({ media: "print" }); await page.evaluate(() => document.body.classList.add("print-summary"));
  const bS = pdfPages(await page.pdf(PDF_OPTS)); await page.evaluate(() => document.body.classList.remove("print-summary")); const bF = pdfPages(await page.pdf(PDF_OPTS));
  await page.emulateMedia({ media: "screen" }); globalThis.__reportPages = { ...(globalThis.__reportPages || {}), personaB: { summaryPages: bS, fullPages: bF } };
  check("Audit 3 #2: the audit's longer persona-B report prints shorter than before (Save as PDF 3 -> at most 2, Ctrl+P 5 -> at most 3)", bS <= 2 && bF <= 3, `summary ${bS}, full ${bF}`);
  await page.evaluate(() => localStorage.removeItem("pi.toolB.v1"));
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); await page.click("[data-load-example]"); phase("interact");
}
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
await page.selectOption("#state-3", "TX");
const genOpts = await page.$$eval("#pat-gen option", (os) => os.map((o) => [o.value, o.textContent]));
check("Generation picker (audit 2): Generation 1 is not offered; the default is the oldest generation", !genOpts.some(([v]) => v === "1") && genOpts[0][0] === "" && /oldest generation I've added \(now my 2nd-great-grandfather, generation 5\)/.test(genOpts[0][1]) && genOpts.some(([v, t]) => v === "6" && t === "My 3rd-great-grandfather (generation 6)"), JSON.stringify(genOpts.slice(0, 2)));
const subst = await page.$$eval("[data-gaps] .where-note a[data-substitute]", (as) => as.map((a) => [a.getAttribute("href"), a.closest(".where-note").textContent]));
check("Birth gap (audit 2): Virginia before 1853 says there was no statewide birth recording and links the substitute-evidence guide right there", subst.some(([h, t]) => h === "/guides/substitute-evidence/" && /no statewide recording of births before 1853/.test(t)), JSON.stringify(subst).slice(0, 160));
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("pi.toolB.v1")); s.patriot.gen = "1"; localStorage.setItem("pi.toolB.v1", JSON.stringify(s)); });
phase("load"); await page.reload(); phase("interact");
const heads = await page.$$eval("section.gen h3", (hs) => hs.map((h) => h.textContent));
check("Generation picker (audit 2): an old saved 'Generation 1' shows a plain warning and the oldest generation stays the patriot", await page.isVisible("[data-gen-warn]") && /Generation 1 is you/.test(await page.textContent("[data-gen-warn]")) && !/patriot/.test(heads[0]) && /\(the patriot\)/.test(heads.at(-1)), heads.join(" | "));
const txNote = await page.textContent('[data-gaps] li[data-gap-gen="3"]');
check("Where to look: a state with no verified source says so (no invented records)", /no verified source yet on when Texas/.test(txNote), txNote.slice(0, 120));
await page.click("[data-clear=toolB]");
store = await ls();
check("Tool B clear: removes pi.toolB.* only, keeps unrelated key", !Object.keys(store).some((k) => k.startsWith("pi.toolB")) && store["other.app.key"] === "keep-me", Object.keys(store).join(","));
// ---- Simpler worksheet: "What do you have?" checklist and plain relationship choices ----
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
await page.check('[data-have="2"] input[data-have-item="will"]');
const willCell = await page.evaluate(() => { const c = document.querySelectorAll('section.gen[data-gen="2"] .cell'); return { n: c.length, fact: c[0]?.querySelector("select[name=fact]").value, doc: c[0]?.querySelector("select[name=docType]").value }; });
await page.uncheck('[data-have="2"] input[data-have-item="will"]'); const afterUntick = (await page.$$('section.gen[data-gen="2"] .cell')).length;
check("Worksheet: ticking 'Will or probate record' under 'What do you have?' adds a record with what it shows and its kind already picked; unticking removes it", willCell.n === 1 && willCell.fact === "parentage" && willCell.doc === "probate" && afterUntick === 0, JSON.stringify(willCell));
check("Worksheet: the checklist offers birth certificate, will, census, Bible record and pension file", (await page.$$eval('[data-have="1"] input', (xs) => xs.map((x) => x.value))).join(",").includes("birth_cert,death_cert,marriage,will,census,bible,church,pension"));
await page.selectOption("#pat-gen", "7");
const g7 = await page.$$eval("section.gen h3", (hs) => hs.map((h) => h.textContent));
check("Worksheet: choosing 'My 4th-great-grandfather (generation 7)' adds the generations in between", g7.length === 7 && g7[6].startsWith("Generation 7: Your 4th-great-grandparent") && (await page.inputValue("#pat-gen")) === "7", g7.at(-1));
await page.evaluate(() => localStorage.removeItem("pi.toolB.v1"));
await page.evaluate(() => localStorage.setItem("pi.toolB.v1", JSON.stringify({ generations: [{ gen: 1, living: true, cells: [{ id: "a", fact: "birth", docType: "birth_cert_long", mode: "direct", conflict: false, citation: "Certificate 1" }] }, { gen: 2, cells: [] }], patriot: {} })));
phase("load"); await page.goto(`${BASE}/guides/same-name/`); phase("interact"); const card1 = await page.textContent("[data-card-status]");
check("Grammar (audit 2): the worksheet card says '1 evidence entry', never '1 evidence entries'", /2 generations, 1 evidence entry,/.test(card1) && !/\b1 evidence entries|\b1 things|\b1 generations/.test(card1), card1);
await page.evaluate(() => localStorage.removeItem("pi.toolB.v1"));
const srcHtml = readFileSync(join(DIST, "sources/index.html"), "utf8");
check("Grammar (audit 2): the Sources page says '(1 claim)', never '(1 claims)'", !/\(1 claims\)/.test(srcHtml) && /\(1 claim\)/.test(srcHtml));

// ---- Usefulness pass: home, guides, dead ends ----
phase("load"); await page.goto(`${BASE}/`); phase("interact");
const home = await page.textContent("main");
const gloss = await page.textContent(".glossary");
check("Home: short glossary defines Patriot, DAR, SAR, NSCDA and lineage society, each with a source note", ["Patriot:", "DAR:", "SAR:", "NSCDA:", "Lineage society:"].every((k) => gloss.includes(k)) && (await page.$$eval(".glossary li", (lis) => lis.every((li) => li.querySelector("sup a[href^='#src-']")))) && (await page.$$("#sources + ol.sources li")).length >= 3);
check("Home: offers the worksheet and the Roadmap guide as buttons", /Proving your whole line\?/.test(home) && (await page.$$('main a.button-link[href="/tools/lineage-matrix/"]')).length === 1 && (await page.$$('main a.button-link[href="/guides/lineage-proof-roadmap/"]')).length === 1);
const homeOrder = await page.evaluate(() => [...document.querySelectorAll("main h2")].map((h) => h.id));
check("Home (beginner path): 'Just starting?' is the first section, then 'How to join, in short', then the widow-pension check", homeOrder[0] === "just-starting" && homeOrder[1] === "how-to-join-in-short" && homeOrder[2] === "lead-widow" && /pension file/i.test(await page.textContent("main section.lead-tool")), homeOrder.slice(0, 3).join(","));
const firstLinks = await page.$$eval("main a", (as) => as.slice(0, 3).map((a) => a.getAttribute("href")));
check("Home (beginner path): the first three links in the page go to how to join, Step 0 (find the soldier's name) and the worksheet", firstLinks[0] === "#how-to-join-in-short" && firstLinks[1] === "/guides/lineage-proof-roadmap/#step-0-find-the-soldier-s-name" && firstLinks[2] === "/tools/lineage-matrix/", firstLinks.join(" "));
const navLinks = await page.$$eval("header.site nav a", (as) => as.map((a) => [a.getAttribute("href"), a.textContent]));
check("Navigation: 'Start here' (the Roadmap) comes first, then the widow-pension check", navLinks[0][0] === "/guides/lineage-proof-roadmap/" && navLinks[0][1] === "Start here" && navLinks[1][0] === "/tools/widow-pension-checker/", navLinks.map((x) => x[1]).join(" | "));
const joinItems = await page.$$eval("#how-to-join ol > li", (lis) => lis.map((li) => ({ t: li.textContent, sup: li.querySelectorAll("sup a").length })));
check("Home: 'How to join, in short' has 4 sourced steps, the DAR chapter locator and the SAR contact finder", joinItems.length === 4 && joinItems.every((x) => x.sup > 0) && (await page.$$('#how-to-join a[href="https://www.dar.org/discover/become-member/chapter-locator"]')).length === 1 && (await page.$$('#how-to-join a[href="https://www.sar.org/find-your-contact/"]')).length === 1);
// The beginner's three clicks: the big button -> Roadmap, whose top has "How to join" and "Step 0"
phase("load"); await page.click("main [data-start-button]"); await page.waitForURL("**/guides/lineage-proof-roadmap/"); phase("interact");
const rmOrder = await page.evaluate(() => [...document.querySelectorAll("main h2")].slice(0, 3).map((h) => h.id));
check("Roadmap: opens with 'How to join, in short' and 'Step 0: find the soldier's name' before the rest", rmOrder[0] === "how-to-join-in-short" && rmOrder[1] === "step-0-find-the-soldier-s-name", rmOrder.join(","));
const step0 = await page.evaluate(() => { const h = document.getElementById("step-0-find-the-soldier-s-name"); const ul = h.nextElementSibling.nextElementSibling; return [...ul.querySelectorAll("li")].map((li) => li.querySelectorAll("sup a").length); });
check("Roadmap Step 0: every point is sourced", step0.length >= 4 && step0.every((n) => n > 0), JSON.stringify(step0));
phase("load"); await page.goto(`${BASE}/`); phase("interact");
const glossTerms = ["DAR:", "SAR:", "NSCDA:", "Lineage society:", "Patriot:", "Bounty land:", "Stat.:"];
check("Home glossary also explains 'Bounty land' and 'Stat.', each sourced", ["Bounty land:", "Stat.:"].every((k) => gloss.includes(k)) && /Statutes at Large/.test(gloss) && /free land in the public domain/.test(gloss));
const defsBad = [];
for (const gp of ["/guides/lineage-proof-roadmap/", "/guides/substitute-evidence/", "/guides/read-pension-file/", "/guides/records-by-state/", "/guides/bounty-land-warrants/", "/guides/census-bridge/", "/guides/patriotic-service/", "/guides/same-name/", "/guides/patriot-or-loyalist/", "/guides/application-problems/", "/tools/widow-pension-checker/", "/tools/lineage-matrix/"]) {
  const h = readFileSync(join(DIST, gp, "index.html"), "utf8"); const d = (h.match(/<details class="defs"[\s\S]*?<\/details>/) || [""])[0];
  if (!d || h.indexOf(d) > h.indexOf("</h1>") + 6 || !glossTerms.every((k) => d.includes(`<strong>${k}</strong>`)) || !/<sup><a href="#src-/.test(d) || !d.includes('href="/#glossary"')) defsBad.push(gp); }
check("Definitions box (DAR, SAR, NSCDA, lineage society, patriot, bounty land, Stat.) right under the title on all 10 guides and both tools, sourced", defsBad.length === 0, defsBad.join(" "));
{ // Audit 3 #7: plain terms
  const homeHtml = readFileSync(join(DIST, "index.html"), "utf8"); const mainTxt = homeHtml.slice(homeHtml.indexOf("<main")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const firstP = mainTxt.search(/patriot/i);
  check("Audit 3 #7: 'patriot' is glossed in plain words, with a source, at its first use on the home page's first screen", firstP > 0 && /A patriot here means someone who supported the cause of American independence/.test(mainTxt.slice(firstP, firstP + 260)) && /sar-about-patriots|#src-/.test(homeHtml.slice(homeHtml.indexOf("A <strong>patriot</strong> here"), homeHtml.indexOf("A <strong>patriot</strong> here") + 600)), mainTxt.slice(firstP - 40, firstP + 200));
  const toolTerms = ["/tools/widow-pension-checker/", "/tools/lineage-matrix/"].map((tp) => { const h = readFileSync(join(DIST, tp, "index.html"), "utf8"); const i = h.indexOf('class="card box-tool-terms"'); const j = h.indexOf("data-tool="); const box = i > 0 ? h.slice(i, h.indexOf("</aside>", i)) : "";
    return i > 0 && i < j && /<strong>society<\/strong>/.test(box) && /<strong>registrar<\/strong>/.test(box) && (box.match(/<sup>/g) || []).length >= 2 && box.includes('href="/#glossary"'); });
  check("Audit 3 #7: both tools explain 'society' and 'registrar' in plain, sourced words just above the tool", toolTerms.every(Boolean), JSON.stringify(toolTerms));
  check("Audit 3 #7: the glossary defines Society and Registrar, each sourced", ["Society:", "Registrar:"].every((k) => gloss.includes(k)) && /chapter registrar/.test(gloss));
}
check("Both reports link to the definitions", ["/tools/widow-pension-checker/report/", "/tools/lineage-matrix/report/"].every((p) => readFileSync(join(DIST, p, "index.html"), "utf8").includes('href="/#glossary"')));
const plainTerms = ["/tools/widow-pension-checker/", "/guides/bounty-land-warrants/"].every((p) => { const h = readFileSync(join(DIST, p, "index.html"), "utf8").replace(/<details[\s\S]*?<\/details>/, ""); return /free land in the public domain/.test(h); })
  && /Statutes at Large/.test(readFileSync(join(DIST, "tools/widow-pension-checker/index.html"), "utf8").replace(/<details[\s\S]*?<\/details>/, ""));
check("Plain terms: the widow checker page and the bounty-land guide explain 'Stat.' and 'bounty land' in the text too", plainTerms);
check("No doubled source markers like [1][1] on any page", htmlFiles.every((f) => !/(<sup><a href="#src-(\d+)"[^>]*>\[\d+\]<\/a><\/sup>)<sup><a href="#src-\2"/.test(readFileSync(f, "utf8"))));
const guidePaths = ["/guides/lineage-proof-roadmap/", "/guides/substitute-evidence/", "/guides/read-pension-file/", "/guides/records-by-state/", "/guides/bounty-land-warrants/", "/guides/census-bridge/", "/guides/patriotic-service/", "/guides/same-name/", "/guides/patriot-or-loyalist/", "/guides/application-problems/"];
const guideBad = [];
for (const gp of guidePaths) { const h = readFileSync(join(DIST, gp, "index.html"), "utf8");
  if (!/<h2 id="what-to-do-next">/.test(h) || !h.includes('href="/tools/lineage-matrix/"') || !h.includes('href="/tools/widow-pension-checker/"') || !h.includes("chapter-locator") || !/class="next-guide"/.test(h)) guideBad.push(gp); }
check("Guides: all 10 end with 'What to do next' (both tools, chapter finder) and a next-guide link", guideBad.length === 0, guideBad.join(" "));
const toolGuideLinks = ["/tools/widow-pension-checker/", "/tools/lineage-matrix/"].every((p) => /href="\/guides\/[a-z-]+\/"/.test(readFileSync(join(DIST, p, "index.html"), "utf8")));
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
  "/tools/widow-pension-checker/", "/tools/lineage-matrix/", "/tools/widow-pension-checker/report/", "/tools/lineage-matrix/report/", "/about/", "/privacy/", "/contact/", "/sources/"];
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
await np.goto(`${BASE}/tools/widow-pension-checker/`); await np.click("[data-load-example]");
const wInfo = await np.evaluate(() => { const t = document.querySelector("table.widow"); const tr = t.querySelector("tbody tr"); const td = tr.querySelector("td");
  return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, tw: t.getBoundingClientRect().width, td: getComputedStyle(td).display, thead: getComputedStyle(t.querySelector("thead")).display, label: getComputedStyle(td, "::before").content }; });
check("Mobile 360px (regression): widow-act table shows stacked cards, no horizontal overflow", wInfo.sw <= wInfo.iw + 1 && wInfo.tw <= wInfo.iw && wInfo.td === "block" && wInfo.thead === "none" && /Pension law/.test(wInfo.label), JSON.stringify(wInfo));
await np.screenshot({ path: join(SHOTS, "m360-widow-cards.png"), fullPage: false }); await np.evaluate(() => document.querySelector("table.widow").scrollIntoView()); await np.screenshot({ path: join(SHOTS, "m360-widow-cards.png") });
await np.goto(`${BASE}/tools/widow-pension-checker/report/`);
const rInfo = await np.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, td: getComputedStyle(document.querySelector("table.widow td")).display }));
check("Mobile 360px (regression): checker report's widow table also stacks, no overflow", rInfo.sw <= rInfo.iw + 1 && rInfo.td === "block", JSON.stringify(rInfo));
// A phone browser widens its layout viewport when anything is wider than the screen, so also require innerWidth === 360.
const npages = ["/", "/tools/lineage-matrix/", "/tools/lineage-matrix/report/", "/tools/widow-pension-checker/", "/tools/widow-pension-checker/report/"]; const nOver = [];
for (const p of npages) { await np.goto(BASE + p); if (p === "/tools/lineage-matrix/" || p === "/tools/widow-pension-checker/") await np.click("[data-load-example]");
  const o = await np.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, out: [...document.querySelectorAll("body *")].filter((e) => !e.closest(".table-wrap:not(:has(table.widow)):not(:has(table.records))") && e.getBoundingClientRect().right > 361).length }));
  if (o.sw > 360 || o.iw !== 360 || o.out) nOver.push(`${p} sw=${o.sw} iw=${o.iw} out=${o.out}`); }
check("True 360px (audit 2): home, worksheet (example loaded), its report, widow checker (example loaded) and its report fit 360px with nothing off-screen", nOver.length === 0, nOver.join(", "));
const recCards = await (async () => { await np.goto(`${BASE}/tools/lineage-matrix/report/`); return np.evaluate(() => { const t = document.querySelector("table.records"); return t ? getComputedStyle(t.querySelector("td")).display + "|" + getComputedStyle(t.querySelector("thead")).display : "none"; }); })();
check("True 360px (audit 2): the worksheet report's records table stacks into cards", recCards === "block|none", recCards);
await np.goto(`${BASE}/tools/lineage-matrix/`); await np.evaluate(() => document.querySelector("#tb-patriot").scrollIntoView()); await np.screenshot({ path: join(SHOTS, "m360-patriot.png") });
await narrow.close();
check("Mobile: tool buttons are at least 44px tall", tapTargets === 0, `${tapTargets} small`);
for (const [p, name] of [["/", "m-home"], ["/guides/substitute-evidence/", "m-guide-table"], ["/tools/widow-pension-checker/", "m-widow"], ["/tools/lineage-matrix/", "m-tool-b"]]) {
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
writeFileSync(join(ROOT, "qa/e2e-results.json"), JSON.stringify({ ranAt: new Date().toString(), browser: `${CHROME || "playwright Chromium"} (headless) via playwright-core ${require("playwright-core/package.json").version}`, passed, total: results.length, exampleReportPages: globalThis.__reportPages || null, results, requestsTotal: requests.length, externalRequests: external.length, interactionRequests: duringInteraction.length, faviconLate }, null, 2));
console.log(`\nE2E: ${passed}/${results.length} checks passed.`);
process.exit(passed === results.length ? 0 : 1);
