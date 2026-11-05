// 30-day unreachable-source fallback for the live Source Manifest check.
// Live check first. Quote mismatches, 404/410, never-passed, and last-pass ≥ 30 days always block.
// Fallback (loud warning, re-check every run) only for 403, any 5xx, timeouts, and certificate errors.
export const FALLBACK_MAX_DAYS = 30;

export function classifyFailure({ status, errorMessage = "", quoteMissing = false } = {}) {
  if (quoteMissing) return { kind: "quote_mismatch", fallbackEligible: false };
  if (status === 404 || status === 410) return { kind: `http_${status}`, fallbackEligible: false };
  const msg = String(errorMessage || "");
  if (/timeout|TimeoutError|aborted/i.test(msg)) return { kind: "timeout", fallbackEligible: true };
  if (/certificate|CERT_|UNABLE_TO_VERIFY|SSL|TLS|local issuer/i.test(msg)) return { kind: "certificate", fallbackEligible: true };
  if (status === 403) return { kind: "http_403", fallbackEligible: true };
  if (typeof status === "number" && status >= 500 && status <= 599) return { kind: `http_${status}`, fallbackEligible: true };
  if (status === "error" || status == null) return { kind: "fetch_error", fallbackEligible: /timeout|certificate|CERT_|UNABLE_TO_VERIFY|SSL|TLS|local issuer|aborted/i.test(msg) };
  if (typeof status === "number" && status !== 200) return { kind: `http_${status}`, fallbackEligible: false };
  return { kind: "ok", fallbackEligible: false };
}

export function lastPassAgeDays(lastPassedAt, now = new Date()) {
  if (!lastPassedAt) return null;
  const t = Date.parse(lastPassedAt);
  if (!Number.isFinite(t)) return null;
  return (now.getTime() - t) / 864e5;
}

export function decideSourceCheck({ status, errorMessage = "", quoteMissing = false, lastPassedAt = null, now = new Date() } = {}) {
  if (!quoteMissing && status === 200) {
    return { outcome: "pass", updateLastPassed: true, warning: null, error: null };
  }
  const fail = classifyFailure({ status, errorMessage, quoteMissing });
  if (!fail.fallbackEligible) {
    const why = fail.kind === "quote_mismatch" ? "quote mismatch"
      : fail.kind === "http_404" || fail.kind === "http_410" ? `${fail.kind.replace("http_", "HTTP ")} (page gone; no fallback)`
      : fail.kind.startsWith("http_") ? fail.kind.replace("http_", "HTTP ")
      : fail.kind;
    return { outcome: "block", updateLastPassed: false, warning: null, error: why, failureKind: fail.kind };
  }
  const age = lastPassAgeDays(lastPassedAt, now);
  if (age == null) {
    return { outcome: "block", updateLastPassed: false, warning: null, error: `${fail.kind}: unreachable and no successful last-pass record`, failureKind: fail.kind };
  }
  if (age >= FALLBACK_MAX_DAYS) {
    return { outcome: "block", updateLastPassed: false, warning: null, error: `${fail.kind}: last pass ${lastPassedAt} is ${Math.floor(age)} day(s) old (max ${FALLBACK_MAX_DAYS - 1})`, failureKind: fail.kind };
  }
  return {
    outcome: "fallback",
    updateLastPassed: false,
    warning: `FALLBACK: unreachable source accepted on last successful check under ${FALLBACK_MAX_DAYS} days. URL failure=${fail.kind}; lastPassed=${lastPassedAt}; ageDays=${age.toFixed(2)}. Re-check required on every run.`,
    error: null,
    failureKind: fail.kind,
    lastPassedAt,
  };
}
