// Mixed-gate outcome resolver for the 90-day pilot (punch-list item 3).
// Inputs are Search Console / Cloudflare Web Analytics numbers for the 12 core URLs (10 guides + 2 tools).
// Rules are evaluated top to bottom; the FIRST matching rule decides. The final row of each table is a catch-all,
// so every possible combination of metrics resolves to exactly one outcome. Thresholds are pilot design choices.
//
// metrics = { indexed, urlsWithImpr, impressions28, clicks28, proxyPct, toolViews28, manualAction, imprDeclining3w, priorPartial,
//             utilityRetest, retestProxyPct14, retestToolViews14 }
//   utilityRetest = true when this evaluation IS the single 14-day re-test that follows a D90-9 PARTIAL UTILITY refresh.
//   retestProxyPct14 / retestToolViews14 = proxy and tool-page views measured only over the 14-day re-test window
//   (the days after the refresh shipped), so pre-refresh behaviour cannot mask or inflate the result.
//   proxyPct = Report-Page Engagement Proxy (report-page views / tool-page views, 28 days, %).
//   If toolViews28 < 50 the proxy is "insufficient data" and is ignored (never blocks, never passes on its own).

export const OUTCOMES = {
  STOP: "STOP — remediate manual action; no further gate testing until resolved",
  FAIL: "FAIL — stop-loss: freeze the site; re-target or end the pilot",
  PARTIAL_TECH: "PARTIAL — 14-day technical audit (robots, sitemap, canonicals, rendering, internal links); no new pages",
  PARTIAL_CONTENT: "PARTIAL — freeze expansion, refresh only (titles, intros, internal links on pages with impressions)",
  PARTIAL_CTR: "PARTIAL — demand without clicks: rewrite titles/meta descriptions only; re-test in 14 days",
  PARTIAL_UTILITY: "PARTIAL — traffic OK but tools under-used: tool UX and in-guide placement refresh; continue",
  PARTIAL_UTILITY_D90: "PARTIAL UTILITY — one 14-day refresh limited to in-guide tool CTA placement and tool UI layout (no new pages, no title/meta or content changes, no AdSense application), then exactly one 14-day re-test (D90-R1/R3; a manual action during the re-test is STOP via D90-1): re-test PASS = apply for AdSense; anything else = FAIL",
  PARTIAL_EXTEND: "PARTIAL — one 30-day extension, refresh only, no AdSense application; second PARTIAL = FAIL",
  PASS: "PASS — continue to next gate",
  PASS_ADSENSE: "PASS — apply for AdSense; then expand to 20 resources at the same standard",
};

const proxyBand = (m) => (m.toolViews28 < 50 ? "na" : m.proxyPct >= 5 ? "ok" : m.proxyPct >= 2 ? "mid" : "low");

