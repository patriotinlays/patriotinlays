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
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".xml": "application/xml", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png" };
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
// Nov 5: dates are memorable-date fields (Month / Day / Year / How sure). fillDate types a stored-format value into them.
const fillDate = async (pg, id, v) => { const m = /^([~<>])?(\d{4})?(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(v || "") || [];
  await pg.selectOption(`#${id}-month`, m[3] ? String(+m[3]) : ""); await pg.fill(`#${id}-day`, m[4] ? String(+m[4]) : ""); await pg.fill(`#${id}-year`, m[2] || "");
  await pg.selectOption(`#${id}-cert`, { "~": "about", "<": "before", ">": "after" }[m[1]] || "exact"); };

// ---- Audit 2 #1: a fresh first visit starts empty; results only after the button; prefill never auto-runs; Start over ----
{ const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const fp = await fresh.newPage();
  fp.on("pageerror", (e) => consoleErrors.push(`fresh: ${e.message}`));
  const formState = () => fp.evaluate(() => ({ vals: [...document.querySelectorAll("form[data-form=widow] input, form[data-form=widow] select:not([data-part=cert])")].map((i) => i.type === "checkbox" ? i.checked : i.value),
    rows: document.querySelectorAll("[data-out=widow] tbody tr").length, ls: Object.keys(localStorage), named: Object.fromEntries(new FormData(document.querySelector("form[data-form=widow]"))), plan: (document.querySelector('[data-tool="widow"] [data-plan] [data-plan-wait]')?.textContent || "") + (document.querySelector('[data-tool="widow"] [data-plan] .plan-title') ? " PLAN-SHOWN" : ""),
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
  check("Prefill from the worksheet fills his service end but does not run the check", f.named.serviceEnd === "1779-10" && f.named.marriage === "" && f.named.serviceMonths === "" && f.rows === 0, JSON.stringify(f));
  await fp.click('form[data-form=widow] button[type=submit]'); const afterPress = (await formState()).rows;
  await fp.click("[data-start-over]"); f = await formState();
  check("Start over: empties the form, deletes this checker's saved data only, and says so", afterPress === 7 && f.vals.every((v) => v === "" || v === false) && !f.ls.some((k) => k.startsWith("pi.toolA.")) && f.ls.includes("pi.toolB.v1") && /Started over: deleted 1 saved item from this browser/.test(await fp.textContent("[data-out=widow]")) && !f.saved, JSON.stringify(f));
  await fresh.close(); }

// ---- Widow Pension Law Checker (leads the site) ----
phase("load"); await page.goto(`${BASE}/tools/widow-pension-checker/`); await page.evaluate(() => localStorage.setItem("other.app.key", "keep-me"));
phase("interact");
const intro = await page.textContent("main");
check("Widow checker page: the intro answers the 7 questions (what, who, problem, how, what you get, limits, next) and mentions pension files", ["What it is.", "Who it helps.", "The problem it solves.", "How to use it.", "What you'll get.", "Its limits.", "What to do next."].every((k) => intro.includes(k)) && /pension file/i.test(intro));
check("Widow checker page: the standalone service-date form is gone", (await page.$$("form[data-form=window], #ta-start")).length === 0);
const howA = await page.textContent('[data-tool="widow"] .howto');
check("Widow checker: 'How this works' says it doesn't search records and nothing leaves the device", /does not search any records/.test(howA) && /Nothing you type leaves your device/.test(howA), howA.slice(0, 160));
check("Widow checker: before any check, 'What to do next' shows only a labelled placeholder, not a generic plan (audit 3)", /appear here after you press/.test(await page.textContent('[data-tool="widow"] [data-plan]')) && (await page.$$('[data-tool="widow"] [data-plan] .plan-steps')).length === 0);
await fillDate(page, "tw-m", "1780-05-01"); await fillDate(page, "tw-e", "1781-10-19"); await page.fill("#tw-mo", "24"); await page.fill("#tw-d", "730"); await page.click('form[data-form=widow] button[type=submit]');
let txt = await page.textContent('[data-out=widow]');
check("Widow checker: table shows 1836 note about 1832 service categories", /1832/.test(txt) && /Continental Line/.test(txt), "");
const rows = await page.$$eval('[data-out=widow] tbody tr', (trs) => trs.map((tr) => [tr.cells[0].textContent, tr.cells[1].textContent]));
const r1853 = rows.find((r) => r[0].includes("1853")); const r1855 = rows.find((r) => r[0].includes("February 28, 1855"));
check("Widow checker (Nov 5, statute text): a 1780 marriage rules out the 1853 and Feb-1855 acts by the dates (they covered marriages after January 1800)", r1853?.[1].includes("Ruled out by the dates") && r1855?.[1].includes("Ruled out by the dates") && /January 1800/.test(r1853?.[1]), `${r1853?.[1].slice(0, 30)} | ${r1855?.[1].slice(0, 30)}`);
const next1853 = await page.$$eval('[data-out=widow] tbody tr', (trs) => trs.find((tr) => tr.cells[0].textContent.includes("1853")).cells[2].textContent);
check("Widow checker: the ruled-out 1853 row gives the rule from the law's text and says no action is needed", /Revolutionary army, married after January 1800/.test(next1853) && /No action needed/.test(next1853), next1853.slice(0, 80));
await fillDate(page, "tw-m", "1790"); await fillDate(page, "tw-e", "1779-10"); await page.fill("#tw-mo", "20"); await page.fill("#tw-d", ""); await page.click('form[data-form=widow] button[type=submit]');
const r1836 = await page.$$eval('[data-out=widow] tbody tr', (trs) => trs.find((tr) => tr.cells[0].textContent.includes("1836")).cells[1].textContent);
check("Widow checker (audit 2): 1836 'Ruled out by the dates' says why: married 1790, service ended 1779-10, and the rule", /Ruled out by the dates/.test(r1836) && /1790/.test(r1836) && /1779-10/.test(r1836) && /marriage came after his service ended/.test(r1836), r1836.slice(0, 160));
await fillDate(page, "tw-m", "1790"); await fillDate(page, "tw-e", "1779"); await page.fill("#tw-mo", ""); await page.fill("#tw-d", ""); await page.selectOption("#tw-b", ""); await page.click('form[data-form=widow] button[type=submit]');
const a3 = await page.evaluate(() => ({ r: [...document.querySelectorAll("[data-out=widow] tbody tr")].find((tr) => tr.cells[0].textContent.includes("1836")).cells[1].textContent, ans: document.querySelector("[data-answer]")?.textContent || "" }));
check("Widow checker (audit 3 #1): married 1790, service ended 1779, no months typed -> 1836 'Ruled out by the dates' with the plain reason", /Ruled out by the dates/.test(a3.r) && !/Still possible/.test(a3.r) && /marriage came after his service ended/.test(a3.r) && /Ruled out: the 1836, 1853 and February 1855 laws \(by the dates\)/.test(a3.ans), a3.r.slice(0, 120));
// ---- Dates only (Tim): every conclusion the dates support, open laws labelled with what they need, one question asked ----
{ const d = await page.evaluate(() => { const rows = [...document.querySelectorAll("[data-out=widow] tbody tr")].map((tr) => [tr.cells[0].textContent, tr.cells[1].querySelector(".badge").textContent]);
    const ask = document.querySelector("[data-out=widow] [data-ask]"); return { rows, ask: ask?.textContent || "", key: ask?.dataset.ask, href: ask?.querySelector("a")?.getAttribute("href") }; });
  const v = (y) => d.rows.find((r) => r[0].includes(y))?.[1] || "";
  check("Widow checker, dates only (audit 4): 'Ruled out by the dates' (1836); 1838 and 1848 'Still possible' because their own text also needs his service; 1855 bounty-land and 1878 'Still possible: need …'; 1853 and Feb 1855 ruled out by a 1790 marriage; nothing 'Fits'",
    v("1836") === "Ruled out by the dates" && v("1838") === "Still possible: need whether he served 6 months or more, and his kind of service" && v("1848") === "Still possible: need his kind of service" && v("Bounty-land act").startsWith("Still possible: need how many days he served, or whether he was in a battle") && v("1878").startsWith("Still possible") && v("February 3, 1853") === "Ruled out by the dates" && v("February 28, 1855") === "Ruled out by the dates"
    && d.rows.filter((r) => /^Fits/.test(r[1])).length === 0, JSON.stringify(d.rows.map((r) => r[1])));
  const out1836 = await page.$$eval("[data-out=widow] tbody tr", (trs) => trs.find((tr) => tr.cells[0].textContent.includes("1836")).cells[2].textContent);
  check("Widow checker (audit 4 #3): the ruled-out 1836 row says no action is needed and no longer says 'find out what kind of unit'", /No action needed for this law/.test(out1836) && !/find out/i.test(out1836), out1836.slice(0, 160));
  await page.click("[data-out=widow] [data-ask-link]");
  check("Widow checker, dates only: asks the one question that settles the most (his kind of service) and its link, named for the box, goes to that box", d.key === "kind" && d.href === "#tw-k" && /What kind of service was it\?/.test(d.ask) && (await page.evaluate(() => document.activeElement?.id)) === "tw-k", d.ask);
  await page.selectOption("#tw-k", "militia"); await page.click('form[data-form=widow] button[type=submit]');
  const sp = await page.evaluate(() => { const a = document.querySelector("[data-out=widow] [data-ask]"); return { key: a?.dataset.ask, links: [...(a?.querySelectorAll("[data-ask-link]") || [])].map((x) => [x.getAttribute("href"), x.textContent]) }; });
  check("Widow checker (audit 4 #4): '14 days or a battle' is two separate questions, each linked by the box's own name", sp.key === "days" && JSON.stringify(sp.links) === JSON.stringify([["#tw-d", 'Go to "Total days of service"'], ["#tw-b", 'Go to "Was he in at least one battle?"']]), JSON.stringify(sp));
  await page.click('[data-out=widow] [data-ask-link="tw-b"]'); check("Widow checker: the battle link focuses the battle box", (await page.evaluate(() => document.activeElement?.id)) === "tw-b");
  await page.fill("#tw-d", "30"); await page.click('form[data-form=widow] button[type=submit]');
  const after = await page.$$eval("[data-out=widow] tbody tr", (trs) => trs.map((tr) => [tr.cells[1].querySelector(".badge").textContent, !!tr.querySelector("[data-unchecked]")]));
  check("Widow checker: answering (militia, 30 days) settles 1848, 1855 bounty-land and 1878 as 'Fits the rules checked here; other terms not checked', each listing what isn't checked; never a plain 'Fits'",
    after.filter(([t]) => t === "Fits the rules checked here; other terms not checked").length === 3 && after.every(([t, u]) => !/^Fits/.test(t) || (t === "Fits the rules checked here; other terms not checked" && u)), JSON.stringify(after));
  await page.selectOption("#tw-k", "");
  await page.fill("#tw-d", "");
}
check("Widow checker: each field shows a 'Why it matters' line", (await page.$$eval("form[data-form=widow] [data-why]", (ps) => ps.filter((p) => p.textContent.startsWith("Why it matters")).length)) === 6);
await page.click('[data-tool="widow"] [data-load-example]');
const exD = await page.textContent('[data-out=widow]');
const planA = await page.textContent('[data-tool="widow"] [data-plan]');
check("Widow checker: example plan -> look for the widow's pension file, registrar (DAR Chapter Locator), start application", /Look for the widow's pension file/.test(planA) && /Contact a local chapter's registrar/.test(planA) && /Start the application/.test(planA)
  && (await page.$$('[data-tool="widow"] [data-plan] a[href="https://www.dar.org/discover/become-member/chapter-locator"]')).length === 1, planA.slice(0, 80));
check("Widow checker (Nov 5): every law is now read from its own text, so the example plan has no 'Can't check here' step", !/Can't check here/.test(planA));
await page.evaluate(() => { window.__printed = 0; window.__planOnly = null; window.print = () => { window.__printed++; window.__planOnly = document.body.classList.contains("print-plan"); }; });
await page.click('[data-tool="widow"] [data-print-plan]');
check("Widow checker: 'Print or save this plan' prints in plan-only mode", (await page.evaluate(() => window.__printed === 1 && window.__planOnly === true)));
check("Widow checker: no 'Not evaluated' wording anywhere on the page", !/not evaluated/i.test(await page.textContent("main")));
check("Widow checker: 'Load an example' shows results at once", /Fits the rules checked here; other terms not checked/.test(exD) && /Not checked here \(from the law's own text\)/.test(exD), exD.slice(0, 60));
const ans = await page.evaluate(() => { const a = document.querySelector("[data-out=widow] [data-answer]"); const t = document.querySelector("[data-out=widow] table.widow");
  return a && t ? { text: a.textContent, lines: [...a.querySelectorAll("li[data-line]")].map((l) => l.dataset.line), above: !!(a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) } : null; });
check("Widow checker (iPhone fix): 'In short' sits above the table as short lines: Fits / Ruled out / Still possible / Next", ans?.above && ans.lines.join("|") === "Fits|Ruled out|Still possible|Next" && /Fits: the March 1855 bounty-land and 1878 laws/.test(ans.text) && /Ruled out: the 1838, 1853 and February 1855 laws \(by the dates\)/.test(ans.text) && /Still possible: the 1836 and 1848 laws \(need his kind of service\)/.test(ans.text) && /Next: .*look for the widow's pension file/.test(ans.text), ans?.text);
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
// Audit 4 proposal #2: a first visit shows the purpose line, a Start button and the "Don't know his name yet?" checklist;
// the steps (and the generation cards) stay hidden until the visitor starts.
{ const st = await page.evaluate(() => ({ purpose: document.querySelector("[data-purpose]")?.textContent || "", start: !!document.querySelector("[data-ws-start]") && !document.querySelector("[data-ws-start]").hidden,
    bodyHidden: document.querySelector("[data-ws-body]")?.hidden, genVisible: [...document.querySelectorAll("section.gen")].some((g) => g.offsetParent !== null),
    list: [...document.querySelectorAll("[data-ws-start] [data-name-check]")].length, step0: !!document.querySelector('[data-ws-start] a[href="/guides/lineage-proof-roadmap/#step-0-find-the-soldier-s-name"]'), ls: Object.keys(localStorage).filter((k) => k.startsWith("pi.toolB")) }));
  check("Worksheet (audit 4 proposal): a first visit opens with the purpose line and a Start button; the generation cards stay hidden; nothing is saved yet", /What it's for/.test(st.purpose) && st.start && st.bodyHidden === true && !st.genVisible && st.ls.length === 0, JSON.stringify(st));
  check("Worksheet (audit 4 proposal): the start screen has the inline 'Don't know his name yet?' checklist (4 items) plus the Step 0 link", st.list === 4 && st.step0 && /Don't know his name yet\?/.test(await page.textContent("[data-ws-start]")), JSON.stringify(st));
  await page.check('[data-ws-start] [data-name-check="known"]');
  await page.click("[data-ws-begin]");
  const after = await page.evaluate(() => ({ startHidden: document.querySelector("[data-ws-start]").hidden, bodyHidden: document.querySelector("[data-ws-body]").hidden, focus: document.activeElement?.id, saved: !!localStorage.getItem("pi.toolB.v1"), tick: JSON.parse(localStorage.getItem("pi.toolB.nameChecklist") || "{}").known, patBox: document.querySelector('[data-patriot-form] details[data-name-box] [data-name-check="known"]')?.checked }));
  check("Worksheet (audit 4 proposal): 'Start my worksheet' opens the steps at the patriot step, saves a blank worksheet, and keeps the checklist tick (also shown in the patriot step)", after.startHidden && !after.bodyHidden && after.focus === "tb-patriot" && after.saved && after.tick === true && after.patBox === true, JSON.stringify(after));
  phase("load"); await page.reload(); phase("interact");
  check("Worksheet (audit 4 proposal): once started, a reload goes straight to the steps", !(await page.isVisible("[data-ws-begin]")) && await page.isVisible("#pat-name")); }
check("Worksheet: step 1 is the patriot step", /The patriot/.test(await page.textContent("#tb-patriot")) && (await page.$$("[data-patriot-form] #pat-kind option")).length >= 9);
await page.fill("#pat-name", "Test Patriot"); await page.selectOption("#pat-state", "NC"); await page.selectOption("#pat-kind", "continental"); await fillDate(page, "pat-start", "1776-02"); await fillDate(page, "pat-end", "1779-06");
txt = await page.textContent("[data-patriot-check]");
check("Patriot step: dates checked against DAR's period for that type of service (not a ruling), linking the widow checker", /Dates fit DAR's period/.test(txt) && /not a ruling/.test(txt) && (await page.$$('[data-patriot-check] a[href="/tools/widow-pension-checker/?from=worksheet"]')).length === 1, txt.slice(0, 120));
await fillDate(page, "pat-start", "1785"); await fillDate(page, "pat-end", "");
check("Patriot step: dates outside the period are flagged", /outside|does not fit|not inside/i.test(await page.textContent("[data-patriot-check]")), (await page.textContent("[data-patriot-check]")).slice(0, 100));
await fillDate(page, "pat-start", "1776-02"); await fillDate(page, "pat-end", "1779-06");
const planP = await page.textContent('[data-tool="lineage-matrix"] [data-plan]');
check("Patriot step drives the plan: prove his service (North Carolina troop returns, M881), then the widow-pension step", /Prove the patriot's service/.test(planP) && /North Carolina/.test(planP) && /M881/.test(planP) && /widow-pension laws/.test(planP), planP.slice(0, 160));
phase("load"); await page.goto(`${BASE}/tools/widow-pension-checker/?from=worksheet`); phase("interact");
check("Widow checker auto-fills his service end from the worksheet patriot", (await page.inputValue("#tw-e-value")) === "1779-06" && /Test Patriot/.test(await page.textContent("[data-worksheet-msg]")), await page.textContent("[data-worksheet-msg]"));
{ // Nov 5: memorable-date fields on a real page
  const f = await page.evaluate(() => { const g = (id) => document.getElementById(id); const fs = g("tw-m");
    return { legend: fs?.querySelector("legend")?.textContent, months: [...g("tw-m-month").options].map((o) => o.textContent), first: g("tw-m-month").value, day: [g("tw-m-day").inputMode, g("tw-m-day").maxLength], year: [g("tw-m-year").inputMode, g("tw-m-year").maxLength],
      off: ["tw-m-day", "tw-m-year", "tw-m-month", "tw-m-cert"].every((id) => g(id).getAttribute("autocomplete") === "off" && g(id).getAttribute("autocorrect") === "off" && g(id).getAttribute("autocapitalize") === "off"), certs: [...g("tw-m-cert").options].map((o) => o.textContent),
      noPicker: !document.querySelector('form[data-form=widow] input[type=date], form[data-form=widow] input[type=month]') }; });
  check("Dates (Nov 5): fieldset + legend; Month list starts at \"Don't know\"; Day 2 and Year 4 digits on the number pad; Exactly/About/Before/After; autocomplete, autocorrect, autocapitalize off; no picker", f.legend === "When did the couple marry?" && f.months[0] === "Don't know" && f.months.length === 13 && f.first === "" && f.day.join() === "numeric,2" && f.year.join() === "numeric,4" && f.off && f.certs.join() === "Exactly,About,Before,After" && f.noPicker, JSON.stringify(f));
  await fillDate(page, "tw-m", "~1780-05-04"); const about = await page.textContent("#tw-m [data-range]");
  check("Dates (Nov 5): 'About May 1780' shows its range in words, says the day is ignored, and says 'About' is the site's rule of thumb", /About May 1780 is treated as November 1, 1779 to November 30, 1780\./.test(about) && /the day is ignored/.test(about) && /'About' is this site's rule of thumb, not part of the law\./.test(about) && (await page.inputValue("#tw-m-value")) === "~1780-05", about);
  await fillDate(page, "tw-m", "1780-02-30"); await page.click('form[data-form=widow] button[type=submit]');
  check("Dates (Nov 5): an impossible day (February 30) gets a plain message and no results table", /February 1780 has no day 30/.test(await page.textContent("[data-out=widow]")) && (await page.$$("[data-out=widow] tbody tr")).length === 0, await page.textContent("[data-out=widow]"));
  await fillDate(page, "tw-m", ""); }
await page.click("[data-clear=toolA]");
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
// ---- Audit 4 #1: date sanity (patriot born 1850 with 1777–79 service) ----
await page.evaluate(() => localStorage.setItem("pi.toolB.v1", JSON.stringify({ generations: [{ gen: 1, who: "", living: true, born: "1950", died: "", state: "VA", cells: [] }, { gen: 2, who: "", living: false, born: "1920", died: "", state: "VA", cells: [] }, { gen: 3, who: "", living: false, born: "1890", died: "", state: "VA", cells: [] }, { gen: 4, who: "", living: false, born: "1850", died: "", state: "VA", cells: [] }],
  patriot: { name: "Test", state: "VA", kind: "militia", start: "1777", end: "1779", gen: "4" } })));
phase("load"); await page.reload(); phase("interact");
{ const ds = await page.evaluate(() => ({ check: document.querySelector("[data-patriot-check]")?.textContent || "", plan: document.querySelector('[data-tool="lineage-matrix"] [data-plan] [data-date-warnings]')?.textContent || "", first: document.querySelector('[data-tool="lineage-matrix"] [data-plan] .plan-steps > li .plan-title')?.textContent }));
  check("Worksheet (audit 4 #1): a patriot born 1850 with 1777–79 service gets 'His dates don't add up', not 'Dates fit', and the plan opens with 'Check these dates first'", /His dates don't add up/.test(ds.check) && /wasn't born yet/.test(ds.check) && !/Dates fit/.test(ds.check) && ds.first === "Check these dates first" && /wasn't born yet/.test(ds.plan), JSON.stringify(ds).slice(0, 240));
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/report/`); phase("interact");
  const rs = await page.textContent("[data-report]");
  check("Report (audit 4 #1): the summary says his birth year and service don't add up, and never 'dates fit'", /don't add up/.test(rs) && !/dates fit/i.test(rs) && /Check these dates first/.test(rs), rs.slice(0, 200));
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact"); }
await page.evaluate(() => localStorage.removeItem("pi.toolB.v1")); phase("load"); await page.reload(); phase("interact");
await page.click("[data-ws-begin]");

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
const gapItems = await page.$$eval("[data-gaps] .gap-items > li", (lis) => lis.map((li) => ({ ref: li.querySelector("[data-where-ref]")?.dataset.whereRef || "", text: li.textContent })));
const wsIndex = await page.evaluate(() => { const bs = [...document.querySelectorAll("[data-gaps] [data-where-block]")]; return { letters: bs.map((b) => b.dataset.whereBlock), texts: bs.map((b) => b.querySelector("p").textContent.replace(/^[A-Z]+\. /, "")), intro: document.querySelector("[data-gaps] [data-where-index]")?.textContent || "", full: document.querySelectorAll("main .where").length,
  planRefs: [...document.querySelectorAll('[data-tool="lineage-matrix"] [data-plan] [data-where-ref] a')].map((a) => a.getAttribute("href").slice(7)), longForm: (document.querySelector("main").textContent.match(/Look for a long-form birth certificate \(the kind that names the parents\)/g) || []).length }; });
check("Tool B: every listed gap points to lettered 'Where to look' advice on the page (and the index says to ask the registrar)", gapItems.length > 0 && gapItems.every((g) => g.ref && g.ref.split(",").every((L) => wsIndex.letters.includes(L)) && /Where to look/.test(g.text)) && /registrar/.test(wsIndex.intro), `${gapItems.length} gaps`);
check("Worksheet page (lettered 'Where to look'): each block appears once in full, the list and the plan point to it by letter, and the general advice is no longer repeated", wsIndex.letters.length > 0 && new Set(wsIndex.texts).size === wsIndex.texts.length && wsIndex.full === 0 && wsIndex.planRefs.length > 0 && wsIndex.planRefs.every((L) => wsIndex.letters.includes(L)) && wsIndex.longForm <= 1, JSON.stringify({ blocks: wsIndex.letters.length, planRefs: wsIndex.planRefs.length, longForm: wsIndex.longForm }));
const whereHrefs = await page.$$eval("[data-gaps] [data-where-block] a", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
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
check("Tool B: saved under pi.toolB.* only (the worksheet in pi.toolB.v1, plus pi.toolB.nameChecklist once a name-checklist box is ticked)", Object.keys(store).filter((k) => k.startsWith("pi.toolB")).sort().join(",") === "pi.toolB.nameChecklist,pi.toolB.v1" && Object.keys(store).filter((k) => k.startsWith("pi.") && !k.startsWith("pi.toolA") && !k.startsWith("pi.toolB")).length === 0, Object.keys(store).join(","));
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
await page.click('[data-tool="lineage-matrix"] [data-load-example]');
const planB = await page.textContent('[data-tool="lineage-matrix"] [data-plan]');
const orderItems = await page.$$eval('[data-tool="lineage-matrix"] [data-plan] .plan-steps > li', (lis) => { const li = lis.find((l) => l.querySelector(".plan-title").textContent === "Records to find or fix, generation by generation"); return li ? [...li.querySelectorAll(".plan-sub > li")].map((x) => !!x.querySelector("[data-where-ref] a")) : []; });
const planGens = await page.$$eval('[data-tool="lineage-matrix"] [data-plan] .plan-group', (x) => x.map((e) => e.textContent));
check("Tool B (regression): action plan groups each generation once, in order", planGens.length >= 2 && new Set(planGens).size === planGens.length && planGens.every((g, i) => i === 0 || +g.match(/\d+/)[0] > +planGens[i - 1].match(/\d+/)[0]), planGens.join(" | "));
check("Tool B: action plan lists each missing record with a Where-to-look link, then registrar and application steps", orderItems.length >= 3 && orderItems.every(Boolean) && /Contact a local chapter's registrar/.test(planB) && /Start the application/.test(planB), `${orderItems.length} items`);
check("Tool B: 'Load an example' fills a made-up patriot and family and shows gaps with where to look", (await page.$$("section.gen")).length === 5 && (await page.inputValue("#pat-name")).length > 0 && (await page.$$("[data-gaps] [data-where-block] a[href*='archives.gov']")).length > 0);
{ const nn = await page.evaluate(() => { const p = document.querySelector("[data-patriot] [data-no-name]"); return p ? { text: p.textContent, href: p.querySelector("a")?.getAttribute("href") } : null; });
  const road = readFileSync(join(DIST, "guides/lineage-proof-roadmap/index.html"), "utf8");
  check("Worksheet patriot step: 'Don't know his name yet?' links in plain words to Roadmap Step 0", nn && /^Don't know his name yet\?/.test(nn.text) && nn.href === "/guides/lineage-proof-roadmap/#step-0-find-the-soldier-s-name" && road.includes('id="step-0-find-the-soldier-s-name"'), JSON.stringify(nn)); }
const notes = await page.$$eval("[data-gaps] [data-where-block] p:first-child", (ns) => ns.map((n) => n.textContent));
check("Where to look is tailored: Virginia's 1853-1896 birth registers and the censuses in each lifetime appear", notes.some((n) => /1853 to 1896/.test(n)) && notes.some((n) => /Census: The 1850–1870 censuses/.test(n)), notes.slice(0, 2).join(" | ").slice(0, 160));
check("Where to look: the patriot's generation is labelled", /\(the patriot\)/.test(await page.textContent("[data-gaps]")));
const noteHrefs = await page.$$eval("[data-gaps] [data-where-block] a", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
check("Where to look: state/era links (Library of Virginia, Pennsylvania) are Source Manifest sources", noteHrefs.includes("https://lva-virginia.libguides.com/bmd") && noteHrefs.some((h) => h.startsWith("https://www.pa.gov/")) && noteHrefs.every((h) => mUrls.has(h) || /^\/guides\/[a-z-]+\/$/.test(h)), noteHrefs.join(" "));
// ---- Beginner changes: the example report (one-page summary, "Where to look" once, Save as PDF, page count) ----
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/report/`); phase("interact");
const rep = await page.evaluate(() => { const r = document.querySelector("[data-report]");
  const blocks = [...r.querySelectorAll("[data-where-block]")]; const texts = blocks.map((b) => b.querySelector("p").textContent.replace(/^[A-Z]+\. /, ""));
  const refs = [...r.querySelectorAll("[data-where-ref] a")].map((a) => a.getAttribute("href").slice(7));
  return { first: r.firstElementChild?.dataset.summary !== undefined, h2: [...r.querySelectorAll("h2")].map((h) => h.textContent), blocks: texts.length, unique: new Set(texts).size, refs, letters: blocks.map((b) => b.dataset.whereBlock),
    fullWhere: r.querySelectorAll(".where").length, censusDup: texts.filter((t) => /^Censuses in their lifetime/.test(t)).length, save: !!document.querySelector("[data-save-pdf]") && document.querySelector("[data-save-pdf]").offsetParent !== null }; });
check("Report: opens with a one-page summary (patriot, where you are, what to do next) before 'Where to look' and the records", rep.first && rep.h2[0] === "Summary" && rep.h2[1] === "Where to look" && /The patriot: John \(made up\)/.test(await page.textContent("[data-summary]")), rep.h2.join(" | "));
{ const ns = await page.evaluate(() => { const r = document.querySelector("[data-report]"); return { uses: /NSCDA/.test(r.textContent), terms: r.querySelectorAll("[data-nscda-term]").length, text: r.querySelector("[data-nscda-term]")?.textContent || "" }; });
  check("Report (audit 4 #5): where advice cites NSCDA, the report explains it once (The National Society of the Colonial Dames of America)", ns.uses && ns.terms === 1 && /Colonial Dames of America/.test(ns.text), JSON.stringify(ns).slice(0, 200)); }
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
check("Report: the page-count claim names both print paths (Save as PDF and Ctrl+P) and matches headless Chrome's print-to-PDF of the example for each", claim.s === summaryPages && claim.f === fullPages && claim.t.includes(`takes ${summaryPages} Letter pages this way`) && claim.t.includes(`Ctrl+P`) && claim.t.includes(`every record as well: ${fullPages} pages for the example`) && summaryPages <= 2 && fullPages <= 3, `summary ${summaryPages}, full ${fullPages}; claim ${claim.s}/${claim.f}`);
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
  const ohio = await page.evaluate(() => ({ full: (document.querySelector("main").textContent.match(/no verified source yet on when Ohio began/g) || []).length,
    refs: [...document.querySelectorAll("[data-gaps] [data-where-ref]")].length }));
  check("Audit 3 #5: the 'no verified source for Ohio' note appears in full once on the worksheet page; the gaps point to it by letter", ohio.full === 1 && ohio.refs >= 3, JSON.stringify(ohio));
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
  check("Audit 3 #3: a ticked 'Census entry' shows its kind and 'Needs details' in the report, and every counted entry is a row there", g3.doc === "census" && /Needs details/.test(g3.status) && census && /Census entry/.test(census[1]) && /Needs details/.test(census[4]) && rb.entries === rb.rows.length && !rb.rows.some((r) => /No Evidence Entered/.test(r[4])), JSON.stringify({ g3, census, entries: rb.entries, rows: rb.rows.length }));
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
const subst = await page.$$eval("[data-gaps] [data-where-block] a[data-substitute]", (as) => as.map((a) => [a.getAttribute("href"), a.closest(".where-block").textContent]));
check("Birth gap (audit 2): Virginia before 1853 says there was no statewide birth recording and links the substitute-evidence guide right there", subst.some(([h, t]) => h === "/guides/substitute-evidence/" && /no statewide recording of births before 1853/.test(t)), JSON.stringify(subst).slice(0, 160));
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("pi.toolB.v1")); s.patriot.gen = "1"; localStorage.setItem("pi.toolB.v1", JSON.stringify(s)); });
phase("load"); await page.reload(); phase("interact");
const heads = await page.$$eval("section.gen h3", (hs) => hs.map((h) => h.textContent));
check("Generation picker (audit 2): an old saved 'Generation 1' shows a plain warning and the oldest generation stays the patriot", await page.isVisible("[data-gen-warn]") && /Generation 1 is you/.test(await page.textContent("[data-gen-warn]")) && !/patriot/.test(heads[0]) && /\(the patriot\)/.test(heads.at(-1)), heads.join(" | "));
const txNote = await page.textContent("[data-gaps] [data-where-index]");
check("Where to look: a state with no verified source says so (no invented records)", /no verified source yet on when Texas/.test(txNote), txNote.slice(0, 120));
await page.click("[data-clear=toolB]");
store = await ls();
check("Tool B clear: removes pi.toolB.* only, keeps unrelated key", !Object.keys(store).some((k) => k.startsWith("pi.toolB")) && store["other.app.key"] === "keep-me", Object.keys(store).join(","));
// ---- Simpler worksheet: "What do you have?" checklist and plain relationship choices ----
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
await page.click("[data-ws-begin]");
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
check("Home (Nov 5): 'Ready to get started?' links to both tools and to the Roadmap guide", (await page.$$('main [data-get-started] a[href="/tools/lineage-matrix/"]')).length === 1 && (await page.$$('main [data-get-started] a[href="/tools/widow-pension-checker/"]')).length === 1 && (await page.$$('main [data-get-started] a[data-start-button][href="/guides/lineage-proof-roadmap/"]')).length === 1);
const homeOrder = await page.evaluate(() => [...document.querySelectorAll("main h2")].map((h) => h.id));
{ const hm = await page.evaluate(() => { const m = document.querySelector("main [data-mission]"); return { ps: m.querySelectorAll("p").length, lists: m.querySelectorAll("ul, ol").length, text: m.textContent, sub: document.querySelector("main [data-subtitle]")?.textContent || "",
    ai: document.querySelector("main [data-ai-line]")?.textContent.trim() || "", beforeStart: !!(m.compareDocumentPosition(document.querySelector("[data-get-started]")) & Node.DOCUMENT_POSITION_FOLLOWING), words: document.querySelector("main").innerText.split(/\s+/).length }; });
  globalThis.__home = hm;
  check("Home (Nov 5 lock): subtitle names DAR and SAR; mission in flowing paragraphs (no lists) ahead of 'Ready to get started?'; purpose line, both tool names, one-sentence privacy", /DAR/.test(hm.sub) && /SAR/.test(hm.sub) && hm.lists === 0 && hm.ps >= 6 && hm.beforeStart && homeOrder[0] === "get-started"
    && /organize the records that connect you to a Revolutionary War patriot/.test(hm.text) && /Widow Pension Law Checker/.test(hm.text) && /Lineage Evidence Matrix/.test(hm.text) && /what you type into the tools stays in your own browser\./.test(hm.text), JSON.stringify({ ...hm, text: hm.text.slice(0, 80) }));
  check("Home (Nov 5 lock): the exact AI line, the exact SAR line (sourced), no unsourced 'most people get stuck' / 'give up' / guarantee lines", hm.ai === "Written with AI assistance and reviewed by the site's owner. Each fact is tied to a quoted official source, and software checks that the quote is still there."
    && /SAR's local sponsor, often the chapter registrar, can guide you through the application\./.test(hm.text) && !/most people get stuck|give up|so that doesn't happen to you|make sure you walk/i.test(hm.text) && !/No person reviews/i.test(await page.textContent("main")), hm.ai); }
const firstLinks = await page.$$eval("main a", (as) => as.map((a) => a.getAttribute("href")).filter((h) => !h.startsWith("#src-")).slice(0, 3));
check("Home: the first links (after source notes) are the worksheet, the widow checker and the Roadmap guide", firstLinks[0] === "/tools/lineage-matrix/" && firstLinks[1] === "/tools/widow-pension-checker/" && firstLinks[2] === "/guides/lineage-proof-roadmap/", firstLinks.join(" "));
const navLinks = await page.$$eval("header.site nav a", (as) => as.map((a) => [a.getAttribute("href"), a.textContent]));
check("Navigation: 'Start here' (the Roadmap) comes first, then the widow-pension check", navLinks[0][0] === "/guides/lineage-proof-roadmap/" && navLinks[0][1] === "Start here" && navLinks[1][0] === "/tools/widow-pension-checker/", navLinks.map((x) => x[1]).join(" | "));
// The beginner's three clicks: the big button -> Roadmap, whose top has "How to join" and "Step 0"
phase("load"); await page.click("main [data-start-button]"); await page.waitForURL("**/guides/lineage-proof-roadmap/"); phase("interact");
const rmOrder = await page.evaluate(() => [...document.querySelectorAll("main h2")].slice(0, 3).map((h) => h.id));
check("Roadmap: opens with 'How to join, in short' and 'Step 0: find the soldier's name' before the rest", rmOrder[0] === "how-to-join-in-short" && rmOrder[1] === "step-0-find-the-soldier-s-name", rmOrder.join(","));
const joinItems = await page.$$eval("#how-to-join ol > li", (lis) => lis.map((li) => ({ t: li.textContent, sup: li.querySelectorAll("sup a").length })));
check("Roadmap: 'How to join, in short' has 4 sourced steps, the DAR chapter locator and the SAR contact finder", joinItems.length === 4 && joinItems.every((x) => x.sup > 0) && (await page.$$('#how-to-join a[href="https://www.dar.org/discover/become-member/chapter-locator"]')).length === 1 && (await page.$$('#how-to-join a[href="https://www.sar.org/find-your-contact/"]')).length === 1);
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
  const homeHtml = readFileSync(join(DIST, "index.html"), "utf8"); const mainTxt = homeHtml.slice(homeHtml.indexOf("</h1>", homeHtml.indexOf("<main"))).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const firstP = mainTxt.search(/patriot/i);
  check("Audit 3 #7: 'patriot' is glossed in plain words, with a source, at its first use on the home page's first screen (after the site name)", firstP > 0 && /A patriot here means someone who supported the cause of American independence/.test(mainTxt.slice(firstP, firstP + 260)) && /sar-about-patriots|#src-/.test(homeHtml.slice(homeHtml.indexOf("A <strong>patriot</strong> here"), homeHtml.indexOf("A <strong>patriot</strong> here") + 600)), mainTxt.slice(firstP - 40, firstP + 200));
  const toolTerms = ["/tools/widow-pension-checker/", "/tools/lineage-matrix/"].map((tp) => { const h = readFileSync(join(DIST, tp, "index.html"), "utf8"); const i = h.indexOf('class="card box-tool-terms"'); const j = h.indexOf("data-tool="); const box = i > 0 ? h.slice(i, h.indexOf("</aside>", i)) : "";
    return i > 0 && i < j && /<strong>society<\/strong>/.test(box) && /<strong>registrar<\/strong>/.test(box) && (box.match(/<sup>/g) || []).length >= 2 && box.includes('href="/#glossary"'); });
  check("Audit 3 #7: both tools explain 'society' and 'registrar' in plain, sourced words just above the tool", toolTerms.every(Boolean), JSON.stringify(toolTerms));
  check("Audit 3 #7: the glossary explains 'society' (under Lineage society) and Registrar, each sourced", /"society" on its own means a lineage society/.test(gloss) && gloss.includes("Registrar:") && /chapter registrar/.test(gloss));
}
check("Both reports link to the definitions", ["/tools/widow-pension-checker/report/", "/tools/lineage-matrix/report/"].every((p) => readFileSync(join(DIST, p, "index.html"), "utf8").includes('href="/#glossary"')));
const plainTerms = ["/tools/widow-pension-checker/", "/guides/bounty-land-warrants/"].every((p) => { const h = readFileSync(join(DIST, p, "index.html"), "utf8").replace(/<details[\s\S]*?<\/details>/, ""); return /free land in the public domain/.test(h); })
  && /Statutes at Large/.test(readFileSync(join(DIST, "tools/widow-pension-checker/index.html"), "utf8").replace(/<details[\s\S]*?<\/details>/, ""));
check("Plain terms: the widow checker page and the bounty-land guide explain 'Stat.' and 'bounty land' in the text too", plainTerms);
check("No doubled source markers like [1][1] on any page", htmlFiles.every((f) => !/(<sup><a href="#src-(\d+)"[^>]*>\[\d+\]<\/a><\/sup>)<sup><a href="#src-\2"/.test(readFileSync(f, "utf8"))));
{ // Logo (A0): every page links the new icons and a share image, all cache-busted; the old "PI" icon is gone.
  const bad = htmlFiles.filter((f) => { const h = readFileSync(f, "utf8");
    return !/<link rel="icon" href="\/favicon\.svg\?v=[0-9a-f]{10}" type="image\/svg\+xml">/.test(h) || !/<link rel="icon" href="\/favicon-32\.png\?v=[0-9a-f]{10}" type="image\/png" sizes="32x32">/.test(h) || !/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png\?v=[0-9a-f]{10}" sizes="180x180">/.test(h)
      || !/<meta property="og:image" content="https:\/\/patriotinlays\.com\/assets\/og-image\.png\?v=[0-9a-f]{10}">/.test(h) || !/<img class="logo" src="\/assets\/logo-horizontal-white\.svg\?v=[0-9a-f]{10}" alt="Patriot, In Lay Terms"/.test(h); });
  const fav = readFileSync(join(DIST, "favicon.svg"), "utf8");
  check(`Logo: all ${htmlFiles.length} pages link the new favicon (SVG + 32/16 PNG), apple-touch-icon and og:image, with the header logo, all cache-busted; the old 'PI' icon is replaced`, bad.length === 0 && !/>PI</.test(fav) && /#0f2444/.test(fav) && ["favicon-32.png", "favicon-16.png", "apple-touch-icon.png", "assets/og-image.png", "assets/logo-horizontal-white.svg"].every((f) => existsSync(join(DIST, f))), bad.map((f) => f.replace(DIST, "")).join(" ")); }
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
// The browser itself fetches the favicon lazily after load; that is not tool traffic and is excluded (and reported).
const isIcon = (u) => /\/(favicon[^/?]*|apple-touch-icon\.png)(\?|$)/.test(new URL(u).pathname + (new URL(u).search ? "?" : ""));
const faviconLate = requests.filter((r) => r.phase === "interact" && isIcon(r.url)).length;
const duringInteraction = requests.filter((r) => r.phase === "interact" && !isIcon(r.url));
check("Network: zero requests to any host other than the local site", external.length === 0, external.map((r) => r.url).slice(0, 3).join(" "));
check("Network: zero requests while using the tools (after page load)", duringInteraction.length === 0, duringInteraction.map((r) => r.url).slice(0, 3).join(" "));

// ---- Mobile and desktop rendering ----
const pagesToCheck = ["/", "/guides/lineage-proof-roadmap/", "/guides/substitute-evidence/", "/guides/read-pension-file/", "/guides/records-by-state/", "/guides/bounty-land-warrants/",
  "/guides/census-bridge/", "/guides/patriotic-service/", "/guides/same-name/", "/guides/patriot-or-loyalist/", "/guides/application-problems/",
  "/tools/widow-pension-checker/", "/tools/lineage-matrix/", "/tools/widow-pension-checker/report/", "/tools/lineage-matrix/report/", "/about/", "/privacy/", "/contact/", "/sources/", "/faq/", "/walkthroughs/"];
const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await mobile.newPage(); const overflow = [];
mp.on("pageerror", (e) => consoleErrors.push(`mobile ${mp.url()}: ${e.message}`));
for (const p of pagesToCheck) {
  await mp.goto(BASE + p);
  const o = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (o.sw > o.iw + 1) overflow.push(`${p} (${o.sw}px)`);
}
check(`Mobile 375px: no horizontal page overflow on ${pagesToCheck.length} pages`, overflow.length === 0, overflow.join(", "));
const tapTargets = await (async () => { await mp.goto(`${BASE}/tools/lineage-matrix/`); if (await mp.isVisible("[data-ws-begin]")) await mp.click("[data-ws-begin]"); return mp.$$eval(".tool button:not(.link)", (bs) => bs.filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 44).length); })();
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
// Logo (A0): the header logo loads, is modest (at most 44px tall) and fits a true 360px screen; the home page's independence note is on the first screen.
await np.goto(`${BASE}/`);
{ const lg = await np.evaluate(() => { const i = document.querySelector("header.site img.logo"); const r = i.getBoundingClientRect(); const n = document.querySelector("[data-independent]"); const hr = document.querySelector("header.site").getBoundingClientRect();
    return { ok: i.complete && i.naturalWidth > 0, h: Math.round(r.height), right: Math.round(r.right), alt: i.alt, header: Math.round(hr.height), note: n?.textContent || "", noteTop: n ? Math.round(n.getBoundingClientRect().top) : 9999 }; });
  check("Logo (360px): the header logo loads, is at most 44px tall, fits the screen, has alt text, and the header stays compact (no hero image)", lg.ok && lg.h <= 44 && lg.right <= 360 && /Patriot, In Lay Terms/.test(lg.alt) && lg.header <= 140, JSON.stringify(lg));
  check("Home (audit 4 proposal, 360px): the first screen says the site is independent (not DAR, SAR or any society) and doesn't search records", /independent/.test(lg.note) && /not affiliated with DAR, SAR or any lineage society/.test(lg.note) && /doesn't search records/.test(lg.note) && lg.noteTop < 780, JSON.stringify(lg)); }
// Birth substitutes (audit 4 proposal #1), on a phone: the example's generations without a birth record get the panel, in order; the patriot's includes the pension file.
await np.goto(`${BASE}/tools/lineage-matrix/`); await np.click("[data-load-example]");
{ const bs = await np.evaluate(() => ({ gens: [...document.querySelectorAll("[data-birth-subs]")].map((d) => d.dataset.birthSubs).join(","), open: [...document.querySelectorAll("[data-birth-subs]")].some((d) => d.open),
    title: document.querySelector("[data-birth-subs] summary")?.textContent, g5: [...document.querySelectorAll('[data-birth-subs="5"] [data-sub]')].map((li) => li.dataset.sub).join(","), g3: [...document.querySelectorAll('[data-birth-subs="3"] [data-sub]')].map((li) => li.dataset.sub).join(","),
    guide: !!document.querySelector('[data-birth-subs="5"] a[href="/guides/substitute-evidence/"]') }));
  await np.click('[data-birth-subs="5"] summary'); const wide = await np.evaluate(() => ({ sw: document.documentElement.scrollWidth, r: Math.round(document.querySelector('[data-birth-subs="5"]').getBoundingClientRect().right) }));
  check("Worksheet (audit 4 proposal): 'No birth certificate? Try these substitutes, in order' appears, closed, at each generation with no birth record (example: 3, 4, 5), in order, with the pension-file step only for older generations, and fits 360px open", bs.gens === "3,4,5" && !bs.open && bs.title === "No birth certificate? Try these substitutes, in order" && bs.g5 === "baptism,bible,pension,age,affidavit" && bs.g3 === "baptism,bible,age,affidavit" && bs.guide && wide.sw <= 360 && wide.r <= 360, JSON.stringify({ ...bs, ...wide })); }
check("True 360px (audit 2): home, worksheet (example loaded), its report, widow checker (example loaded) and its report fit 360px with nothing off-screen", nOver.length === 0, nOver.join(", "));
const recCards = await (async () => { await np.goto(`${BASE}/tools/lineage-matrix/report/`); return np.evaluate(() => { const t = document.querySelector("table.records"); return t ? getComputedStyle(t.querySelector("td")).display + "|" + getComputedStyle(t.querySelector("thead")).display : "none"; }); })();
check("True 360px (audit 2): the worksheet report's records table stacks into cards", recCards === "block|none", recCards);
await np.goto(`${BASE}/tools/lineage-matrix/`); await np.evaluate(() => document.querySelector("#tb-patriot").scrollIntoView()); await np.screenshot({ path: join(SHOTS, "m360-patriot.png") });
await narrow.close();
check("Mobile: tool buttons are at least 44px tall", tapTargets === 0, `${tapTargets} small`);
for (const [p, name] of [["/faq/", "m-faq"], ["/walkthroughs/", "m-walkthroughs"], ["/", "m-home"], ["/guides/substitute-evidence/", "m-guide-table"], ["/tools/widow-pension-checker/", "m-widow"], ["/tools/lineage-matrix/", "m-tool-b"]]) {
  await mp.goto(BASE + p); if (name === "m-guide-table") await mp.evaluate(() => document.querySelector(".table-wrap").scrollIntoView());
  if (name === "m-tool-b") { await mp.click('[data-add-evidence="1"]'); await mp.evaluate(() => document.querySelector("section.gen").scrollIntoView()); }
  await mp.screenshot({ path: join(SHOTS, `${name}.png`) });
}
// ---- FAQ and job-aid walkthroughs (Nov 5 second batch) ----
await page.goto(`${BASE}/faq/`);
{ const h = readFileSync(join(DIST, "faq/index.html"), "utf8"); const main = h.slice(h.indexOf("<main"));
  check("FAQ: sourced plain-English answers, not a bullet list; linked from nav, footer, home and every guide; in the sitemap", (main.match(/<h2 id=/g) || []).length >= 10 && (main.match(/<sup>/g) || []).length >= 15 && !/<ul>|<ol>/.test(main.split("<h2")[0])
    && (await page.$$('header.site nav a[href="/faq/"]')).length === 1 && (await page.$$('footer.site a[href="/faq/"], footer.site a[href="/walkthroughs/"]')).length === 2
    && readFileSync(join(DIST, "index.html"), "utf8").includes('href="/walkthroughs/"') && readFileSync(join(DIST, "guides/lineage-proof-roadmap/index.html"), "utf8").includes('href="/faq/"')
    && readFileSync(join(DIST, "sitemap.xml"), "utf8").includes("https://patriotinlays.com/faq/") && readFileSync(join(DIST, "sitemap.xml"), "utf8").includes("https://patriotinlays.com/walkthroughs/")); }
await page.goto(`${BASE}/walkthroughs/`); await page.waitForFunction(() => [...document.querySelectorAll("figure.job-aid img")].every((i) => i.complete));
{ const w = await page.evaluate(() => ({ figures: [...document.querySelectorAll("figure.job-aid img")].map((i) => ({ src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0, alt: i.alt })),
    quotes: [...document.querySelectorAll("blockquote.tool-output p")].map((q) => q.textContent.trim()),
    madeUp: /Every name below is made up\./.test(document.querySelector("main").textContent) }));
  check("Walkthroughs: real screenshots load with captions and alt text; quoted outputs match the captured tool results; the example family is labeled made up", w.figures.length === 5 && w.figures.every((f) => f.ok && f.alt && f.src.includes("?v=")) && w.madeUp, JSON.stringify(w.figures));
  const captured = JSON.parse(readFileSync(join(ROOT, "qa/walkthroughs/texts.json"), "utf8")).texts;
  check("Walkthroughs: every quoted output is a real captured result, and no bare 'Fits' verdict is shown", w.quotes.length === 8 && w.quotes.every((q) => captured.includes(q)) && w.quotes.every((q) => !/^Fits[:.]?$/.test(q)) && w.quotes.every((q) => !/^Fits$/.test(q)), JSON.stringify(w.quotes)); }
// Print CSS: both new pages print without the header/footer, figures don't split, and nothing overflows.
for (const p of ["/faq/", "/walkthroughs/"]) { await page.goto(BASE + p); await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ ...PDF_OPTS, path: join(SHOTS, `${p.replaceAll("/", "")}.pdf`) }); const pages = pdfPages(pdf);
  const printed = await page.evaluate(() => ({ header: getComputedStyle(document.querySelector("header.site")).display, footer: getComputedStyle(document.querySelector("footer.site")).display, text: document.querySelector("main").innerText.length }));
  check(`Print (${p}): a real PDF is produced, header/footer hidden, figures keep together`, pages >= 1 && pages <= 10 && printed.text > 500 && printed.header === "none" && printed.footer === "none" && readFileSync(join(DIST, "assets/site.css"), "utf8").includes("figure.job-aid{break-inside:avoid}"), `${pages} page(s)`);
  await page.emulateMedia({ media: "screen" }); }
// (360px overflow for the new pages is covered by pagesToCheck at 375px and by the mobile screenshots below.)
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
writeFileSync(join(ROOT, "qa/e2e-results.json"), JSON.stringify({ ranAt: new Date().toString(), browser: `${CHROME || "playwright Chromium"} (headless) via playwright-core ${require("playwright-core/package.json").version}`, passed, total: results.length, exampleReportPages: globalThis.__reportPages || null, home: globalThis.__home || null, results, requestsTotal: requests.length, externalRequests: external.length, interactionRequests: duringInteraction.length, faviconLate }, null, 2));
console.log(`\nE2E: ${passed}/${results.length} checks passed.`);
process.exit(passed === results.length ? 0 : 1);
