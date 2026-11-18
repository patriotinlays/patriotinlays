import { classifyFailure, decideSourceCheck, lastPassAgeDays, FALLBACK_MAX_DAYS, UNREACHABLE_MAX_DAYS, maxFallbackDays, fallbackEndsAt, loadLastPassed, recordPass } from "./lib/source-pass.mjs";
import { chicagoISO } from "./lib/chicago-date.mjs";
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
t("t179 safety net: 503 with a last pass 35 days old (under 90) falls back", (() => { const d = decideSourceCheck({ status: 503, lastPassedAt: stale, now }); return d.outcome === "fallback" && d.maxDays === 90 && /under 90 days/.test(d.warning); })());
const old90 = "2026-08-01T16:34:49.000Z", at89 = new Date(Date.parse(fresh) + 89.9 * 864e5), at90 = new Date(Date.parse(fresh) + 90 * 864e5);
t("t179 safety net: 5xx (500/502/503/504/522) falls back up to 90 days from the last pass, blocks at 90", [500, 502, 503, 504, 522].every((s) => decideSourceCheck({ status: s, lastPassedAt: fresh, now: at89 }).outcome === "fallback" && decideSourceCheck({ status: s, lastPassedAt: fresh, now: at90 }).outcome === "block"));
t("t179 safety net: a timeout also gets 90 days", decideSourceCheck({ status: "error", errorMessage: "TimeoutError: aborted due to timeout", lastPassedAt: fresh, now: at89 }).outcome === "fallback" && decideSourceCheck({ status: "error", errorMessage: "TimeoutError", lastPassedAt: fresh, now: at90 }).outcome === "block");
t("t179 safety net: 5xx with a last pass over 90 days old blocks", (() => { const d = decideSourceCheck({ status: 503, lastPassedAt: old90, now }); return d.outcome === "block" && /day\(s\) old \(max 89\)/.test(d.error); })());
t("t179: 403 and certificate errors keep the 30-day limit", decideSourceCheck({ status: 403, lastPassedAt: stale, now }).outcome === "block" && decideSourceCheck({ status: "error", errorMessage: "UNABLE_TO_VERIFY_LEAF_SIGNATURE", lastPassedAt: stale, now }).outcome === "block" && maxFallbackDays("http_403") === 30 && maxFallbackDays("certificate") === 30);
t("t179: 404/410, changed quotes and never-passed sources still block under the safety net", decideSourceCheck({ status: 404, lastPassedAt: fresh, now }).outcome === "block" && decideSourceCheck({ status: 410, lastPassedAt: fresh, now }).outcome === "block" && decideSourceCheck({ status: 200, quoteMissing: true, lastPassedAt: fresh, now }).outcome === "block" && decideSourceCheck({ status: 522, lastPassedAt: null, now }).outcome === "block");
t("t179: the fallback keeps the real last-pass date (never refreshed) and reports when the fallback ends", (() => { const d = decideSourceCheck({ status: 522, lastPassedAt: fresh, now }); return d.lastPassedAt === fresh && !d.updateLastPassed && d.fallbackEndsAt === "2027-02-03T16:34:49.000Z" && fallbackEndsAt(fresh, "http_522") === d.fallbackEndsAt && /lastPassed=2026-11-05T16:34:49.000Z/.test(d.warning) && /fallbackEnds=2027-02-03T10:34:49/.test(d.warning); })());
t("t179: UNREACHABLE_MAX_DAYS is 90 and FALLBACK_MAX_DAYS stays 30", UNREACHABLE_MAX_DAYS === 90 && FALLBACK_MAX_DAYS === 30 && maxFallbackDays("http_522") === 90 && maxFallbackDays("timeout") === 90);
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
  t("a new URL's pass is saved to disk immediately", onDisk()["https://new.example/never-seen"] === chicagoISO(at));
  t("existing entries are kept when a new one is recorded", onDisk()["https://old.example/a"] === "2026-11-01T00:00:00.000Z");
  // A later source fails (block): nothing is written for it, and the earlier pass is still on disk.
  const later = decideSourceCheck({ status: 403, lastPassedAt: store.sources["https://later.example/x"] || null, now: at });
  t("a later failing source doesn't erase earlier passes", later.outcome === "block" && onDisk()["https://new.example/never-seen"] === chicagoISO(at) && !("https://later.example/x" in onDisk()));
  t("a source recorded earlier in the run is fallback-eligible right after (403 within 30 days)", decideSourceCheck({ status: 403, lastPassedAt: loadLastPassed(f).sources["https://new.example/never-seen"], now: at }).outcome === "fallback");
  const many = ["https://s1.example/", "https://s2.example/", "https://s3.example/"]; many.forEach((u) => recordPass(f, store, u, at));
  t("every passing source in a run gets its own date", many.every((u) => onDisk()[u] === chicagoISO(at))); }

// t128u: per-claim match records. A fallback source covers only claims whose exact quote matched that page before.
{ const { loadClaimMatches, recordClaimMatches, checkFallbackClaims } = await import("./lib/claim-match.mjs");
  const dir = mkdtempSync(join(tmpdir(), "claimmatch-")); const f = join(dir, "claim-last-matched.json");
  const U = "https://dar.example/faq";
  const old = { claim_id: "old", source_url: U, quote_excerpt: "matched words", used_on: ["census-bridge"] };
  const store = loadClaimMatches(f);
  recordClaimMatches(f, store, [old], new Date("2026-11-05T16:34:49.000Z"));
  const disk = JSON.parse(readFileSync(f, "utf8")).claims.old;
  t("a live match records quote, time and uses on disk", disk.quote === "matched words" && disk.matchedAt === "2026-11-05T16:34:49.000Z" && disk.used_on.join() === "census-bridge");
  const r1 = checkFallbackClaims([old], loadClaimMatches(f));
  t("fallback covers a claim matched before with the same quote and uses", r1.ok.length === 1 && r1.held.length === 0 && r1.newUses.length === 0);
  const r2 = checkFallbackClaims([{ claim_id: "brand-new", source_url: U, quote_excerpt: "never seen", used_on: ["faq"] }], loadClaimMatches(f));
  t("fallback HOLDS a new claim never matched against the page", r2.held.length === 1 && /never matched/.test(r2.held[0].reason) && r2.ok.length === 0);
  const r3 = checkFallbackClaims([{ ...old, quote_excerpt: "edited words" }], loadClaimMatches(f));
  t("fallback HOLDS a claim whose quote changed since its match", r3.held.length === 1 && /quote changed/.test(r3.held[0].reason));
  const r4 = checkFallbackClaims([{ ...old, source_url: "https://other.example/" }], loadClaimMatches(f));
  t("fallback HOLDS a claim moved to another source", r4.held.length === 1 && /different source/.test(r4.held[0].reason));
  const r5 = checkFallbackClaims([{ ...old, used_on: ["census-bridge", "substitute-evidence", "tool:tool-b.js"] }], loadClaimMatches(f));
  t("fallback reports new uses of a matched claim (warning)", r5.newUses.length === 1 && r5.newUses[0].added.join() === "substitute-evidence,tool:tool-b.js"); }

console.log(`Source-pass rules: ${ok}/${ok + fail} passed.`);
process.exit(fail ? 1 : 0);
