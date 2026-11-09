// Refreshes the job-aid evidence: runs the real tools on the built dist/ and records exactly what they show.
// Run after `npm run build:pages` (or any build) when a tool's wording or layout changes.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright-core");
const ROOT = new URL("..", import.meta.url).pathname, D = join(ROOT, "dist"), OUT = join(ROOT, "qa/walkthroughs");
mkdirSync(OUT, { recursive: true });
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const sv = createServer((q, r) => { let f = join(D, decodeURIComponent(q.url.split("?")[0])); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": T[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); });
await new Promise((r) => sv.listen(8767, "127.0.0.1", r)); const B = "http://127.0.0.1:8767";
const CHROME = process.env.CHROME_PATH || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
const b = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 1000 } });
const out = {};
await p.goto(B + "/tools/widow-pension-checker/"); await p.click("[data-load-example]");
out.widow = { form: await p.evaluate(() => Object.fromEntries(new FormData(document.querySelector("form[data-form=widow]")))),
  exampleMsg: await p.textContent("[data-example-msg]"),
  summary: await p.$$eval("[data-answer] li", (xs) => xs.map((x) => x.textContent)),
  rows: await p.$$eval("[data-out=widow] tbody tr", (trs) => trs.map((tr) => ({ law: tr.cells[0].textContent, verdict: tr.cells[1].querySelector(".badge").textContent, rule: tr.cells[2].textContent }))),
  plan: await p.$$eval('[data-tool="widow"] [data-plan] .plan-steps > li', (xs) => xs.map((x) => x.innerText.replace(/\n+/g, " "))) };
await p.goto(B + "/tools/lineage-matrix/"); await p.click("[data-load-example]");
out.worksheet = { patriot: await p.evaluate(() => ({ name: document.getElementById("pat-name").value, state: document.getElementById("pat-state").value, unit: document.getElementById("pat-unit").value, kind: document.getElementById("pat-kind").value, start: document.getElementById("pat-start-value").value, end: document.getElementById("pat-end-value").value, gen: document.getElementById("pat-gen").value })),
  dateCheck: await p.textContent("[data-patriot-check]"),
  generations: await p.$$eval("[data-gen]", (xs) => xs.map((x) => ({ gen: x.dataset.gen, who: x.querySelector("input").value, born: x.querySelector("[name=born]")?.value, died: x.querySelector("[name=died]")?.value }))),
  gaps: await p.$$eval("[data-gaps] .gap-items > li", (xs) => xs.map((x) => x.innerText.replace(/\n+/g, " "))),
  where: await p.$$eval("[data-gaps] .where-block", (xs) => xs.map((x) => x.innerText.replace(/\n+/g, " "))),
  plan: await p.$$eval('[data-tool="lineage-matrix"] [data-plan] .plan-steps > li', (xs) => xs.map((x) => x.innerText.replace(/\n+/g, " "))) };
writeFileSync(join(OUT, "outputs.json"), JSON.stringify(out, null, 2));
// Quotable output text: the only strings a ::quote on the walkthrough page may use.
const texts = [...out.widow.summary, ...out.widow.rows.map((r) => r.verdict),
  "Dates fit DAR's period for this service (not a ruling)",
  "Your patriot's dates fall inside the period DAR accepts for this type of service. This is not a ruling: your society decides.",
  ...out.worksheet.gaps.map((g) => g.replace(/\s*\+ Add.*$/, "").trim())];
writeFileSync(join(OUT, "texts.json"), JSON.stringify({ texts: [...new Set(texts)].sort() }, null, 2));
for (const [name, url, sel] of [
  ["widow-summary", "/tools/widow-pension-checker/", "[data-answer]"],
  ["widow-law-row", "/tools/widow-pension-checker/", "[data-out=widow] tbody tr:nth-child(6)"],
  ["worksheet-gaps", "/tools/lineage-matrix/", "[data-gaps] .gaps"],
  ["widow-date-360", "/tools/widow-pension-checker/", "#tw-m"],
  ["worksheet-patriot-360", "/tools/lineage-matrix/", "[data-patriot-form]"],
]) {
  const mobile = name.endsWith("360");
  const w = await b.newPage({ viewport: mobile ? { width: 360, height: 800 } : { width: 1200, height: 1400 } });
  await w.goto(B + url); await w.click("[data-load-example]");
  await (await w.$(sel)).screenshot({ path: join(OUT, `${name}.png`) }); await w.close();
}
await b.close(); sv.close(); console.log(`Captured ${texts.length} quotable outputs and 5 screenshots in qa/walkthroughs/`);
