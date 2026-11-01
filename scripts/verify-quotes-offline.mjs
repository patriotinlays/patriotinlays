// Offline pre-check: verifies each manifest quote against locally cached source copies (dir given as argv[2]).
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { norm, normJoin, stripHtml } from "./lib/normalize.mjs";
const dir = process.argv[2]; const m = JSON.parse(readFileSync(new URL("../manifest/claims.json", import.meta.url)));
const map = JSON.parse(execFileSync("python3", ["-c", `import json;exec(open('${new URL("../manifest/src/sources.py", import.meta.url).pathname}').read());print(json.dumps({v[0]:v[2] for v in SOURCES.values()}))`]).toString());
const cache = {}; let bad = 0;
for (const c of m.claims) {
  const f = `${dir}/${map[c.source_url]}`;
  if (!cache[f]) cache[f] = !existsSync(f) ? null : f.endsWith(".pdf") ? norm(execFileSync("pdftotext", ["-layout", f, "-"], { maxBuffer: 256e6 }).toString()) : norm(stripHtml(readFileSync(f, "utf8")));
  if (cache[f] == null) { console.log("NO FILE", f); bad++; continue; }
  // Scanned statute volumes (llsl-*.pdf) are also read in reading order with rejoined hyphens, as in check-manifest.mjs.
  if (!cache[f].includes(norm(c.quote_excerpt)) && f.includes("llsl-")) { const raw = execFileSync("pdftotext", ["-raw", f, "-"], { maxBuffer: 256e6 }).toString(); if (normJoin(raw).includes(norm(c.quote_excerpt)) || norm(raw).includes(norm(c.quote_excerpt))) continue; }
  if (!cache[f].includes(norm(c.quote_excerpt))) { console.log(`MISSING ${c.claim_id}: ${c.quote_excerpt}`); bad++; }
}
console.log(`${m.claims.length - bad}/${m.claims.length} quotes found offline`);
