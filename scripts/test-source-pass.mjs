import { classifyFailure, decideSourceCheck, lastPassAgeDays, FALLBACK_MAX_DAYS, loadLastPassed, recordPass } from "./lib/source-pass.mjs";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let ok = 0, fail = 0;
const t = (name, cond) => { const p = !!cond; p ? ok++ : fail++; console.log(`${p ? "PASS" : "FAIL"}  ${name}`); };
const now = new Date("2026-11-05T20:40:00.000Z");
const fresh = "2026-11-05T16:34:49.000Z";
const stale = "2026-10-01T16:34:49.000Z";

t("live 200 passes and updates last-passed", (() => { const d = decideSourceCheck({ status: 200, now }); return d.outcome === "pass" && d.updateLastPassed; })());
t("quote mismatch always blocks, even with a fresh last-pass", (() => { const d = decideSourceCheck({ status: 200, quoteMissing: true, lastPassedAt: fresh, now }); return d.outcome === "block" && /quote mismatch/.test(d.error); })());
t("404 always blocks; no fallback", (() => { const d = decideSourceCheck({ status: 404, lastPassedAt: fresh, now }); return d.outcome === "block" && /404/.test(d.error) && /no fallback/.test(d.error); })());
t("410 always blocks; no fallback", (() => { const d = decideSourceCheck({ status: 410, lastPassedAt: fresh, now }); return d.outcome === "block" && /410/.test(d.error); })());
t("403 with fresh last-pass uses fallback and warns", (() => { const d = decideSourceCheck({ status: 403, lastPassedAt: fresh, now }); return d.outcome === "fallback" && /FALLBACK/.test(d.warning) && d.lastPassedAt === fresh && !d.updateLastPassed; })());
t("500 with fresh last-pass uses fallback", (() => decideSourceCheck({ status: 500, lastPassedAt: fresh, now }).outcome === "fallback")());
t("502/503/504 with fresh last-pass use fallback", [502, 503, 504].every((s) => decideSourceCheck({ status: s, lastPassedAt: fresh, now }).outcome === "fallback"));
t("timeout with fresh last-pass uses fallback", (() => decideSourceCheck({ status: "error", errorMessage: "TimeoutError: The operation was aborted due to timeout", lastPassedAt: fresh, now }).outcome === "fallback")());
t("certificate error with fresh last-pass uses fallback", (() => decideSourceCheck({ status: "error", errorMessage: "fetch failed: UNABLE_TO_VERIFY_LEAF_SIGNATURE unable to verify the first certificate", lastPassedAt: fresh, now }).outcome === "fallback")());
t("403 with no last-pass blocks", (() => { const d = decideSourceCheck({ status: 403, lastPassedAt: null, now }); return d.outcome === "block" && /no successful last-pass/.test(d.error); })());
t("503 with last-pass ≥ 30 days blocks", (() => { const d = decideSourceCheck({ status: 503, lastPassedAt: stale, now }); return d.outcome === "block" && /day\(s\) old/.test(d.error); })());
t("429 (not fallback-eligible) blocks even with a fresh last-pass", (() => decideSourceCheck({ status: 429, lastPassedAt: fresh, now }).outcome === "block")());
t("classifyFailure marks 403/5xx/timeout/certificate as fallback-eligible", classifyFailure({ status: 403 }).fallbackEligible && classifyFailure({ status: 503 }).fallbackEligible && classifyFailure({ errorMessage: "timeout" }).fallbackEligible && classifyFailure({ errorMessage: "certificate" }).fallbackEligible);
t("classifyFailure marks 404/410/quote mismatch as non-fallback", !classifyFailure({ status: 404 }).fallbackEligible && !classifyFailure({ status: 410 }).fallbackEligible && !classifyFailure({ quoteMissing: true }).fallbackEligible);
t(`lastPassAgeDays under ${FALLBACK_MAX_DAYS} for today's seed`, lastPassAgeDays(fresh, now) < FALLBACK_MAX_DAYS);
t("lastPassAgeDays null when missing", lastPassAgeDays(null, now) == null);

// Last-passed store: every passing source is written to disk at once, including a URL never seen before,
// and stays recorded when a later source fails or the run stops early.
{ const dir = mkdtempSync(join(tmpdir(), "lastpass-")); const f = join(dir, "source-last-passed.json");
  writeFileSync(f, JSON.stringify({ schema_version: 1, sources: { "https://old.example/a": "2026-11-01T00:00:00.000Z" } }));
  const store = loadLastPassed(f);
  const at = new Date("2026-11-05T22:00:00.000Z");
  recordPass(f, store, "https://new.example/never-seen", at);
  const onDisk = () => JSON.parse(readFileSync(f, "utf8")).sources;
  t("a new URL's pass is saved to disk immediately", onDisk()["https://new.example/never-seen"] === at.toISOString());
  t("existing entries are kept when a new one is recorded", onDisk()["https://old.example/a"] === "2026-11-01T00:00:00.000Z");
  // A later source fails (block): nothing is written for it, and the earlier pass is still on disk.
  const later = decideSourceCheck({ status: 403, lastPassedAt: store.sources["https://later.example/x"] || null, now: at });
  t("a later failing source doesn't erase earlier passes", later.outcome === "block" && onDisk()["https://new.example/never-seen"] === at.toISOString() && !("https://later.example/x" in onDisk()));
  t("a source recorded earlier in the run is fallback-eligible right after (403 within 30 days)", decideSourceCheck({ status: 403, lastPassedAt: loadLastPassed(f).sources["https://new.example/never-seen"], now: at }).outcome === "fallback");
  const many = ["https://s1.example/", "https://s2.example/", "https://s3.example/"]; many.forEach((u) => recordPass(f, store, u, at));
  t("every passing source in a run gets its own date", many.every((u) => onDisk()[u] === at.toISOString())); }

console.log(`Source-pass rules: ${ok}/${ok + fail} passed.`);
process.exit(fail ? 1 : 0);
