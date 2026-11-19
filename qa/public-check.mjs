// Public check of the live site with the Cloudflare Web Analytics beacon blocked (t191 #3), so checks are never counted as visits.
// Usage: node qa/public-check.mjs [baseUrl] [path ...]   -> prints PASS/FAIL per page and width, then beacon stats.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { blockBeacon, isBeacon, blocked } from "./lib/block-beacon.mjs";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] || "https://patriotinlays.com";
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ["/", "/privacy/", "/faq/", "/tools/lineage-matrix/", "/tools/widow-pension-checker/", "/walkthroughs/"];
const CHROME = process.env.CHROME_PATH || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
const browser = blockBeacon(await chromium.launch({ executablePath: CHROME }));
const reached = []; let fails = 0;
for (const w of [390, 1280]) {
  const cx = await browser.newContext({ viewport: { width: w, height: 900 } }); const pg = await cx.newPage(); const errs = [];
  pg.on("requestfinished", (r) => { if (isBeacon(r.url())) reached.push(r.url()); });
  pg.on("pageerror", (e) => errs.push(String(e)));
  for (const p of paths) {
    const res = await pg.goto(`${BASE}${p}${p.includes("?") ? "&" : "?"}cb=${Date.now()}`, { waitUntil: "networkidle" });
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const ok = res.status() === 200 && ov <= 0; if (!ok) fails++;
    console.log(`${ok ? "PASS" : "FAIL"} ${w}px ${p} status=${res.status()} overflow=${ov}`);
  }
  console.log(`${errs.length ? "FAIL" : "PASS"} ${w}px page errors: ${errs.length}`); if (errs.length) fails++;
  await cx.close();
}
await browser.close();
console.log(`Beacon: ${blocked.length} request(s) aborted, ${reached.length} reached Cloudflare.`); if (reached.length) fails++;
console.log(`public-check fails=${fails}`); process.exit(fails ? 1 : 0);
