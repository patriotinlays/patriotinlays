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
// t130 #2b: generations are collapsible; tests that type into an older generation open them first (as a visitor would).
const openAll = (pg) => pg.evaluate(() => document.querySelectorAll("details.gen-d").forEach((d) => { d.open = true; }));
const ls = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
const phase = (p) => { page.__phase = p; };
// Nov 5: dates are memorable-date fields (Month / Day / Year / How sure). fillDate types a stored-format value into them.
const fillDate = async (pg, id, v) => { const m = /^([~<>])?(\d{4})?(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(v || "") || [];
  await pg.selectOption(`#${id}-month`, m[3] ? String(+m[3]) : ""); await pg.fill(`#${id}-day`, m[4] ? String(+m[4]) : ""); await pg.fill(`#${id}-year`, m[2] || "");
  await pg.selectOption(`#${id}-cert`, { "~": "about", "<": "before", ">": "after" }[m[1]] || "exact"); };

// ---- Audit 2 #1: a fresh first visit starts empty; results only after the button; prefill never auto-runs; Clear the form ----
{ const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const fp = await fresh.newPage();
  fp.on("pageerror", (e) => consoleErrors.push(`fresh: ${e.message}`));
  fp.on("dialog", (d) => d.accept());
  const formState = () => fp.evaluate(() => ({ vals: [...document.querySelectorAll("form[data-form=widow] input, form[data-form=widow] select:not([data-part=cert])")].map((i) => i.type === "checkbox" ? i.checked : i.value),
    rows: document.querySelectorAll("[data-out=widow] tbody tr").length, ls: Object.keys(localStorage), named: Object.fromEntries(new FormData(document.querySelector("form[data-form=widow]"))), plan: (document.querySelector('[data-tool="widow"] [data-plan] [data-plan-wait]')?.textContent || "") + (document.querySelector('[data-tool="widow"] [data-plan] .plan-title') ? " PLAN-SHOWN" : ""),
    saved: !document.querySelector("[data-saved-msg]").hidden }));
  await fp.goto(`${BASE}/tools/widow-pension-checker/`);
  let f = await formState();
  check("Fresh profile: widow checker starts empty and unticked, with no results and nothing saved", f.vals.every((v) => v === "" || v === false) && f.rows === 0 && (await fp.$$("[data-answer]")).length === 0 && f.ls.length === 0 && /appear here after you press/.test(f.plan) && !/PLAN-SHOWN/.test(f.plan) && !f.saved, JSON.stringify(f));
  check("Widow checker: a visible 'Clear the form' button", await fp.isVisible('[data-tool="widow"] [data-start-over]') && (await fp.textContent("[data-start-over]")).trim() === "Clear the form");
  await fp.click("[data-load-example]"); const exRows = (await formState()).rows;
  await fp.reload(); f = await formState();
  check("Returning visit: the form starts empty and unticked with no old results; a note points to the saved check and 'Clear the form'", exRows === 7 && f.vals.every((v) => v === "" || v === false) && f.rows === 0 && /appear here after you press/.test(f.plan) && !/PLAN-SHOWN/.test(f.plan) && f.saved && /Clear the form/.test(await fp.textContent("[data-saved-msg]")), JSON.stringify(f));
  await fp.evaluate(() => localStorage.setItem("pi.toolB.v1", JSON.stringify({ generations: [{ gen: 1, living: true, cells: [] }, { gen: 2, cells: [] }], patriot: { name: "Prefill Test", state: "VA", kind: "militia", start: "1777", end: "1779-10", gen: "" } })));
  await fp.goto(`${BASE}/tools/widow-pension-checker/?from=worksheet`); f = await formState();
  check("Prefill from the worksheet fills his service end but does not run the check", f.named.serviceEnd === "1779-10" && f.named.marriage === "" && f.named.serviceMonths === "" && f.rows === 0, JSON.stringify(f));
  await fp.click('form[data-form=widow] button[type=submit]'); const afterPress = (await formState()).rows;
  await fp.click("[data-start-over]"); f = await formState();
  check("Clear the form: empties the form, deletes this checker's saved data only, and says so", afterPress === 7 && f.vals.every((v) => v === "" || v === false) && !f.ls.some((k) => k.startsWith("pi.toolA.")) && f.ls.includes("pi.toolB.v1") && /Cleared the form: deleted 1 saved item from this browser/.test(await fp.textContent("[data-out=widow]")) && !f.saved, JSON.stringify(f));
  await fresh.close(); }

// ---- Widow Pension Law Checker (leads the site) ----
phase("load"); await page.goto(`${BASE}/tools/widow-pension-checker/`); await page.evaluate(() => localStorage.setItem("other.app.key", "keep-me"));
phase("interact");
const intro = await page.textContent("main");
check("Widow checker page: the intro answers the 7 questions (what, who, problem, how, what you get, limits, next) and mentions pension files", ["What it is.", "Who it helps.", "The problem it solves.", "How to use it.", "What you'll get.", "Its limits.", "What to do next."].every((k) => intro.includes(k)) && /pension file/i.test(intro));
check("Widow checker page: the standalone service-date form is gone", (await page.$$("form[data-form=window], #ta-start")).length === 0);
const howA = await page.textContent('[data-tool="widow"] .howto');
check("Widow checker: 'How this works' says it doesn't search records and nothing leaves the device", /does not search any records/.test(howA) && /Nothing you type leaves your device/.test(howA), howA.slice(0, 160));
await page.selectOption("#tw-m-month", "5"); await page.fill("#tw-m-day", "4");
{ const yr = await page.evaluate(() => { const e = document.querySelector("#tw-m [data-date-error]"); return { hidden: e.hidden, text: e.textContent }; });
  check("Dates: month or day chosen with the year blank shows the 4-digit-year message", !yr.hidden && /type the year as 4 digits/.test(yr.text), JSON.stringify(yr)); }
await page.selectOption("#tw-m-month", ""); await page.fill("#tw-m-day", "");
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
// Audit 4 proposal #2: a first visit shows the purpose line, a Start button and the "Don't know your patriot's name yet?" checklist;
// the steps (and the generation cards) stay hidden until the visitor starts.
{ const st = await page.evaluate(() => ({ purpose: document.querySelector("[data-purpose]")?.textContent || "", start: !!document.querySelector("[data-ws-start]") && !document.querySelector("[data-ws-start]").hidden,
    bodyHidden: document.querySelector("[data-ws-body]")?.hidden, genVisible: [...document.querySelectorAll("details.gen")].some((g) => g.offsetParent !== null),
    list: [...document.querySelectorAll("[data-ws-start] [data-name-check]")].length, step0: !!document.querySelector('[data-ws-start] a[href="/guides/lineage-proof-roadmap/#step-0-find-your-patriot-s-name"]'), ls: Object.keys(localStorage).filter((k) => k.startsWith("pi.toolB")) }));
  check("Worksheet (audit 4 proposal): a first visit opens with the purpose line and a Start button; the generation cards stay hidden; nothing is saved yet", /What it's for/.test(st.purpose) && st.start && st.bodyHidden === true && !st.genVisible && st.ls.length === 0, JSON.stringify(st));
  check("Worksheet (audit 4 proposal): the start screen has the inline 'Don't know your patriot's name yet?' checklist (4 items) plus the Step 0 link", st.list === 4 && st.step0 && /Don't know your patriot's name yet\?/.test(await page.textContent("[data-ws-start]")), JSON.stringify(st));
  await page.check('[data-ws-start] [data-name-check="known"]');
  await page.click("[data-ws-begin]");
  const after = await page.evaluate(() => ({ startHidden: document.querySelector("[data-ws-begin-wrap]").hidden, bodyHidden: document.querySelector("[data-ws-body]").hidden, focus: document.activeElement?.id, saved: !!localStorage.getItem("pi.toolB.v1"), tick: JSON.parse(localStorage.getItem("pi.toolB.nameChecklist") || "{}").known, patBox: document.querySelector('[data-patriot-form] details[data-name-box] [data-name-check="known"]')?.checked }));
  check("Worksheet (audit 4 proposal, t130 #2a): 'Start with just the patriot and me' opens the steps at the patriot step, saves a blank worksheet, and keeps the checklist tick (also shown in the patriot step)", after.startHidden && !after.bodyHidden && after.focus === "tb-patriot" && after.saved && after.tick === true && after.patBox === true, JSON.stringify(after));
  phase("load"); await page.reload(); phase("interact");
  check("Worksheet (audit 4 proposal): once started, a reload goes straight to the steps", !(await page.isVisible("[data-ws-begin]")) && await page.isVisible("#pat-name")); }
check("Worksheet: step 1 is the patriot step", /Your patriot/.test(await page.textContent("#tb-patriot")) && (await page.$$("[data-patriot-form] #pat-kind option")).length >= 9);
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
  check("Worksheet (audit 4 #1): a patriot born 1850 with 1777–79 service gets 'Your patriot's dates don't add up', not 'Dates fit', and the plan opens with 'Check these dates first'", /Your patriot's dates don't add up/.test(ds.check) && /wasn't born yet/.test(ds.check) && !/Dates fit/.test(ds.check) && ds.first === "Check these dates first" && /wasn't born yet/.test(ds.plan), JSON.stringify(ds).slice(0, 240));
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/report/`); phase("interact");
  const rs = await page.textContent("[data-report]");
  check("Report (audit 4 #1): the summary says his birth year and service don't add up, and never 'dates fit'", /don't add up/.test(rs) && !/dates fit/i.test(rs) && /Check these dates first/.test(rs), rs.slice(0, 200));
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact"); }
await page.evaluate(() => localStorage.removeItem("pi.toolB.v1")); phase("load"); await page.reload(); phase("interact");
await page.click("[data-ws-begin]");

// ---- Tool B ----
// t130 #2a: "Start with just the patriot and me" creates only the patriot step and generation 1 (you).
{ const st0 = await page.evaluate(() => ({ gens: [...document.querySelectorAll("details.gen-d")].map((d) => d.dataset.gen).join(","), saved: JSON.parse(localStorage.getItem("pi.toolB.v1") || "{}").generations?.length,
    patriotOpen: document.querySelector('details[data-group="patriot"]')?.open, groups: [...document.querySelectorAll("[data-group]")].map((g) => g.querySelector("h3")?.textContent.replace(/^\d+\s*/, "")).join("|"), g1Open: document.querySelector('details.gen-d[data-gen="1"]')?.open }));
  check("t130 #2a: the default start shows only 'Your patriot' and Generation 1 (you); older generations stay hidden until added; saved worksheet has 1 generation", st0.gens === "1" && st0.saved === 1 && st0.patriotOpen === true && st0.g1Open === true && st0.groups === "Your patriot|Generations", JSON.stringify(st0)); }
check("Tool B: 'How this works' says it doesn't search records and nothing leaves the device", /does not search any records/.test(await page.textContent('[data-tool="lineage-matrix"] .howto')));
check("Tool B: generation 1 is labelled 'Generation 1: You'", (await page.$$eval("details.gen h3", (hs) => hs.map((h) => h.textContent).join("|"))) === "Generation 1: You");
await page.click('[data-add-evidence="1"]'); await page.click('[data-add-evidence="1"]');
check("Tool B: clicking 'Add a record' twice does not stack a second blank record", (await page.$$('details.gen[data-gen="1"] .cell')).length === 1);
const blankStatus = await page.textContent('details.gen[data-gen="1"] .cell .status');
check("Tool B (regression): a blank record shows no label at all (no 'Evidence Entered')", !/Evidence Entered/.test(blankStatus) && (await page.$$('details.gen[data-gen="1"] .cell .status .badge')).length === 0 && /Empty record/.test(blankStatus), blankStatus);
await page.selectOption('details.gen[data-gen="1"] select[name=fact]', "birth");
await page.selectOption('details.gen[data-gen="1"] select[name=docType]', "birth_cert_long");
await page.check('details.gen[data-gen="1"] input[type=radio][value=direct]');
await page.fill('details.gen[data-gen="1"] input[name=citation]', "Long-form birth certificate, state vital records office, image 1");
txt = await page.textContent('details.gen[data-gen="1"] .cell .status');
check("Tool B: complete direct entry shows 'Evidence Entered — Review Required'", txt.includes("Evidence Entered — Review Required"), txt.slice(0, 60));
await page.fill("#who-1", "Test Me");
// t130 #2b: "+ Add an older generation" adds generation 2, opens it, and folds generation 1 under its title and name.
await page.click("[data-add-gen]");
{ const c1 = await page.evaluate(() => ({ gens: [...document.querySelectorAll("details.gen-d")].map((d) => `${d.dataset.gen}:${d.open ? "open" : "closed"}`).join(","), h1: document.querySelector('details.gen-d[data-gen="1"] > summary h3')?.textContent,
    h2: document.querySelector('details.gen-d[data-gen="2"] > summary h3')?.textContent, g1FieldsVisible: document.querySelector("#who-1")?.checkVisibility() }));
  check("t130 #2b: adding an older generation opens it; the earlier one collapses with its title and name as the heading", c1.gens === "1:closed,2:open" && c1.h1 === "Generation 1: You — Test Me" && c1.h2 === "Generation 2: Your parent" && !c1.g1FieldsVisible, JSON.stringify(c1));
  await page.click('details.gen-d[data-gen="1"] > summary');
  const c2 = await page.evaluate(() => ({ open: document.querySelector('details.gen-d[data-gen="1"]').open, vis: document.querySelector("#who-1")?.checkVisibility(), val: document.querySelector("#who-1")?.value }));
  await page.click('details.gen-d[data-gen="1"] > summary');
  const c3 = await page.evaluate(() => document.querySelector('details.gen-d[data-gen="1"]').open);
  check("t130 #2b: clicking a collapsed generation's heading expands it (entries intact); clicking again collapses it", c2.open && c2.vis && c2.val === "Test Me" && c3 === false, JSON.stringify({ c2, c3 })); }
await page.click('[data-add-evidence="2"]');
await page.selectOption('details.gen[data-gen="2"] select[name=fact]', "parentage");
await page.selectOption('details.gen[data-gen="2"] select[name=docType]', "census_1850_1870");
await page.check('details.gen[data-gen="2"] input[type=radio][value=direct]');
await page.fill('details.gen[data-gen="2"] input[name=citation]', "1860 census, county and page as on image");
{ const g1Still = await page.evaluate(() => document.querySelector('details.gen-d[data-gen="1"]').open);
  check("t130 #2b: an expanded or collapsed choice is kept while the visitor works (generation 1 stays collapsed after editing generation 2)", g1Still === false); }
txt = await page.textContent('details.gen[data-gen="2"] .cell .status');
check("Tool B: 1850-70 census for parentage marked direct gets NSCDA caution, not an upgrade", txt.includes("Evidence Entered — Review Required") && /do not state relationships/.test(txt));
// t130 #2c: key questions first; "This record disagrees with another record" sits under a closed "More details" toggle.
{ const md = await page.evaluate(() => { const c = document.querySelector('details.gen[data-gen="2"] .cell'); const d = c.querySelector("details.more-details");
    const order = [...c.querySelectorAll("label, summary")].map((x) => x.textContent.trim().slice(0, 2));
    return { has: !!d, open: d?.open, summary: d?.querySelector("summary")?.textContent, conflictInside: !!d?.querySelector("input[name=conflict]"), conflictVisible: c.querySelector("input[name=conflict]")?.checkVisibility(), keyFirst: order.indexOf("A.") < order.indexOf("Mo") && order.indexOf("D.") < order.indexOf("Mo") }; });
  check("t130 #2c: each record shows questions A–D first; the 'disagrees with another record' box is under a closed 'More details' toggle", md.has && md.open === false && md.summary === "More details" && md.conflictInside && !md.conflictVisible && md.keyFirst, JSON.stringify(md)); }
await page.click('details.gen[data-gen="2"] .cell details.more-details > summary');
await page.check('details.gen[data-gen="2"] input[name=conflict]');
txt = await page.textContent('details.gen[data-gen="2"] .cell .status');
check("Tool B: conflict flag changes label to 'Conflict Flagged — Review Required'", txt.includes("Conflict Flagged — Review Required"));
check("t130 #2c: a record flagged as disagreeing keeps its 'More details' open after the redraw", await page.evaluate(() => document.querySelector('details.gen[data-gen="2"] .cell details.more-details').open));
await page.click("[data-add-gen]");
check("Tool B: add generation works", (await page.$$("details.gen")).length === 3);
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
check("Tool B: state persists after reload (localStorage)", (await page.$$("details.gen")).length === 3 && (await page.$$("details.gen .cell")).length === 2);
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
check("Tool B: 'Load an example' fills a made-up patriot and family and shows gaps with where to look", (await page.$$("details.gen")).length === 5 && (await page.inputValue("#pat-name")).length > 0 && (await page.$$("[data-gaps] [data-where-block] a[href*='archives.gov']")).length > 0);
{ const nn = await page.evaluate(() => { const p = document.querySelector("[data-patriot] [data-no-name]"); return p ? { text: p.textContent, href: p.querySelector("a")?.getAttribute("href") } : null; });
  const road = readFileSync(join(DIST, "guides/lineage-proof-roadmap/index.html"), "utf8");
  check("Worksheet patriot step: 'Don't know your patriot's name yet?' links in plain words to Roadmap Step 0", nn && /^Don't know your patriot's name yet\?/.test(nn.text) && nn.href === "/guides/lineage-proof-roadmap/#step-0-find-your-patriot-s-name" && road.includes('id="step-0-find-your-patriot-s-name"'), JSON.stringify(nn)); }
const notes = await page.$$eval("[data-gaps] [data-where-block] p:first-child", (ns) => ns.map((n) => n.textContent));
check("Where to look is tailored: Virginia's 1853-1896 birth registers and the censuses in each lifetime appear", notes.some((n) => /1853 to 1896/.test(n)) && notes.some((n) => /Census: (The 1850–1870 censuses|NSCDA's South Carolina society's standards say the 1850–1870 censuses)/.test(n)), notes.slice(0, 2).join(" | ").slice(0, 160));
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
  await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact"); await openAll(page);
  await page.check('[data-have="3"] input[data-have-item="census"]');
  const g3 = await page.$eval('details.gen[data-gen="3"] .cell', (c) => ({ doc: c.querySelector("select[name=docType]").value, status: c.querySelector(".status").textContent }));
  // Repeated notes: Ohio's no-source note is printed in full once on the worksheet page; later mentions are one-line pointers.
  const ohio = await page.evaluate(() => ({ full: (document.querySelector("main").textContent.match(/no verified source yet on when Ohio began/g) || []).length,
    refs: [...document.querySelectorAll("[data-gaps] [data-where-ref]")].length }));
  check("Audit 3 #5: the 'no verified source for Ohio' note appears in full once on the worksheet page; the gaps point to it by letter", ohio.full === 1 && ohio.refs >= 3, JSON.stringify(ohio));
  // Patriot generation: a missing birth or death record has a clear way to add it.
  const addBtn = await page.$('[data-gaps] [data-add-for="6:birth"]');
  const btnText = addBtn ? await addBtn.textContent() : "";
  await addBtn?.click(); const g6 = await page.$$eval('details.gen[data-gen="6"] .cell select[name=fact]', (s) => s.map((x) => x.value));
  check("Audit 3 #4: the patriot's generation's 'add a birth or death record' item has a button that adds one there", /Add a birth or death record/.test(btnText) && g6.includes("birth"), `${btnText} -> ${g6}`);
  await page.click('details.gen[data-gen="6"] [data-remove-cell]').catch(() => {});
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
  const bS = pdfPages(await page.pdf(PDF_OPTS)); await page.evaluate(() => document.body.classList.remove("print-summary")); const bF = pdfPages(await page.pdf({ ...PDF_OPTS, path: join(SHOTS, "persona-b-report-full.pdf") }));
  await page.emulateMedia({ media: "screen" }); globalThis.__reportPages = { ...(globalThis.__reportPages || {}), personaB: { summaryPages: bS, fullPages: bF } };
  check("Audit 3 #2: the audit's longer persona-B report prints shorter than before (Save as PDF 3 -> at most 2, Ctrl+P 5 -> at most 3)", bS <= 2 && bF <= 3, `summary ${bS}, full ${bF}`);
  await page.evaluate(() => localStorage.removeItem("pi.toolB.v1"));
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); await page.click("[data-load-example]"); phase("interact");
}
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact"); await openAll(page);
await page.selectOption("#state-3", "TX");
const genOpts = await page.$$eval("#pat-gen option", (os) => os.map((o) => [o.value, o.textContent]));
check("Generation picker (audit 2): Generation 1 is not offered; the default is the oldest generation", !genOpts.some(([v]) => v === "1") && genOpts[0][0] === "" && /oldest generation I've added \(now my 2nd-great-grandfather, generation 5\)/.test(genOpts[0][1]) && genOpts.some(([v, t]) => v === "6" && t === "My 3rd-great-grandfather (generation 6)"), JSON.stringify(genOpts.slice(0, 2)));
const subst = await page.$$eval("[data-gaps] [data-where-block] a[data-substitute]", (as) => as.map((a) => [a.getAttribute("href"), a.closest(".where-block").textContent]));
check("Birth gap (audit 2): Virginia before 1853 says there was no statewide birth recording and links the substitute-evidence guide right there", subst.some(([h, t]) => h === "/guides/substitute-evidence/" && /no statewide recording of births before 1853/.test(t)), JSON.stringify(subst).slice(0, 160));
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("pi.toolB.v1")); s.patriot.gen = "1"; localStorage.setItem("pi.toolB.v1", JSON.stringify(s)); });
phase("load"); await page.reload(); phase("interact");
const heads = await page.$$eval("details.gen h3", (hs) => hs.map((h) => h.textContent));
check("Generation picker (audit 2): an old saved 'Generation 1' shows a plain warning and the oldest generation stays the patriot", await page.isVisible("[data-gen-warn]") && /Generation 1 is you/.test(await page.textContent("[data-gen-warn]")) && !/patriot/.test(heads[0]) && /\(the patriot\)/.test(heads.at(-1)), heads.join(" | "));
const txNote = await page.textContent("[data-gaps] [data-where-index]");
check("Where to look: a state with no verified source says so (no invented records)", /no verified source yet on when Texas/.test(txNote), txNote.slice(0, 120));
await page.click("[data-clear=toolB]");
store = await ls();
check("Tool B clear: removes pi.toolB.* only, keeps unrelated key", !Object.keys(store).some((k) => k.startsWith("pi.toolB")) && store["other.app.key"] === "keep-me", Object.keys(store).join(","));
// ---- Simpler worksheet: "What do you have?" checklist and plain relationship choices ----
phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
await page.click("[data-ws-begin]"); await page.click("[data-add-gen]");
await page.check('[data-have="2"] input[data-have-item="will"]');
const willCell = await page.evaluate(() => { const c = document.querySelectorAll('details.gen[data-gen="2"] .cell'); return { n: c.length, fact: c[0]?.querySelector("select[name=fact]").value, doc: c[0]?.querySelector("select[name=docType]").value }; });
await page.uncheck('[data-have="2"] input[data-have-item="will"]'); const afterUntick = (await page.$$('details.gen[data-gen="2"] .cell')).length;
check("Worksheet: ticking 'Will or probate record' under 'What do you have?' adds a record with what it shows and its kind already picked; unticking removes it", willCell.n === 1 && willCell.fact === "parentage" && willCell.doc === "probate" && afterUntick === 0, JSON.stringify(willCell));
check("Worksheet: the checklist offers birth certificate, will, census, Bible record and pension file", (await page.$$eval('[data-have="1"] input', (xs) => xs.map((x) => x.value))).join(",").includes("birth_cert,death_cert,marriage,will,census,bible,church,pension"));
await page.selectOption("#pat-gen", "7");
const g7 = await page.$$eval("details.gen h3", (hs) => hs.map((h) => h.textContent));
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
check("Home (t130 #1, replaces 'Ready to get started?'): the start cards link to both tools and to the Roadmap guide", (await page.$$('main [data-start-cards] a[href="/tools/lineage-matrix/"]')).length === 1 && (await page.$$('main [data-start-cards] a[href="/tools/widow-pension-checker/"]')).length === 1 && (await page.$$('main [data-start-cards] a[data-start-button][href="/guides/lineage-proof-roadmap/"]')).length === 1);
const homeOrder = await page.evaluate(() => [...document.querySelectorAll("main h2")].map((h) => h.id));
{ const hm = await page.evaluate(() => { const m = document.querySelector("main [data-mission]"); return { ps: m.querySelectorAll("p").length, lists: m.querySelectorAll("ul, ol").length, text: m.textContent, sub: document.querySelector("main [data-subtitle]")?.textContent || "",
    ai: document.querySelector("main [data-ai-line]")?.textContent.trim() || "", afterCards: !!(m.compareDocumentPosition(document.querySelector("[data-start-cards]")) & Node.DOCUMENT_POSITION_PRECEDING), words: document.querySelector("main").innerText.split(/\s+/).length }; });
  globalThis.__home = hm;
  check("Home (Nov 5 lock; t130 moved the paragraphs below the start cards, unchanged): subtitle names DAR and SAR; mission in flowing paragraphs (no lists) after the cards; purpose line, both tool names, one-sentence privacy", /DAR/.test(hm.sub) && /SAR/.test(hm.sub) && hm.lists === 0 && hm.ps >= 6 && hm.afterCards && homeOrder.filter(Boolean)[0] === "guides"
    && /organize the records that connect you to a Revolutionary War patriot/.test(hm.text) && /Widow Pension Law Checker/.test(hm.text) && /Lineage Evidence Matrix/.test(hm.text) && /what you type into the tools stays in your own browser\./.test(hm.text), JSON.stringify({ ...hm, text: hm.text.slice(0, 80) }));
  check("Home (Nov 5 lock, SAR line updated by t125u): the exact AI line, the exact SAR line (sourced), no unsourced 'most people get stuck' / 'give up' / guarantee lines", hm.ai === "Written with AI assistance and reviewed by the site's owner. Each fact is tied to a quoted official source, and software checks that the quote is still there."
    && /SAR's local sponsor can guide you through the application\./.test(hm.text) && !/most people get stuck|give up|so that doesn't happen to you|make sure you walk/i.test(hm.text) && !/No person reviews/i.test(await page.textContent("main")), hm.ai); }
const firstLinks = await page.$$eval("main a", (as) => as.map((a) => a.getAttribute("href")).filter((h) => !h.startsWith("#src-")).slice(0, 3));
check("Home: the first links (after source notes) are the worksheet, the widow checker and the Roadmap guide", firstLinks[0] === "/tools/lineage-matrix/" && firstLinks[1] === "/tools/widow-pension-checker/" && firstLinks[2] === "/guides/lineage-proof-roadmap/", firstLinks.join(" "));
const navLinks = await page.$$eval("header.site nav a", (as) => as.map((a) => [a.getAttribute("href"), a.textContent]));
check("Navigation: 'Start here' (the Roadmap) comes first, then the widow-pension check", navLinks[0][0] === "/guides/lineage-proof-roadmap/" && navLinks[0][1] === "Start here" && navLinks[1][0] === "/tools/widow-pension-checker/", navLinks.map((x) => x[1]).join(" | "));
// The beginner's three clicks: the big button -> Roadmap, whose top has "How to join" and "Step 0"
phase("load"); await page.click("main [data-start-button]"); await page.waitForURL("**/guides/lineage-proof-roadmap/"); phase("interact");
const rmOrder = await page.evaluate(() => [...document.querySelectorAll("main h2")].slice(0, 3).map((h) => h.id));
check("Roadmap: opens with 'How to join, in short' and 'Step 0: find your patriot's name' before the rest", rmOrder[0] === "how-to-join-in-short" && rmOrder[1] === "step-0-find-your-patriot-s-name", rmOrder.join(","));
const joinItems = await page.$$eval("#how-to-join ol > li", (lis) => lis.map((li) => ({ t: li.textContent, sup: li.querySelectorAll("sup a").length })));
check("Roadmap: 'How to join, in short' has 4 sourced steps, the DAR chapter locator and the SAR contact finder", joinItems.length === 4 && joinItems.every((x) => x.sup > 0) && (await page.$$('#how-to-join a[href="https://www.dar.org/discover/become-member/chapter-locator"]')).length === 1 && (await page.$$('#how-to-join a[href="https://www.sar.org/find-your-contact/"]')).length === 1);
const step0 = await page.evaluate(() => { const h = document.getElementById("step-0-find-your-patriot-s-name"); const ul = h.nextElementSibling.nextElementSibling; return [...ul.querySelectorAll("li")].map((li) => li.querySelectorAll("sup a").length); });
check("Roadmap Step 0: every point is sourced", step0.length >= 4 && step0.every((n) => n > 0), JSON.stringify(step0));
phase("load"); await page.goto(`${BASE}/`); phase("interact");
const glossTerms = ["DAR:", "SAR:", "NSCDA:", "Lineage society:", "Patriot:", "Bounty land:", "Stat.:"];
check("Home glossary also explains 'Bounty land' and 'Stat.', each sourced", ["Bounty land:", "Stat.:"].every((k) => gloss.includes(k)) && /Statutes at Large/.test(gloss) && /free land in the public domain/.test(gloss));
const defsBad = [];
for (const gp of ["/guides/lineage-proof-roadmap/", "/guides/substitute-evidence/", "/guides/read-pension-file/", "/guides/records-by-state/", "/guides/bounty-land-warrants/", "/guides/census-bridge/", "/guides/patriotic-service/", "/guides/same-name/", "/guides/patriot-or-loyalist/", "/guides/application-problems/", "/tools/widow-pension-checker/", "/tools/lineage-matrix/"]) {
  const h = readFileSync(join(DIST, gp, "index.html"), "utf8"); const d = (h.match(/<details class="defs"[\s\S]*?<\/details>/) || [""])[0];
  const isTool = gp.startsWith("/tools/");
  // Guides: defs sit right under the title. Tool pages: title, purpose, limits, then tool; glossary sits below the tool.
  const posOk = isTool ? (d && h.indexOf(d) > h.indexOf("data-tool=")) : (d && h.indexOf(d) <= h.indexOf("</h1>") + 6);
  if (!d || !posOk || !glossTerms.every((k) => d.includes(`<strong>${k}</strong>`)) || !/<sup><a href="#src-/.test(d) || !d.includes('href="/#glossary"')) defsBad.push(gp); }
check("Definitions box (DAR, SAR, NSCDA, lineage society, patriot, bounty land, Stat.) on all 10 guides (under title) and both tools (below the tool), sourced", defsBad.length === 0, defsBad.join(" "));
{ // Audit 3 #7: plain terms
  const homeHtml = readFileSync(join(DIST, "index.html"), "utf8"); const mainTxt = homeHtml.slice(homeHtml.indexOf("</h1>", homeHtml.indexOf("<main"))).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const firstP = mainTxt.search(/patriot/i);
  check("Audit 3 #7: 'patriot' is glossed in plain words, with a source, at its first use on the home page's first screen (after the site name)", firstP > 0 && /A patriot here means someone who supported the cause of American independence/.test(mainTxt.slice(firstP, firstP + 260)) && /sar-about-patriots|#src-/.test(homeHtml.slice(homeHtml.indexOf("A <strong>patriot</strong> here"), homeHtml.indexOf("A <strong>patriot</strong> here") + 600)), mainTxt.slice(firstP - 40, firstP + 200));
  const toolTerms = ["/tools/widow-pension-checker/", "/tools/lineage-matrix/"].map((tp) => { const h = readFileSync(join(DIST, tp, "index.html"), "utf8"); const i = h.indexOf('class="card box-tool-terms"'); const j = h.indexOf("data-tool="); const box = i > 0 ? h.slice(i, h.indexOf("</aside>", i)) : "";
    return i > 0 && i > j && /<strong>society<\/strong>/.test(box) && /<strong>registrar<\/strong>/.test(box) && (box.match(/<sup>/g) || []).length >= 2 && box.includes('href="/#glossary"'); });
  check("Audit 3 #7: both tools explain 'society' and 'registrar' in plain, sourced words just below the tool", toolTerms.every(Boolean), JSON.stringify(toolTerms));
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
  if (name === "m-tool-b") { await openAll(mp); await mp.click('[data-add-evidence="1"]'); await mp.evaluate(() => document.querySelector("details.gen").scrollIntoView()); }
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
// ---- Polish batch t119u (Nov 9) ----
{ // #1 Home: no "Choose a tool:" row; the two big tool buttons now sit in the t130 start cards
  const home = readFileSync(join(DIST, "index.html"), "utf8"); const gs = (home.match(/<section[^>]*data-start-cards[\s\S]*?<\/section>/) || [""])[0];
  check('t119u #1 (t130 cards): home has no "Choose a tool:" link row; the start cards keep both big tool buttons', !/Choose a tool/.test(home) && !/home-tool-choice/.test(home)
    && /class="button-link" href="\/tools\/lineage-matrix\/"/.test(gs) && /class="button-link" href="\/tools\/widow-pension-checker\/"/.test(gs)); }
{ // #2 Tool pages: the Roadmap line sits right under the one-sentence purpose, above the "What it does" box
  const bad = [];
  for (const tp of ["/tools/widow-pension-checker/", "/tools/lineage-matrix/"]) { const h = readFileSync(join(DIST, tp, "index.html"), "utf8");
    const after = h.slice(h.indexOf("</h1>") + 5).trimStart(); const m = after.match(/^<p>[\s\S]*?<\/p>(<p class="roadmap-pointer"[^>]*>[\s\S]*?<\/p>)\s*<aside class="card box-limits/);
    if (!m || !/New to this\? <a href="\/guides\/lineage-proof-roadmap\/">Start with the Roadmap guide\.<\/a>/.test(m[1]) || (h.match(/data-roadmap-pointer/g) || []).length !== 1) bad.push(tp); }
  check('t119u #2: both tool pages show "New to this? Start with the Roadmap guide." (linked) directly under the purpose, above "What it does"', bad.length === 0, bad.join(" ")); }
{ // #5 Sitemap: report pages left out; robots.txt rules unchanged
  const sm5 = readFileSync(join(DIST, "sitemap.xml"), "utf8"); const rb5 = readFileSync(join(DIST, "robots.txt"), "utf8");
  check("t119u #5: sitemap.xml lists neither report page; robots.txt still disallows both", !/\/tools\/widow-pension-checker\/report\//.test(sm5) && !/\/tools\/lineage-matrix\/report\//.test(sm5)
    && /^Disallow: \/tools\/widow-pension-checker\/report\/$/m.test(rb5) && /^Disallow: \/tools\/lineage-matrix\/report\/$/m.test(rb5)); }
{ // #4 Roadmap: the record-copies section right after Step 0, every fact sourced, ending with the registrar line
  const h = readFileSync(join(DIST, "guides/lineage-proof-roadmap/index.html"), "utf8"); const ids = [...h.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
  const i0 = ids.indexOf("step-0-find-your-patriot-s-name"); const sec = (h.match(/<h2 id="if-your-patriot-is-already-in-dar-s-or-sar-s-database">[\s\S]*?(?=<h2 )/) || [""])[0];
  check("t119u #4: Roadmap has 'If your patriot is already in DAR's or SAR's database' right after Step 0; its facts are sourced and it ends with the registrar line", i0 >= 0 && ids[i0 + 1] === "if-your-patriot-is-already-in-dar-s-or-sar-s-database"
    && (sec.match(/<sup>/g) || []).length >= 4 && /Ask your chapter registrar which of your generations still need proof\.<\/p>\s*$/.test(sec), ids.slice(i0, i0 + 2).join(",")); }
{ // #3 Worksheet: "Skip for now" on A to D; skipped answers read "Still needed", never an error
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/`); phase("interact");
  await page.evaluate(() => localStorage.setItem("pi.toolB.v1", JSON.stringify({ version: 1, updated: new Date().toISOString(), generations: [{ gen: 1, cells: [] }, { gen: 2, cells: [{ id: "cskip", fact: "", docType: "", mode: "", conflict: false, citation: "" }] }] })));
  phase("load"); await page.reload(); phase("interact");
  const cell = '[data-cell="cskip"]';
  const offers = await page.evaluate((c) => { const x = document.querySelector(c); return { a: !!x.querySelector('select[name=fact] option[value="__skip"]'), b: !!x.querySelector('select[name=docType] option[value="__skip"]'), c: !!x.querySelector('[data-skip="mode"]'), d: !!x.querySelector('[data-skip="citation"]'),
    texts: [...x.querySelectorAll('option[value="__skip"]')].map((o) => o.textContent).concat([...x.querySelectorAll('[data-skip="mode"], [data-skip="citation"]')].map((i) => i.closest("label").textContent.trim())), req: x.querySelectorAll("[required]").length }; }, cell);
  await page.selectOption(`${cell} select[name=fact]`, "__skip"); await page.selectOption(`${cell} select[name=docType]`, "__skip");
  await page.check(`${cell} [data-skip="mode"]`); await page.check(`${cell} [data-skip="citation"]`);
  const st = await page.evaluate((c) => { const x = document.querySelector(c); const s = JSON.parse(localStorage.getItem("pi.toolB.v1")).generations[1].cells[0];
    return { badge: x.querySelector(".badge")?.textContent || "", notes: [...x.querySelectorAll("[data-still-needed]")].map((d) => d.textContent), color: getComputedStyle(x.querySelector("[data-still-needed]") || x).color,
      skipped: s.skipped, kept: x.querySelector('select[name=fact]').value === "__skip" && x.querySelector('[data-skip="mode"]').checked && x.querySelector('[data-skip="citation"]').checked,
      gap: [...document.querySelectorAll("[data-gaps] .gap-text")].map((g) => g.textContent).find((t) => /record isn't finished/.test(t)) || "", conflictItems: document.querySelectorAll("[data-gaps] li.conflict").length }; }, cell);
  check('t119u #3: every record question (A to D) offers "Skip for now"; none is required', offers.a && offers.b && offers.c && offers.d && offers.texts.length === 4 && offers.texts.every((t) => t === "Skip for now") && offers.req === 0, JSON.stringify(offers));
  check('t119u #3: skipping all four keeps the record as "Needs details" with four amber "Still needed (skipped for now)" notes, saved, and the gap list says "Still needed", not an error or conflict',
    st.badge === "Needs details" && st.notes.length === 4 && st.notes.every((n) => n.startsWith("Still needed (skipped for now): ")) && st.color === "rgb(107, 69, 0)" && JSON.stringify(st.skipped) === JSON.stringify(["fact", "docType", "mode", "citation"]) && st.kept
    && /^The record isn't finished\. Still needed/.test(st.gap) && st.conflictItems === 0 && !/error|invalid/i.test(st.gap), JSON.stringify(st));
  phase("load"); await page.goto(`${BASE}/tools/lineage-matrix/report/`); phase("interact");
  const rr = await page.evaluate(() => { const tr = document.querySelector("table.records tbody tr"); const t = document.querySelector("[data-report]").textContent;
    return { cells: tr ? [...tr.children].map((td) => td.textContent) : [], err: /\berror\b|invalid/i.test(t), conflict: /Conflict Flagged/.test(t) }; });
  check('t119u #3: the printable gap report shows each skipped answer as "Still needed" and the record as "Needs details", never an error', rr.cells.slice(0, 4).every((c) => c === "Still needed") && /Needs details/.test(rr.cells[4] || "") && !rr.err && !rr.conflict, JSON.stringify(rr));
  await page.evaluate(() => localStorage.removeItem("pi.toolB.v1")); }

// ---- t122u (Nov 9): warm booklet styling; WCAG AA contrast on every visible text element of every page ----
{ const css = readFileSync(join(ROOT, "src/assets/site.css"), "utf8");
  check("t122u: no outside fonts or services (no @import, @font-face or http URLs in the stylesheet)", !/@import|@font-face|url\(\s*["']?https?:/i.test(css));
  check("t122u: serif stack, warm page and card colors, warm charcoal text, navy headings", /--serif:"Iowan Old Style","Charter","Palatino Linotype","Palatino","Book Antiqua",Georgia,serif/.test(css) && /--bg:#faf7f0/.test(css) && /--card:#fffdf8/.test(css) && /--line:#e6ded0/.test(css) && /--ink:#2b2622/.test(css)); }
phase("load"); await page.goto(`${BASE}/`); phase("interact");
{ const h = await page.evaluate(() => { const h1 = document.querySelector("main h1"); const sr = h1.querySelector(".sr-only"); const vis = h1.querySelector("[data-subtitle]");
    return { h1s: document.querySelectorAll("main h1").length, sr: sr?.textContent || "", srHidden: sr ? sr.getBoundingClientRect().width <= 1 : false, vis: vis?.textContent || "", visH: vis ? vis.getBoundingClientRect().height : 0, title: document.title, rule: getComputedStyle(h1, "::after").backgroundColor, ruleW: getComputedStyle(h1, "::after").width }; });
  check("t122u #9/#8: the home page's one visible heading is the tagline; the site name is in the h1 for screen readers and in the title; a short red rule sits under it", h.h1s === 1 && /^Patriot, In Lay Terms/.test(h.sr) && h.srHidden && /^Plain-English help with DAR and SAR applications/.test(h.vis) && h.visH > 20 && /Patriot, In Lay Terms/.test(h.title) && h.rule === "rgb(178, 34, 52)" && parseFloat(h.ruleW) <= 80, JSON.stringify(h)); }
{ const pages = htmlFiles.map((f) => "/" + f.slice(DIST.length + 1).replace(/index\.html$/, "")).filter((u) => !u.endsWith("404.html"));
  const fails = []; let checked = 0; const mins = {};
  for (const u of pages) {
    phase("load"); await page.goto(`${BASE}${u}`); phase("interact");
    if (u.includes("lineage-matrix") && !u.includes("report")) await page.click("[data-ws-begin]").catch(() => {});
    const r = await page.evaluate(() => {
      const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } }
        let out = { r: 255, g: 255, b: 255 }; for (const c of stack.reverse()) out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a) }; return out; };
      const out = []; let n = 0; const mins = {};
      for (const el of document.querySelectorAll("body *")) {
        if (!["#text"].some(() => [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))) continue;
        if (el.closest(".sr-only,script,style,noscript")) continue; const rc = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (rc.width < 2 || rc.height < 2 || cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden]")) continue;
        const fg = parse(cs.color); const bg = bgOf(el); const fs = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
        const large = fs >= 24 || (bold && fs >= 18.66); const need = large ? 3 : 4.5; const r = ratio(fg, bg); n++;
        const key = `${cs.color} on rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`; if (!mins[key] || mins[key] > r) mins[key] = +r.toFixed(2);
        if (r < need) out.push(`${el.tagName.toLowerCase()}.${el.className}: ${r.toFixed(2)} (${key}, ${fs}px) "${el.textContent.trim().slice(0, 30)}"`); }
      return { out, n, mins }; });
    checked += r.n; for (const f of r.out) fails.push(`${u} ${f}`); for (const [k, v] of Object.entries(r.mins)) if (!mins[k] || mins[k] > v) mins[k] = v; }
  globalThis.__contrast = mins;
  check(`t122u #11: every visible text element on all ${pages.length} pages passes WCAG AA contrast (4.5:1, large text 3:1) — ${checked} elements`, fails.length === 0 && checked > 1000, fails.slice(0, 6).join(" | ")); }
{ // hover and focus states
  phase("load"); await page.goto(`${BASE}/`); phase("interact");
  await page.hover("main a.button-link"); await page.waitForTimeout(250);
  const bh = await page.evaluate(() => { const a = document.querySelector("main a.button-link"); const cs = getComputedStyle(a); return { bg: cs.backgroundColor, fg: cs.color, tf: cs.transform, sh: cs.boxShadow }; });
  await page.hover("main .guide-list a"); const lh = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector("main .guide-list a")); return { fg: cs.color, deco: cs.textDecorationLine }; });
  check("t122u #7: buttons darken and lift gently on hover (white on dark navy); links darken on hover and stay underlined", bh.bg === "rgb(11, 26, 51)" && bh.fg === "rgb(255, 255, 255)" && /matrix/.test(bh.tf) && bh.sh !== "none" && lh.fg === "rgb(11, 26, 51)" && /underline/.test(lh.deco), JSON.stringify({ bh, lh })); }

// ---- t123u (Nov 9): phone home heading; guide "Sources last checked" = oldest recorded pass among the page's own sources ----
{ const sizes = {};
  for (const w of [375, 390, 600, 1280]) { const c = await browser.newContext({ viewport: { width: w, height: 800 } }); const pg = await c.newPage(); phase("load"); await pg.goto(`${BASE}/`); phase("interact");
    sizes[w] = await pg.evaluate(() => { const s = document.querySelector("h1.home-h1 [data-subtitle]"); const cs = getComputedStyle(s); return { fs: parseFloat(cs.fontSize), lines: Math.round(s.getBoundingClientRect().height / parseFloat(cs.lineHeight)) }; });
    await c.close(); }
  globalThis.__homeHeading = sizes;
  check("t123u #1: on phones the home heading is about 25% smaller (24px -> 18px) and fits in at most 4 lines at 375px and 390px; 600px and wider unchanged (28.8px)",
    sizes[375].fs === 18 && sizes[390].fs === 18 && sizes[375].lines <= 4 && sizes[390].lines <= 4 && sizes[600].fs === 28.8 && sizes[1280].fs === 28.8, JSON.stringify(sizes)); }
{ const lp = JSON.parse(readFileSync(join(ROOT, "manifest/source-last-passed.json"), "utf8")).sources; const bad = []; const seen = [];
  for (const g of ["lineage-proof-roadmap", "substitute-evidence", "read-pension-file", "records-by-state", "bounty-land-warrants", "census-bridge", "patriotic-service", "same-name", "patriot-or-loyalist", "application-problems"]) {
    const h = readFileSync(join(DIST, "guides", g, "index.html"), "utf8"); const shown = (h.match(/Sources last checked (\d{4}-\d{2}-\d{2})/) || [])[1];
    const srcs = [...(h.match(/<h2 id="sources">Sources<\/h2><ol class="sources">([\s\S]*?)<\/ol>/) || ["", ""])[1].matchAll(/<span class="url">([^<]+)<\/span>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    const missing = srcs.filter((u) => !lp[u]); const oldest = srcs.map((u) => lp[u]).filter(Boolean).sort()[0]; const want = oldest ? new Date(oldest).toISOString().slice(0, 10) : null;
    seen.push(`${g}=${shown}`); if (!shown || !srcs.length || missing.length || shown !== want) bad.push(`${g}: shown ${shown}, oldest ${want}, missing ${missing.join(" ")}`); }
  check("t123u #2: each guide's 'Sources last checked' date is the oldest recorded live pass among its own listed sources (every source has a record; nothing invented)", bad.length === 0, bad.join(" | ") || seen.join(" ")); }

// ---- t124u (Nov 9): sources labels, AI disclosure page, privacy/FAQ/corrections copy, external links, dated rules, CT/GA/MA guidance ----
{ const staticPages = htmlFiles.map((f) => "/" + f.slice(DIST.length + 1).replace(/index\.html$/, "")).filter((u) => !u.endsWith("404.html"));
  const lp = JSON.parse(readFileSync(join(ROOT, "manifest/source-last-passed.json"), "utf8")).sources;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const longDate = (t) => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  const claimsById = new Map(JSON.parse(readFileSync(join(ROOT, "manifest/claims.json"), "utf8")).claims.map((c) => [c.claim_id, c]));
  const res = {};
  for (const w of [390, 1280]) {
    const c = await browser.newContext({ viewport: { width: w, height: 900 } }); const pg = await c.newPage(); const r = res[w] = { srcPages: 0, items: 0, badItems: [], ext: 0, badExt: [], internalTargets: [], overflow: [], footer: [] };
    for (const u of staticPages) {
      await pg.goto(`${BASE}${u}`);
      const x = await pg.evaluate(() => {
        const items = [...document.querySelectorAll("ol.sources > li")].map((li) => { const use = li.querySelector("[data-source-use]"); const url = li.querySelector(".url");
          return { use: use?.textContent || "", useShown: use ? getComputedStyle(use).display !== "none" && use.getBoundingClientRect().height > 0 : false, urlHidden: url ? getComputedStyle(url).display === "none" : false }; });
        const ext = [...document.querySelectorAll("a[href^='http']")].filter((a) => !/^https?:\/\/(www\.)?patriotinlays\.com/.test(a.href)).map((a) => { const i = a.querySelector("svg.ext-icon"); const s = a.querySelector(".sr-only");
          return { href: a.getAttribute("href"), target: a.target, rel: a.rel, icon: !!i && i.getAttribute("aria-hidden") === "true" && (a.getClientRects().length === 0 || i.getBoundingClientRect().width > 0), sr: s?.textContent === " (opens in new tab)" }; });
        const internal = [...document.querySelectorAll("a[href]")].filter((a) => /^(\/|#|mailto:)/.test(a.getAttribute("href")) && (a.target || a.querySelector(".ext-icon"))).map((a) => a.getAttribute("href"));
        const foot = [...document.querySelectorAll("footer.site a")].slice(0, 2).map((a) => `${a.textContent}=${a.getAttribute("href")}`).join(",");
        return { items, ext, internal, foot, overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }; });
      if (x.items.length) r.srcPages++;
      for (const it of x.items) { r.items++; const words = it.use.replace(/^Used for: /, "").replace(/\.$/, "").split(/\s+/).length;
        if (!/^Used for: .+\.$/.test(it.use) || words > 9 || !it.useShown || !it.urlHidden) r.badItems.push(`${u}: ${JSON.stringify(it)}`); }
      for (const e of x.ext) { r.ext++; if (e.target !== "_blank" || e.rel !== "noopener noreferrer" || !e.icon || !e.sr) r.badExt.push(`${u} ${e.href}`); }
      r.internalTargets.push(...x.internal.map((h) => `${u} ${h}`)); if (x.overflow) r.overflow.push(u); if (x.foot !== "About=/about/,AI disclosure=/ai-disclosure/") r.footer.push(`${u}: ${x.foot}`);
    }
    // Print: the raw URL shows under each source; the new-tab icon and its screen-reader text do not.
    await pg.goto(`${BASE}/guides/lineage-proof-roadmap/`); await pg.emulateMedia({ media: "print" });
    r.print = await pg.evaluate(() => ({ urls: [...document.querySelectorAll("ol.sources .url")].every((s) => getComputedStyle(s).display !== "none"), icons: [...document.querySelectorAll(".ext-icon")].every((i) => getComputedStyle(i).display === "none") }));
    await pg.emulateMedia({ media: "screen" });
    // Tool-rendered links (worksheet "Where to look") open in a new tab too; CT, GA and MA show Tim's sentences.
    await pg.goto(`${BASE}/tools/lineage-matrix/`);
    await pg.evaluate(() => localStorage.setItem("pi.toolB.v1", JSON.stringify({ version: 1, updated: new Date().toISOString(), generations: [{ gen: 1, living: true, born: "1950", state: "OH", cells: [] },
      { gen: 2, born: "1780", died: "1840", state: "CT", cells: [] }, { gen: 3, born: "1750", died: "1820", state: "GA", cells: [] }, { gen: 4, born: "1720", died: "1790", state: "MA", cells: [] }] })));
    await pg.reload();
    r.tool = await pg.evaluate(() => { const t = document.querySelector("[data-gaps]")?.textContent || ""; const links = [...document.querySelectorAll("[data-gaps] a[href^='http']")];
      return { t, n: links.length, ok: links.every((a) => a.target === "_blank" && a.rel === "noopener noreferrer" && a.querySelector("svg.ext-icon") && a.querySelector(".sr-only")?.textContent === " (opens in new tab)"),
        hrefs: links.map((a) => a.getAttribute("href")), overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }; });
    await pg.evaluate(() => localStorage.removeItem("pi.toolB.v1"));
    await c.close();
  }
  for (const w of [390, 1280]) { const r = res[w];
    check(`t124u #1 (${w}px): every Sources entry on every page (${r.srcPages} pages, ${r.items} entries) has a visible "Used for: ..." line of at most about 8 words, and the raw URL is hidden on screen`, r.srcPages >= 15 && r.badItems.length === 0, r.badItems.slice(0, 3).join(" | "));
    check(`t124u #1 (${w}px): in print the raw URLs show under each source and the new-tab icons do not`, r.print.urls && r.print.icons, JSON.stringify(r.print));
    check(`t124u #11 (${w}px): every link that leaves the site (${r.ext}) opens in a new tab with rel="noopener noreferrer", a small icon and "(opens in new tab)" for screen readers; no internal or email link does`, r.ext > 100 && r.badExt.length === 0 && r.internalTargets.length === 0, [...r.badExt, ...r.internalTargets].slice(0, 4).join(" | "));
    check(`t124u #2 (${w}px): every page's footer starts with two links, "About" and "AI disclosure"`, r.footer.length === 0, r.footer.slice(0, 3).join(" | "));
    check(`t124u (${w}px): no page scrolls sideways`, r.overflow.length === 0 && !r.tool.overflow, r.overflow.join(" "));
    check(`t124u #13 + #11 (${w}px): the worksheet's "Where to look" shows Tim's CT, GA and MA sentences and links their sources, and its outside links open in a new tab`,
      [claimsById.get("ct-vital-town-clerk"), claimsById.get("ct-vital-barbour"), claimsById.get("ga-vital-1919"), claimsById.get("ma-vital-1841-1920")].every((c) => r.tool.t.includes(c.claim_text))
      && !r.tool.t.includes("no verified source yet on when Massachusetts began keeping")
      && ["https://guides.loc.gov/connecticut-local-history-genealogy/vital-records", "https://georgiaarchives.org/research/vital_records", "https://www.mass.gov/guides/guide-to-genealogical-resources-in-the-state-library"].every((h) => r.tool.hrefs.includes(h)) && !r.tool.hrefs.some((h) => h.includes("sec.state.ma.us")) && r.tool.ok && r.tool.n > 0,
      JSON.stringify({ n: r.tool.n, ok: r.tool.ok }));
  }
  const H = (p) => readFileSync(join(DIST, p, "index.html"), "utf8"); const text = (p) => H(p).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "").replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const AI = "Written with AI assistance and reviewed by the site's owner. Each fact is tied to a quoted official source, and software checks that the quote is still there. The owner supervises the project, decides what goes on the site and reads the pages; the source check is what holds every fact to its quote.";
  check("t124u #2: a separate AI disclosure page carries the AI text unchanged; About no longer has it; guide top lines and the Sources page point to the AI disclosure", /<h1>AI disclosure<\/h1>/.test(H("ai-disclosure")) && text("ai-disclosure").includes(AI) && !/How AI is used/.test(H("about")) && !text("about").includes("The owner supervises the project")
    && /Sources last checked [^<]*· Written with AI; every fact is tied to a quoted official source \(<a href="\/ai-disclosure\/">how this works<\/a>\)/.test(H("guides/census-bridge")) && /See the <a href="\/ai-disclosure\/">AI disclosure<\/a>/.test(H("sources")) && !/About &amp; AI disclosure/.test(H("")));
  // ---- t125u ----
  check("t125u #2: 'often the chapter registrar' is gone from the home SAR line and the glossary (and every built page)", text("").includes("SAR's local sponsor can guide you through the application.") && !rd0(DIST, { recursive: true }).filter((f) => f.endsWith(".html")).some((f) => /often the chapter registrar/i.test(readFileSync(join(DIST, f), "utf8")))
    && /At SAR, your local contact guides you through the application and can review what you've gathered, and the chapter registrar receives the finished application to begin processing\./.test(text("")));
  check("t125u #1: About says the quote check runs each time the site is updated, and on a regular schedule (FAQ wording); 'when the site is built' is gone", text("about").includes("Each time the site is updated, and on a regular schedule, software checks that each quoted passage still appears in its source.") && !/when the site is built/i.test(text("about")));
  check("t125u #3 / t126u: the widow checker's storage note is Tim's text, preceded by 'Nothing is sent anywhere.' in the same paragraph, with no 'pi.toolA' key names", /<p class="small">Nothing is sent anywhere\. Your entries are saved only in this browser, and that storage isn't encrypted\. On a shared or public computer, use the delete button when you're done\.<\/p>/.test(H("tools/widow-pension-checker").replace(/&#39;|&apos;/g, "'")) && text("tools/widow-pension-checker").includes("Nothing is sent anywhere. Your entries are saved only in this browser, and that storage isn't encrypted. On a shared or public computer, use the delete button when you're done.") && !/pi\.tool/.test(text("tools/widow-pension-checker")));
  const priv = text("privacy");
  check("t124u #3/#4 / t132 #2: Privacy's 'collects' section is Tim's t132 sentence (one Cloudflare line), then the ads line, and the technical note has no storage key names", /What the site itself collects\s*We don't ask for, collect or store personal information through the website\. Cloudflare, which hosts the site, processes the technical information needed to deliver and protect it, and adds two small features: a script that hides email addresses from spam robots, and a short error report if a page fails to load\.\s*There are no ads at present\./.test(priv)
    && !/pi\.tool/.test(priv) && priv.includes("Your entries are saved only in this browser, and that storage isn't encrypted. On a shared or public computer, use the delete button when you're done.") && !/network-error report|Cloudflare's servers deliver/.test(priv));
  const faq = text("faq");
  check("t124u #5/#6/#7: the FAQ's genealogist answer, trust answer and intro use Tim's wording", faq.includes("That help comes with joining. Our guides can help you prepare: what records to gather and what questions to ask.") && !/often the chapter registrar/.test(faq.slice(faq.indexOf("Do I have to hire"), faq.indexOf("What does this site cost")))
    && faq.includes("Every factual statement is tied to a quoted passage from an official or institutional source. Each time the site is updated, and on a regular schedule, software checks that every quote still appears on its source page. Any statement that can't be matched is removed. Each page lists its sources at the bottom with the date each was last checked, and the Sources & Methodology page explains the method. The site is written with AI assistance and reviewed by its owner.")
    && faq.includes("If your question isn't here, a DAR or SAR chapter registrar is the best person to ask. To report a mistake on this site, use the Contact page."));
  const corr = "Each correction is checked against the cited source before the page is updated. Every suggestion is read, though not every one can be added.";
  check("t124u #8: About and Contact both have 'Corrections and suggestions' with the same wording", /<h2 id="corrections-and-suggestions">Corrections and suggestions<\/h2>/.test(H("about")) && /<h2 id="corrections-and-suggestions">Corrections and suggestions<\/h2>/.test(H("contact"))
    && text("about").includes(`If you find an error, or have an idea for a tool or guide that would help, please tell us through the Contact page. ${corr}`) && text("contact").includes(corr));
  const rm = H("guides/lineage-proof-roadmap"); const asof = [...rm.matchAll(/As of <span data-asof="([a-z0-9-]+)">([^<]+)<\/span>, (DAR|SAR) says/g)];
  const prac = (rm.match(/<h2 id="practical-details-people-miss">[\s\S]*?<\/p>/) || [""])[0];
  check("t124u #10: dated rules start 'As of <date>, DAR says' with the date of that source's last recorded pass (Roadmap 'Practical details' and the application guide)", (prac.match(/As of <span data-asof/g) || []).length === 4
    && [...asof, ...H("guides/application-problems").matchAll(/As of <span data-asof="([a-z0-9-]+)">([^<]+)<\/span>, (DAR|SAR) says/g)].every((m) => m[2] === longDate(lp[claimsById.get(m[1]).source_url])) && asof.length >= 6);
  check("t124u #9: Roadmap Step 0 reads 'Step 0: find your patriot's name' and 'If you don't know your patriot's name yet'; the old #step-0 link still lands there", /<h2 id="step-0-find-your-patriot-s-name">Step 0: find your patriot&#39;s name<\/h2>|<h2 id="step-0-find-your-patriot-s-name">Step 0: find your patriot's name<\/h2>/.test(rm)
    && text("guides/lineage-proof-roadmap").includes("If you don't know your patriot's name yet, start here.") && rm.includes('id="step-0-find-the-soldier-s-name"') && !/find the soldier/.test(H("")));
}

// ---- t127u: audit fixes (attribution, 1855 navy act, registrar phrase, About, worksheet start/confirm, Virginia scope, rule 7) ----
{
  const lp = JSON.parse(readFileSync(join(ROOT, "manifest/source-last-passed.json"), "utf8")).sources;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const longDate = (t) => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  const claimsAll = JSON.parse(readFileSync(join(ROOT, "manifest/claims.json"), "utf8")).claims;
  const H = (p) => readFileSync(join(DIST, p, "index.html"), "utf8"); const text = (p) => H(p).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "").replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ");
  const { readdirSync: rdT } = await import("node:fs");
  const pagesOf = (re) => rdT(DIST, { recursive: true }).filter((f) => re.test(f)).map((f) => [f, readFileSync(join(DIST, f), "utf8")]);
  const ap = text("guides/application-problems"), apH = H("guides/application-problems");
  const BAD = /\b(?:SAR|NSCDA)(?:'s)? (?:says|wants|lists|treats|notes|states|considers|rejects|advises|asks for|cites)\b|\bSAR:(?! the National)|\bNSCDA:(?! The National)|SAR presenters|under NSCDA rules|Listed by NSCDA|SAR's guidance|NSCDA's own example|NSCDA Standards of Proof\)/;
  const ohSentences = ["A 2023 Ohio Society SAR presentation said dates go in the form 01 Jan 2023", "A 2023 Ohio Society SAR presentation said applications pended for three years are withdrawn.", "A 2023 Ohio Society SAR presentation put it in capitals: always complete an application from the documentation.", "A 2023 Ohio Society SAR presentation said a correctly prepared application can be reviewed at National in as little as 30 minutes."];
  check("t127u #1: Application Returned attributes the Ohio points to 'A 2023 Ohio Society SAR presentation', never 'SAR says' or 'SAR:', and none of them carries an 'As of' date",
    ohSentences.every((x) => ap.includes(x)) && !/\bSAR says\b|SAR: (?!the National)/.test(ap) && ![...apH.matchAll(/data-asof="([a-z0-9-]+)"/g)].some((m) => m[1].startsWith("ohsar-")), ohSentences.filter((x) => !ap.includes(x)).join(" | "));
  check("t127u #1: SAR signatures come from SAR's national application checklist (members.sar.org), with an 'As of' date from its last pass",
    new RegExp(`As of <span data-asof="sar-checklist-signatures">${longDate(lp["https://members.sar.org/media/uploads/pages/334/wPXSPrcD0cuU.pdf"])}</span>, SAR(?:'|&#39;)s application checklist asks whether the State Registrar, State Secretary and two sponsors have signed a new-member application\\.`).test(apH.replace(/&apos;/g, "&#39;"))
    && apH.includes('href="https://members.sar.org/media/uploads/pages/334/wPXSPrcD0cuU.pdf"') && !/five signatures/.test(ap));
  const se = H("guides/substitute-evidence");
  check("t127u #1: Substitute Evidence opens its matrix with Tim's sentence, and the source is renamed 'NSCDA South Carolina Society — Standards of Proof (2025)'",
    /<h2 id="era-by-era-substitute-matrix">Era-by-era substitute matrix<\/h2>\s*<p>Many examples below come from one state society(?:'|&#39;)s standards \(NSCDA in South Carolina\)\. DAR and SAR apply their own standards, so ask your registrar\.<\/p>\s*(<div class="table-wrap[^>]*>)?\s*<table/.test(se.replace(/&apos;/g, "&#39;"))
    && se.includes("NSCDA South Carolina Society — Standards of Proof (2025)") && !/NSCDA \(South Carolina\) — Standards of Proof \(rev/.test(se));
  const affected = ["guides/application-problems", "guides/same-name", "guides/substitute-evidence", "guides/census-bridge", "tools/lineage-matrix"];
  const bad = affected.filter((p) => BAD.test(text(p)));
  check("t127u #1: Application Returned, Same Name, Substitute Evidence, Census Bridge and the Lineage Evidence Matrix never word the Ohio or South Carolina points as SAR-wide or NSCDA-wide rules", bad.length === 0, bad.join(" "));
  check("t127u #1: those pages use the honest attributions", text("guides/same-name").includes("A 2023 Ohio Society SAR presentation said") && /NSCDA's South Carolina society's standards (say|give)/.test(text("guides/same-name"))
    && text("guides/census-bridge").includes("NSCDA's South Carolina society's standards say they do not state relationships") && text("tools/lineage-matrix").includes("NSCDA's South Carolina society's standards say"));
  const ta = H("tools/widow-pension-checker"), rp = text("guides/read-pension-file");
  check("t127u #2: the navy-widow law is cited as the Act of February 28, 1855, ch. 126, sec. 3, 10 Stat. 616 on the widow checker and the Read a Pension File guide",
    text("tools/widow-pension-checker").includes("The Act of February 28, 1855 (ch. 126, sec. 3, 10 Stat. 616) did the same for widows of navy officers") && rp.includes("navy widows (Act of February 28, 1855, ch. 126, sec. 3, 10 Stat. 616)")
    && /Act of February 28, 1855, ch\. 126, sec\. 3 at 10 Stat\. 616, and Act of March 3, 1855 at 10 Stat\. 701/.test(H("guides/read-pension-file")));
  const s701 = pagesOf(/\.(html|js)$/).flatMap(([f, h]) => [...h.replace(/<[^>]+>/g, " ").matchAll(/.{0,160}10 Stat\. 701.{0,10}/g)].map((m) => [f, m[0]]));
  check(`t127u #2: every '10 Stat. 701' (${s701.length}) is the March 3, 1855 bounty-land act, never the navy-widow law`, s701.length > 0 && s701.every(([, c]) => /March( 3,)? 1855|bounty-land|Bounty-land/.test(c) && !/navy widows \(|February 28, 1855 \(/.test(c.slice(-60))), s701.filter(([, c]) => !/March|bounty/i.test(c)).map(([f]) => f).join(" "));
  // t128u #2: Tim restored exactly one sentence in the FAQ's genealogist answer; every other form stays gone.
  const TIM_REG = /SAR(?:'|&#39;|&apos;)s national site says your sponsor is often the local chapter registrar\./g;
  const reg = pagesOf(/\.(html|js)$/).filter(([, h]) => /often (?:the|a) (?:local )?(?:SAR )?chapter registrar/i.test(h.replace(TIM_REG, ""))).map(([f]) => f);
  const timRegAt = pagesOf(/\.(html|js)$/).flatMap(([f, h]) => (h.match(TIM_REG) || []).map(() => f));
  check("t127u #3 / t128u #2: 'often the chapter registrar' (any form) is gone from every built page and script except Tim's one FAQ sentence, and Patriotic Service keeps its sponsor line", reg.length === 0 && timRegAt.length === 1 && /^faq[\\/]index\.html$/.test(timRegAt[0]) && /next step is finding a sponsor near you/.test(text("guides/patriotic-service")), reg.concat(timRegAt).join(" "));
  const ab = text("about");
  check("t127u #4: About uses the FAQ wording ('each time the site is updated, and on a regular schedule') and spells out NSCDA on first use", ab.includes("Each time the site is updated, and on a regular schedule, software checks") && !/when the site is built/i.test(ab)
    && ab.indexOf("The National Society of the Colonial Dames of America (NSCDA)") > -1 && ab.indexOf("The National Society of the Colonial Dames of America (NSCDA)") <= ab.indexOf("NSCDA") - "The National Society of the Colonial Dames of America (".length);
  const rs = text("guides/records-by-state");
  check("t127u #6: Records by State makes the militia bounty-land sentence Virginia-specific (its source is the Library of Virginia)", rs.includes("Virginia gave no state bounty land for militia service.") && !/No state bounty land was given for militia service/.test(rs));
  for (const w of [390, 1280]) {
    const c = await browser.newContext({ viewport: { width: w, height: 900 } }); const pg = await c.newPage();
    await pg.goto(`${BASE}/tools/lineage-matrix/`);
    await pg.evaluate(() => localStorage.setItem("pi.toolB.v1", JSON.stringify({ version: 1, updated: new Date().toISOString(), generations: [{ gen: 1, living: true, cells: [] }, { gen: 2, cells: [] }, { gen: 3, born: "1750", cells: [{ fact: "birth", docType: "other", mode: "direct", citation: "family Bible page 2" }] }] })));
    await pg.reload();
    const step2 = (await pg.textContent("h3.step:nth-of-type(2), .tool h3.step >> nth=1")).replace(/\s+/g, " ").trim();
    const msgs = []; let answer = false;
    pg.on("dialog", async (d) => { msgs.push(d.message()); answer ? await d.accept() : await d.dismiss(); });
    const n0 = (await pg.evaluate(() => JSON.parse(localStorage.getItem("pi.toolB.v1")).generations.length));
    await pg.click("[data-remove-gen]"); await pg.waitForTimeout(150);
    const n1 = (await pg.evaluate(() => JSON.parse(localStorage.getItem("pi.toolB.v1")).generations.length));
    answer = true; await pg.click("[data-remove-gen]"); await pg.waitForTimeout(150);
    const n2 = (await pg.evaluate(() => JSON.parse(localStorage.getItem("pi.toolB.v1")).generations.length));
    check(`t127u #5 (${w}px): "Remove the oldest generation" asks "Remove this generation and its entries? This can't be undone."; Cancel keeps it, OK removes it`, msgs[0] === "Remove this generation and its entries? This can't be undone." && n0 === 3 && n1 === 3 && n2 === 2, JSON.stringify({ msgs, n0, n1, n2 }));
    check(`t127u #5 / t130 #2b (${w}px): the worksheet's starting point is consistent: step 1 is your patriot, step 2 'Generations' starts the family with yourself`, /^2 Generations$/.test(step2) && /Start with yourself, and go back one generation at a time\./.test(text("tools/lineage-matrix")) && /Start with your patriot/.test(text("tools/lineage-matrix")), step2);
    await c.close();
  }
  // ---- t128u ----
  const fq = text("faq"), fqH = H("faq");
  const gen = fq.slice(fq.indexOf("Do I have to hire a genealogist?"), fq.indexOf("What does this site cost"));
  check("t128u #2: the FAQ's genealogist answer has Tim's exact sentence, after the sponsor line, sourced to sar.org/how-to-apply",
    gen.includes("SAR's local sponsor can guide you through the application.") && /SAR's local sponsor can guide you through the application\.\s*(?:\[?\d+\]?\s*)?SAR's national site says your sponsor is often the local chapter registrar\./.test(gen.replace(/\s+/g, " "))
    && fqH.includes('href="https://www.sar.org/how-to-apply/"'), gen.slice(0, 400));
  check("t128u #3: supplemental signatures come from SAR's national application checklist with an 'As of' date; the Ohio two-signatures line is gone",
    new RegExp(`As of <span data-asof="sar-checklist-supp-sig">${longDate(lp["https://members.sar.org/media/uploads/pages/334/wPXSPrcD0cuU.pdf"])}</span>, SAR(?:'|&#39;)s application checklist asks whether the member and the State Registrar \\(or another designated officer\\) have signed a supplemental application on the back\\.`).test(apH.replace(/&apos;/g, "&#39;"))
    && !/supplemental applications need two signatures/.test(ap) && ap.includes("Except for the two signature checks from SAR's application checklist, these points come from a 2023 Ohio Society SAR presentation"));
  check("t128u #3: DAR record copies stay attributed to the Ohio presentation (DAR Library Lineage Resources doesn't say chapter copies are refused)",
    ap.includes("A 2023 Ohio Society SAR presentation said only DAR record copies are considered, not chapter copies"));
  const heldBad = pagesOf(/\.(html|js)$/).filter(([, h]) => /DAR says church records are usually acceptable|DAR lists probate, court and land records among the most common sources/.test(h)).map(([f]) => f);
  check("t128u #1: the t127 DAR-FAQ/Step-by-step rewordings are held back (DAR pages unreachable since their Nov 5 pass); the South Carolina attributions are back",
    heldBad.length === 0 && text("guides/substitute-evidence").includes("NSCDA's South Carolina society's standards list church birth, baptism, marriage, death and burial records")
    && text("guides/substitute-evidence").includes("Named heirs and children; NSCDA's South Carolina society's standards list these county court records")
    && text("guides/census-bridge").includes("NSCDA's South Carolina society's standards list wills, probate records, inventories, deeds and court orders among primary sources."), heldBad.join(" "));
  const { execFileSync: xT } = await import("node:child_process");
  const gateOut = xT("node", [join(ROOT, "scripts/check-manifest.mjs")], { encoding: "utf8" });
  check("t127u #7: every claim has a source scope tag, and the gate reports 0 society-wide wordings backed only by state, chapter-local or third-party sources", /Source scope \(rule 7\): 0 flagged/.test(gateOut) && claimsAll.every((c) => ["national", "state", "chapter-local", "third-party"].includes(c.source_scope)));
}

// ---- t130 #2: example-load confirmation and saved data unchanged (fresh browser context) ----
{ const cx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const pg = await cx.newPage();
  pg.on("pageerror", (e) => consoleErrors.push(`t130: ${e.message}`));
  const dialogs = []; let accept = false; pg.on("dialog", async (d) => { dialogs.push(d.message()); accept ? await d.accept() : await d.dismiss(); });
  // An older saved worksheet (3 generations, a named patriot, records, a skipped question) must load exactly as before.
  const saved = { version: 1, updated: "2026-11-01T12:00:00.000Z", patriot: { name: "Saved Patriot", state: "NC", unit: "", kind: "continental", start: "1776-02", end: "1779-06", gen: "3" },
    generations: [{ gen: 1, who: "Saved Me", living: true, born: "1960", died: "", state: "NC", cells: [{ id: "s1", fact: "birth", docType: "birth_cert_long", mode: "direct", conflict: false, citation: "My certificate" }] },
      { gen: 2, who: "Saved Parent", living: false, born: "1930", died: "2001", state: "NC", cells: [{ id: "s2", fact: "parentage", docType: "probate", mode: "", conflict: true, citation: "", skipped: ["mode"] }] },
      { gen: 3, who: "Saved Patriot", living: false, born: "1750", died: "1820", state: "NC", cells: [] }] };
  await pg.goto(`${BASE}/tools/lineage-matrix/`); await pg.evaluate((d) => localStorage.setItem("pi.toolB.v1", JSON.stringify(d)), saved);
  const raw0 = await pg.evaluate(() => localStorage.getItem("pi.toolB.v1"));
  await pg.reload();
  const sv = await pg.evaluate(() => ({ raw: localStorage.getItem("pi.toolB.v1"), gens: [...document.querySelectorAll("details.gen-d")].map((d) => `${d.dataset.gen}:${d.open ? "open" : "closed"}`).join(","),
    who: [1, 2, 3].map((g) => document.querySelector(`#who-${g}`)?.value).join("|"), pat: document.querySelector("#pat-name")?.value, begin: document.querySelector("[data-ws-begin-wrap]")?.hidden, body: document.querySelector("[data-ws-body]")?.hidden,
    conflictOpen: document.querySelector('[data-cell="s2"] details.more-details')?.open, conflict: document.querySelector('[data-cell="s2"] input[name=conflict]')?.checked, skip: document.querySelector('[data-cell="s2"] input[data-skip="mode"]')?.checked, cite: document.querySelector('[data-cell="s1"] input[name=citation]')?.value }));
  check("t130 #2d: an older saved worksheet loads exactly as before: storage unchanged, all 3 generations and every entry shown (newest open, flagged record's More details open)", sv.raw === raw0 && sv.gens === "1:closed,2:closed,3:open" && sv.who === "Saved Me|Saved Parent|Saved Patriot" && sv.pat === "Saved Patriot" && sv.begin === true && sv.body === false && sv.conflictOpen === true && sv.conflict === true && sv.skip === true && sv.cite === "My certificate", JSON.stringify({ ...sv, raw: sv.raw === raw0 }));
  // "See a filled-in example" with saved entries asks first; Cancel keeps everything.
  await pg.click("[data-load-example]");
  const raw1 = await pg.evaluate(() => localStorage.getItem("pi.toolB.v1"));
  check("t130 #2a: with saved entries, 'See a filled-in example' first asks \"Loading the example replaces your current entries. Continue?\"; Cancel changes nothing", dialogs[0] === "Loading the example replaces your current entries. Continue?" && raw1 === raw0 && (await pg.inputValue("#who-1")) === "Saved Me", JSON.stringify(dialogs));
  accept = true; await pg.click("[data-load-example]");
  const ex = await pg.evaluate(() => ({ gens: JSON.parse(localStorage.getItem("pi.toolB.v1")).generations.length, pat: document.querySelector("#pat-name")?.value }));
  check("t130 #2a: OK loads the example (5 made-up generations)", dialogs.length === 2 && ex.gens === 5 && /made up/.test(ex.pat), JSON.stringify(ex));
  // A fresh browser: the example loads without a question (nothing to replace), and the two start buttons sit at the top of the tool.
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); const n0 = dialogs.length;
  const top = await pg.evaluate(() => { const t = document.querySelector('[data-tool="lineage-matrix"]'); const kids = [...t.children].map((k) => k.matches("[data-purpose]") ? "purpose" : k.matches(".howto") ? "howto" : k.matches("[data-ws-start]") ? "start" : k.matches("[data-ws-body]") ? "body" : "");
    return { order: kids.filter(Boolean).join(","), b1: t.querySelector("[data-ws-begin]")?.textContent, b2: t.querySelector("[data-load-example]")?.textContent, rec: t.querySelector(".ws-rec")?.textContent, limitsAbove: !!document.querySelector("main") && document.querySelector("main").textContent.indexOf("What it does.") < document.querySelector("main").textContent.indexOf("Start with just the patriot and me") }; });
  check("t130 #2a: at the top of the tool (after the purpose line and 'What it does' box), two buttons: 'Start with just the patriot and me' (Recommended) and 'See a filled-in example'", top.order === "purpose,howto,start,body" && top.b1 === "Start with just the patriot and me" && top.b2 === "See a filled-in example" && top.rec === "Recommended" && top.limitsAbove, JSON.stringify(top));
  await pg.click("[data-load-example]");
  check("t130 #2a: on a fresh browser the example loads without a question", dialogs.length === n0 && (await pg.evaluate(() => JSON.parse(localStorage.getItem("pi.toolB.v1")).generations.length)) === 5);
  // Remove the oldest generation still asks; a single generation (you) can't be removed.
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.click("[data-ws-begin]"); await pg.click("[data-add-gen]"); accept = false; await pg.click("[data-remove-gen]");
  const keep = await pg.evaluate(() => document.querySelectorAll("details.gen-d").length); accept = true; await pg.click("[data-remove-gen]");
  const after1 = await pg.evaluate(() => document.querySelectorAll("details.gen-d").length); const nD = dialogs.length; await pg.click("[data-remove-gen]");
  check("t130 #2d: 'Remove the oldest generation' still asks first (Cancel keeps it, OK removes it), and generation 1 (you) is never removed", keep === 2 && after1 === 1 && dialogs.length === nD && (await pg.evaluate(() => document.querySelectorAll("details.gen-d").length)) === 1 && dialogs.at(-1) === "Remove this generation and its entries? This can't be undone.", JSON.stringify({ keep, after1 }));
  for (const w of [390, 1280]) { await pg.setViewportSize({ width: w, height: 900 }); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.click("[data-load-example]");
    const o = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); await pg.evaluate(() => document.querySelector('[data-group="generations"]').scrollIntoView()); await pg.screenshot({ path: join(SHOTS, `t130-worksheet-${w}.png`) });
    check(`t130 #2 (${w}px): the worksheet with collapsed generations has no horizontal overflow`, o.sw <= o.iw + 1, JSON.stringify(o)); }
  await cx.close(); }
// ---- t130 #4: both printable reports hide the menu, footer and buttons; the to-do list prints in readable dark text ----
{ const cx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await cx.newPage(); pg.on("dialog", (d) => d.accept());
  await pg.goto(`${BASE}/tools/widow-pension-checker/`); await pg.click("[data-load-example]");
  await pg.goto(`${BASE}/tools/lineage-matrix/`); await pg.click("[data-load-example]");
  const out = {};
  for (const [name, url] of [["widow", "/tools/widow-pension-checker/report/"], ["worksheet", "/tools/lineage-matrix/report/"]]) {
    await pg.goto(BASE + url); await pg.emulateMedia({ media: "print" });
    out[name] = await pg.evaluate(() => { const hidden = (e) => !e.checkVisibility();
      const chrome = [...document.querySelectorAll("header.site, footer.site, nav, main button, main a.button-link")];
      const items = [...document.querySelectorAll("[data-report] .plan-steps > li, [data-report] .plan-sub > li")];
      const fs = items.map((li) => parseFloat(getComputedStyle(li).fontSize)); const col = items.map((li) => getComputedStyle(li).color);
      return { chrome: chrome.length, shown: chrome.filter((e) => !hidden(e)).map((e) => e.tagName + (e.textContent || "").trim().slice(0, 30)), items: items.length, minFont: Math.min(...fs), colors: [...new Set(col)] }; });
    await pg.emulateMedia({ media: "screen" }); }
  const dark = (c) => { const m = c.match(/\d+/g).map(Number); return m[0] < 90 && m[1] < 90 && m[2] < 110; };
  check("t130 #4: both printable reports hide the menu, footer and every button when printed", out.widow.chrome >= 3 && out.widow.shown.length === 0 && out.worksheet.chrome >= 3 && out.worksheet.shown.length === 0, JSON.stringify({ w: out.widow.shown, m: out.worksheet.shown }));
  check("t130 #4: the printed to-do list (What to do next) is at least 12px and in dark ink on both reports", out.widow.items > 0 && out.worksheet.items > 0 && out.widow.minFont >= 12 && out.worksheet.minFont >= 12 && [...out.widow.colors, ...out.worksheet.colors].every(dark), JSON.stringify({ w: [out.widow.items, out.widow.minFont, out.widow.colors], m: [out.worksheet.items, out.worksheet.minFont, out.worksheet.colors] }));
  await cx.close(); }
// ---- t130 #5: real M804 page in the pension-file guide: self-hosted, under 150 KB, alt text, caption naming the NARA file, 3 labels inside the image ----
{ const imgBytes = statSync(join(DIST, "assets/archives/m804-w14734-daniels-brief.jpg")).size;
  for (const w of [390, 1280]) { const cx = await browser.newContext({ viewport: { width: w, height: 900 } }); const pg = await cx.newPage();
    await pg.goto(`${BASE}/guides/read-pension-file/`); await pg.locator("figure.archive-fig").scrollIntoViewIfNeeded(); await pg.waitForFunction(() => document.querySelector("figure.archive-fig img").complete);
    const f = await pg.evaluate(() => { const fig = document.querySelector('figure.archive-fig[data-archive-fig="m804-daniels"]'); const img = fig.querySelector("img"); const ib = img.getBoundingClientRect();
      const marks = [...fig.querySelectorAll(".af-n")].map((m) => { const b = m.getBoundingClientRect(); return b.left >= ib.left - 1 && b.right <= ib.right + 1 && b.top >= ib.top - 1 && b.bottom <= ib.bottom + 1; });
      return { src: img.getAttribute("src"), nat: img.naturalWidth, alt: img.alt, cap: fig.querySelector("figcaption").textContent, keys: [...fig.querySelectorAll(".af-key li")].map((l) => l.textContent), marks, sw: document.documentElement.scrollWidth, iw: innerWidth,
        afterList: !!fig.previousElementSibling && fig.previousElementSibling.tagName === "OL" }; });
    check(`t130 #5 (${w}px): the pension-file guide shows the self-hosted M804 page (under 150 KB) with alt text, 3 numbered labels inside the image, and a caption naming the NARA file and identifier`,
      /^\/assets\/archives\/m804-w14734-daniels-brief\.jpg/.test(f.src) && f.nat === 700 && imgBytes < 150 * 1024 && f.alt.length > 80 && /Dolly Foss/.test(f.alt) && /W\. 14,734, Jacob Daniels, N\.H\./.test(f.cap) && /M804/.test(f.cap) && /National Archives Identifier 54368689/.test(f.cap) && /4156793_00373\.jpg/.test(f.cap)
      && f.keys.length === 3 && /^Names/.test(f.keys[0]) && /^Dates/.test(f.keys[1]) && /^Service/.test(f.keys[2]) && f.marks.length === 3 && f.marks.every(Boolean) && f.sw <= f.iw && f.afterList, JSON.stringify({ imgBytes, ...f, alt: f.alt.length }));
    await cx.close(); } }
const { readdirSync: rd132 } = await import("node:fs");
// ---- t132 #1: guide and tool pages: glossary collapsed under "Terms used on this page" (opens on tap, expanded in print); home glossary open ----
{ const pages = rd132(join(DIST, "guides")).map((g) => `/guides/${g}/`).concat(["/tools/widow-pension-checker/", "/tools/lineage-matrix/"]);
  const bad = pages.filter((p) => { const h = readFileSync(join(DIST, p, "index.html"), "utf8"); const m = h.match(/<details class="defs" data-defs>(<summary>[^<]*<\/summary>)/g) || [];
    return m.length !== 1 || !m[0].includes("<summary>Terms used on this page</summary>"); });
  check(`t132 #1: every guide and tool page (${pages.length}) has exactly one closed 'Terms used on this page' glossary`, pages.length >= 12 && bad.length === 0, bad.join(","));
  for (const w of [390, 1280]) { const cx = await browser.newContext({ viewport: { width: w, height: 900 } }); const pg = await cx.newPage(); const r = {};
    for (const p of ["/guides/read-pension-file/", "/tools/lineage-matrix/"]) { await pg.goto(BASE + p);
      const st = () => pg.evaluate(() => { const d = document.querySelector("details.defs"); return { open: d.open, sum: d.querySelector("summary").textContent, termVis: d.querySelector("li").checkVisibility(), sw: document.documentElement.scrollWidth, iw: innerWidth }; });
      const a = await st(); await pg.locator("details.defs > summary").scrollIntoViewIfNeeded(); await pg.click("details.defs > summary"); const b = await st();
      await pg.click("details.defs > summary"); await pg.emulateMedia({ media: "print" }); const c = await st(); await pg.emulateMedia({ media: "screen" });
      r[p] = { closedByDefault: !a.open && !a.termVis, opensOnTap: b.open && b.termVis, printExpanded: !c.open && c.termVis, sum: a.sum, fits: a.sw <= a.iw && b.sw <= b.iw }; }
    await pg.goto(BASE + "/"); const home = await pg.evaluate(() => { const g = document.querySelector(".glossary"); return { inDetails: !!g.closest("details"), vis: g.querySelector("li").checkVisibility(), noDefs: !document.querySelector("details.defs") }; });
    if (w === 390) { await pg.goto(BASE + "/guides/read-pension-file/"); await pg.click("details.defs > summary"); await pg.locator("details.defs").screenshot({ path: join(SHOTS, `t132-terms-${w}.png`) }); }
    check(`t132 #1 (${w}px): glossary on a guide and a tool page is closed by default, opens on tap, prints expanded; home glossary stays open`, Object.values(r).every((x) => x.closedByDefault && x.opensOnTap && x.printExpanded && x.sum === "Terms used on this page" && x.fits) && !home.inDetails && home.vis && home.noDefs, JSON.stringify({ r, home }));
    await cx.close(); } }
// ---- t132 #2 / #3: privacy wording; no "collects nothing" anywhere; $100 SAR fee claim gone ----
{ const all = (function walk(d) { return rd132(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".html") ? [join(d, e.name)] : []); })(DIST);
  const text = (p) => readFileSync(join(DIST, p, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "").replace(/&#39;|&apos;|&#x27;|&rsquo;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const priv = text("privacy");
  check("t132 #2: privacy page has Tim's exact sentence, keeps the ads line, and the old 'collects nothing' and 'Like any web host' sentences are gone", priv.includes("We don't ask for, collect or store personal information through the website. Cloudflare, which hosts the site, processes the technical information needed to deliver and protect it, and adds two small features: a script that hides email addresses from spam robots, and a short error report if a page fails to load.") && /There are no ads at present\./.test(priv) && !/collects nothing/i.test(priv) && !/Like any web host/.test(priv));
  const hits = all.filter((f) => /collects? nothing|collect nothing|nothing is collected/i.test(readFileSync(f, "utf8")));
  check("t132 #2: no built page says the site 'collects nothing'", hits.length === 0, hits.join(","));
  const ap = text("guides/application-problems"); const claims = JSON.parse(readFileSync(join(ROOT, "manifest/claims.json"), "utf8")); const ids = JSON.stringify(claims);
  check("t132 #3: Application Returned keeps the attributed non-refundable line, follows it with 'Confirm current fees with your registrar.', and '$100' and ohsar-fee are gone (page and manifest)", /A 2023 Ohio Society SAR presentation said application fees are non-refundable\.\s*\S*\s*Confirm current fees with your registrar\./.test(ap) && !ap.includes("$100") && !all.some((f) => readFileSync(f, "utf8").includes("$100")) && !ids.includes('"ohsar-fee"') && ids.includes('"ohsar-nonrefundable"'), ap.match(/non-refundable.{0,80}/)?.[0]); }
// ---- t130 #1 / #3: home start cards, spacing, guide titles, menu (390px and 1280px) ----
{ const hH = readFileSync(join(DIST, "index.html"), "utf8");
  for (const w of [390, 1280]) { const cx = await browser.newContext({ viewport: { width: w, height: 900 } }); const pg = await cx.newPage(); await pg.goto(`${BASE}/`);
    const h = await pg.evaluate(() => { const main = document.querySelector("main .wrap"); const kids = [...main.children];
      const idx = (sel) => kids.findIndex((k) => k.matches(sel));
      const cards = [...document.querySelectorAll("[data-start-card]")].map((c) => { const r = c.getBoundingClientRect(); const a = c.querySelector("a.button-link"); const cs = getComputedStyle(a);
        return { title: c.querySelector("h2")?.textContent, line: c.querySelector("p")?.textContent, btn: a?.textContent, href: a?.getAttribute("href"), top: Math.round(r.top), left: Math.round(r.left), bg: cs.backgroundColor, color: cs.color, cardBg: getComputedStyle(c).backgroundColor }; });
      const gt = document.querySelector(".home-guides a.guide-title"), gd = document.querySelector(".home-guides .small");
      const nav = document.querySelector("nav.top"); const navLinks = [...nav.querySelectorAll("a")]; const hs = getComputedStyle(document.querySelector("header.site"));
      return { order: [idx("h1"), idx("[data-independent]"), idx("[data-home-intro]"), idx("[data-start-cards]"), idx("[data-see-how]"), idx("[data-mission]"), idx("#guides")], intro: document.querySelector("[data-home-intro]")?.textContent, cards,
        seeHow: [document.querySelector("[data-see-how] a")?.textContent, document.querySelector("[data-see-how] a")?.getAttribute("href")], oldBox: !!document.querySelector("[data-get-started]") || /Ready to get started\?/.test(document.body.textContent),
        guideTitle: [getComputedStyle(gt).fontWeight, parseFloat(getComputedStyle(gt).fontSize)], guideDesc: [getComputedStyle(gd).fontWeight, parseFloat(getComputedStyle(gd).fontSize)],
        navVisible: navLinks.every((a) => a.offsetParent !== null && a.getBoundingClientRect().right <= innerWidth + 1), navColor: getComputedStyle(navLinks[0]).color, headerBg: hs.backgroundColor, sw: document.documentElement.scrollWidth,
        gap: Math.round(document.querySelector("#guides").getBoundingClientRect().top - document.querySelector("[data-mission]").getBoundingClientRect().bottom) }; });
    const want = [["Build your to-do list", "Enter the records you already have. The worksheet shows what's still missing for each generation and where to look.", "Open the Lineage Evidence Matrix", "/tools/lineage-matrix/"],
      ["Check a widow's pension", "Compare a widow's marriage date and her husband's service with each federal widow pension law.", "Open the Widow Pension Law Checker", "/tools/widow-pension-checker/"],
      ["Read the full plan", "A generation-by-generation roadmap for DAR and SAR applications.", "Open the Roadmap guide", "/guides/lineage-proof-roadmap/"]];
    const textOk = h.cards.length === 3 && h.cards.every((c, i) => c.title === want[i][0] && c.line === want[i][1] && c.btn === want[i][2] && c.href === want[i][3]);
    const layout = w < 760 ? h.cards.every((c, i) => i === 0 || (c.top > h.cards[i - 1].top && c.left === h.cards[0].left)) : h.cards.every((c) => c.top === h.cards[0].top) && h.cards[1].left > h.cards[0].left;
    check(`t130 #1 (${w}px): under the heading and independent line, Tim's sentence, then the three start cards (${w < 760 ? "stacked" : "side by side"}) with his exact titles, lines and navy buttons, then 'See how the tools work', then the longer paragraphs; the 'Ready to get started?' box is gone`,
      h.intro === "Two free tools and ten guides help you organize what you have and see what's still missing. What you type into the tools stays in your own browser." && h.order.every((x, i) => x >= 0 && (i === 0 || x > h.order[i - 1])) && textOk && layout && h.seeHow[0] === "See how the tools work" && h.seeHow[1] === "/walkthroughs/" && !h.oldBox && h.sw <= w + 1, JSON.stringify({ order: h.order, cards: h.cards.map((c) => [c.top, c.left]), seeHow: h.seeHow, oldBox: h.oldBox }));
    check(`t130 #3 (${w}px): start cards have a soft warm background and navy buttons with white text`, h.cards.every((c) => c.bg === "rgb(19, 41, 75)" && c.color === "rgb(255, 255, 255)" && c.cardBg !== "rgba(0, 0, 0, 0)" && c.cardBg !== "rgb(255, 255, 255)"), JSON.stringify(h.cards.map((c) => [c.bg, c.color, c.cardBg])));
    check(`t130 #3 (${w}px): home guide titles are bolder and larger than their descriptions; more space between sections`, +h.guideTitle[0] >= 700 && +h.guideTitle[0] > +h.guideDesc[0] && h.guideTitle[1] > h.guideDesc[1] && h.gap >= 40, JSON.stringify({ t: h.guideTitle, d: h.guideDesc, gap: h.gap }));
    check(`t130 #3 (${w}px): the top menu is fully visible (wraps, never hidden) in white on navy`, h.navVisible && h.navColor === "rgb(255, 255, 255)" && h.headerBg === "rgb(19, 41, 75)", JSON.stringify({ nav: h.navVisible, c: h.navColor, bg: h.headerBg }));
    await pg.screenshot({ path: join(SHOTS, `t130-home-${w}.png`) }); await cx.close(); }
  const aiLine = "Written with AI assistance and reviewed by the site's owner. Each fact is tied to a quoted official source, and software checks that the quote is still there.";
  check("t130: the home AI line and the locked SAR line are unchanged, word for word", hH.replace(/&#39;|&apos;/g, "'").includes(aiLine) && hH.replace(/&#39;|&apos;/g, "'").includes("SAR's local sponsor can guide you through the application.")); }
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
writeFileSync(join(ROOT, "qa/e2e-results.json"), JSON.stringify({ ranAt: new Date().toString(), browser: `${CHROME || "playwright Chromium"} (headless) via playwright-core ${require("playwright-core/package.json").version}`, passed, total: results.length, exampleReportPages: globalThis.__reportPages || null, contrastMinByPair: globalThis.__contrast || null, home: globalThis.__home || null, results, requestsTotal: requests.length, externalRequests: external.length, interactionRequests: duringInteraction.length, faviconLate }, null, 2));
console.log(`\nE2E: ${passed}/${results.length} checks passed.`);
process.exit(passed === results.length ? 0 : 1);
