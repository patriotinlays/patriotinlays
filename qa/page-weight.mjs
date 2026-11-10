// Page weight: bytes transferred (uncompressed bodies, as served from dist/) for the home page and the worksheet.
// Usage: node qa/page-weight.mjs [label]  -> prints JSON. Serves dist/ on 127.0.0.1:8766.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const DIST = new URL("../dist", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
const server = createServer((req, res) => { let f = join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise((r) => server.listen(8766, "127.0.0.1", r));
const CHROME = existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined;
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const out = { label: process.argv[2] || "", pages: {} };
for (const p of ["/", "/tools/lineage-matrix/", "/guides/read-pension-file/"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage();
  const files = new Map();
  pg.on("response", async (r) => { try { const b = await r.body(); files.set(r.url(), b); } catch {} });
  await pg.goto("http://127.0.0.1:8766" + p, { waitUntil: "networkidle" });
  let raw = 0, gz = 0; for (const b of files.values()) { raw += b.length; gz += gzipSync(b).length; }
  out.pages[p] = { requests: files.size, bytes: raw, gzipBytes: gz };
  await ctx.close();
}
await browser.close(); server.close();
console.log(JSON.stringify(out));
