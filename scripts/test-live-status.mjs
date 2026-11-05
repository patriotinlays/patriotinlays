// Every report says on its own line whether the live-source check ran (Tim, Nov 5):
// "Live-source check: RUN" or "Live-source check: NOT RUN". A consistency-only run never overwrites live-run evidence.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
const ROOT = new URL("..", import.meta.url).pathname;
let ok = 0, fail = 0;
const t = (name, cond) => { const p = !!cond; p ? ok++ : fail++; console.log(`${p ? "PASS" : "FAIL"}  ${name}`); };
const LIVE = join(ROOT, "manifest-live-check-report.json");
const before = existsSync(LIVE) ? { m: statSync(LIVE).mtimeMs, body: readFileSync(LIVE, "utf8") } : null;
let out = ""; try { out = execFileSync("node", [join(ROOT, "scripts/check-manifest.mjs")], { encoding: "utf8" }); } catch (e) { out = e.stdout || ""; }
const lines = out.split("\n");
t("consistency check prints 'Live-source check: NOT RUN' on its own line", lines.includes("Live-source check: NOT RUN"));
t("consistency check never prints 'Live-source check: RUN'", !lines.includes("Live-source check: RUN"));
const rep = JSON.parse(readFileSync(join(ROOT, "manifest-check-report.json"), "utf8"));
t("manifest-check-report.json states live_source_check NOT RUN with the exact line", rep.live_source_check === "NOT RUN" && rep.live_source_check_line === "Live-source check: NOT RUN");
t("a consistency-only run leaves the live-run report untouched", before ? existsSync(LIVE) && readFileSync(LIVE, "utf8") === before.body : !existsSync(LIVE));
if (before) { const L = JSON.parse(before.body);
  t("the live-run report says 'Live-source check: RUN'", L.live_source_check === "RUN" && L.live_source_check_line === "Live-source check: RUN");
  t("the consistency report points to the last live run", rep.last_live_source_check?.checkedAt === L.checkedAt && rep.last_live_source_check?.report === "manifest-live-check-report.json"); }
const src = readFileSync(join(ROOT, "scripts/check-links.mjs"), "utf8");
t("the link checker reports 'Live-source check: NOT RUN' (it never verifies quotes)", /Live-source check: NOT RUN/.test(src) && !/Live-source check: RUN/.test(src));
console.log(`Live-source status: ${ok}/${ok + fail} passed.`);
process.exit(fail ? 1 : 0);