export const RULES = {
  30: [
    ["D30-1", "Manual action present", (m) => m.manualAction, "STOP"],
    ["D30-2", "Fewer than 3 of 12 indexed and fewer than 5 clicks", (m) => m.indexed < 3 && m.clicks28 < 5, "FAIL"],
    ["D30-3", "≤ 5 of 12 indexed but not D30-2 (includes high clicks + low indexation)", (m) => m.indexed <= 5, "PARTIAL_TECH"],
    ["D30-4", "≥ 6 indexed but fewer than 3 URLs with ≥ 1 impression", (m) => m.urlsWithImpr < 3, "PARTIAL_CONTENT"],
    ["D30-5", "≥ 6 indexed and ≥ 3 URLs with impressions", () => true, "PASS"],
  ],
  60: [
    ["D60-1", "Manual action present", (m) => m.manualAction, "STOP"],
    ["D60-2", "< 150 impressions, or impressions falling 3 straight weeks (regardless of clicks/indexation)", (m) => m.impressions28 < 150 || m.imprDeclining3w, "FAIL"],
    ["D60-3", "< 10 of 12 indexed while impressions ≥ 150 (high clicks + low indexation lands here)", (m) => m.indexed < 10, "PARTIAL_TECH"],
    ["D60-4", "150–299 impressions (indexation OK)", (m) => m.impressions28 < 300, "PARTIAL_CONTENT"],
    ["D60-5", "≥ 300 impressions but < 5 clicks (high impressions + low clicks)", (m) => m.clicks28 < 5, "PARTIAL_CTR"],
    ["D60-6", "Search metrics pass but proxy < 5% (with ≥ 50 tool-page views)", (m) => ["mid", "low"].includes(proxyBand(m)), "PARTIAL_UTILITY"],
    ["D60-7", "≥ 10 indexed, ≥ 300 impressions, ≥ 5 clicks, proxy ≥ 5% or insufficient data", () => true, "PASS"],
  ],
  90: [
    ["D90-1", "Manual action present", (m) => m.manualAction, "STOP"],
    ["D90-R1", "Utility re-test PASS: 12/12 indexed, ≥ 1,000 impressions, ≥ 30 clicks (28-day) AND proxy ≥ 5% on ≥ 25 tool-page views in the 14-day re-test window", (m) => m.utilityRetest && m.indexed >= 12 && m.impressions28 >= 1000 && m.clicks28 >= 30 && m.retestToolViews14 >= 25 && m.retestProxyPct14 >= 5, "PASS_ADSENSE"],
    ["D90-R2", "Utility re-test FAIL: any D90-R1 condition not met (including < 25 tool-page views in the window); no second refresh", (m) => m.utilityRetest, "FAIL"],
    ["D90-2", "< 500 impressions, or < 10 clicks with < 1,000 impressions", (m) => m.impressions28 < 500 || (m.clicks28 < 10 && m.impressions28 < 1000), "FAIL"],
    ["D90-3", "This is a re-test after a Day-90 PARTIAL and PASS is still not met", (m) => m.priorPartial && !(m.indexed >= 12 && m.impressions28 >= 1000 && m.clicks28 >= 30 && ["ok", "na"].includes(proxyBand(m))), "FAIL"],
    ["D90-4", "< 10 of 12 indexed (traffic floors met)", (m) => m.indexed < 10, "PARTIAL_TECH"],
    ["D90-5", "≥ 1,000 impressions but < 30 clicks (high impressions + low clicks)", (m) => m.impressions28 >= 1000 && m.clicks28 < 30, "PARTIAL_CTR"],
    ["D90-6", "500–999 impressions (any clicks ≥ 10)", (m) => m.impressions28 < 1000, "PARTIAL_EXTEND"],
    ["D90-7", "Traffic passes but 10–11 of 12 indexed", (m) => m.indexed < 12, "PARTIAL_TECH"],
    ["D90-8", "Traffic and indexation pass but proxy 2–4.9%", (m) => proxyBand(m) === "mid", "PARTIAL_EXTEND"],
    ["D90-9", "Search traffic passes (≥ 1,000 impressions, ≥ 30 clicks) and 12/12 indexed, but Report-Page Engagement Proxy < 2% on ≥ 50 tool-page views", (m) => proxyBand(m) === "low", "PARTIAL_UTILITY_D90"],
    ["D90-10", "12/12 indexed, ≥ 1,000 impressions, ≥ 30 clicks, proxy ≥ 5% or insufficient data", () => true, "PASS_ADSENSE"],
  ],
};

export function evaluateGate(day, metrics) {
  const m = { indexed: 0, impressions28: 0, clicks28: 0, utilityRetest: false, retestProxyPct14: 0, retestToolViews14: 0, manualAction: false, imprDeclining3w: false, priorPartial: false, toolViews28: 0, proxyPct: 0, urlsWithImpr: 0, ...metrics };
  for (const [id, desc, test, outcome] of RULES[day]) if (test(m)) return { day, rule: id, condition: desc, outcome, action: OUTCOMES[outcome] };
  throw new Error("unreachable: catch-all rule missing");
}
