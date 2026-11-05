import { classifyFailure, decideSourceCheck, lastPassAgeDays, FALLBACK_MAX_DAYS } from "./lib/source-pass.mjs";
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

console.log(`Source-pass rules: ${ok}/${ok + fail} passed.`);
process.exit(fail ? 1 : 0);
