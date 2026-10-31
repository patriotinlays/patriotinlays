# Mixed-gate outcome matrix (Days 30 / 60 / 90)

Generated from `ops/gates.js` by `node scripts/gen-gates-doc.mjs`. Rules run top to bottom and the **first match decides**; the last row of each day is a catch-all, so every metric combination resolves to exactly one outcome. `scripts/test-gates.mjs` proves this by sweeping 19,906,560 combinations (all 24 rules reachable, re-tests can only end in STOP, PASS or FAIL).

Metrics are 28-day Search Console / Cloudflare Web Analytics numbers for the 12 core URLs (10 guides + 2 tools). The **Report-Page Engagement Proxy** = report-page views ÷ tool-page views. At the regular gates it counts as insufficient data when tool-page views < 50 and then neither blocks nor passes. Thresholds are pilot design choices, not industry benchmarks.

## Day 30

| Rule | Condition | Outcome | Action |
|---|---|---|---|
| D30-1 | Manual action present | STOP | STOP — remediate manual action; no further gate testing until resolved |
| D30-2 | Fewer than 3 of 12 indexed and fewer than 5 clicks | FAIL | FAIL — stop-loss: freeze the site; re-target or end the pilot |
| D30-3 | ≤ 5 of 12 indexed but not D30-2 (includes high clicks + low indexation) | PARTIAL_TECH | PARTIAL — 14-day technical audit (robots, sitemap, canonicals, rendering, internal links); no new pages |
| D30-4 | ≥ 6 indexed but fewer than 3 URLs with ≥ 1 impression | PARTIAL_CONTENT | PARTIAL — freeze expansion, refresh only (titles, intros, internal links on pages with impressions) |
| D30-5 | ≥ 6 indexed and ≥ 3 URLs with impressions | PASS | PASS — continue to next gate |

## Day 60

| Rule | Condition | Outcome | Action |
|---|---|---|---|
| D60-1 | Manual action present | STOP | STOP — remediate manual action; no further gate testing until resolved |
| D60-2 | < 150 impressions, or impressions falling 3 straight weeks (regardless of clicks/indexation) | FAIL | FAIL — stop-loss: freeze the site; re-target or end the pilot |
| D60-3 | < 10 of 12 indexed while impressions ≥ 150 (high clicks + low indexation lands here) | PARTIAL_TECH | PARTIAL — 14-day technical audit (robots, sitemap, canonicals, rendering, internal links); no new pages |
| D60-4 | 150–299 impressions (indexation OK) | PARTIAL_CONTENT | PARTIAL — freeze expansion, refresh only (titles, intros, internal links on pages with impressions) |
| D60-5 | ≥ 300 impressions but < 5 clicks (high impressions + low clicks) | PARTIAL_CTR | PARTIAL — demand without clicks: rewrite titles/meta descriptions only; re-test in 14 days |
| D60-6 | Search metrics pass but proxy < 5% (with ≥ 50 tool-page views) | PARTIAL_UTILITY | PARTIAL — traffic OK but tools under-used: tool UX and in-guide placement refresh; continue |
| D60-7 | ≥ 10 indexed, ≥ 300 impressions, ≥ 5 clicks, proxy ≥ 5% or insufficient data | PASS | PASS — continue to next gate |

## Day 90

| Rule | Condition | Outcome | Action |
|---|---|---|---|
| D90-1 | Manual action present | STOP | STOP — remediate manual action; no further gate testing until resolved |
| D90-R1 | Utility re-test PASS: 12/12 indexed, ≥ 1,000 impressions, ≥ 30 clicks (28-day) AND proxy ≥ 5% on ≥ 25 tool-page views in the 14-day re-test window | PASS_ADSENSE | PASS — apply for AdSense; then expand to 20 resources at the same standard |
| D90-R2 | Utility re-test FAIL: any D90-R1 condition not met (including < 25 tool-page views in the window); no second refresh | FAIL | FAIL — stop-loss: freeze the site; re-target or end the pilot |
| D90-2 | < 500 impressions, or < 10 clicks with < 1,000 impressions | FAIL | FAIL — stop-loss: freeze the site; re-target or end the pilot |
| D90-3 | This is a re-test after a Day-90 PARTIAL and PASS is still not met | FAIL | FAIL — stop-loss: freeze the site; re-target or end the pilot |
| D90-4 | < 10 of 12 indexed (traffic floors met) | PARTIAL_TECH | PARTIAL — 14-day technical audit (robots, sitemap, canonicals, rendering, internal links); no new pages |
| D90-5 | ≥ 1,000 impressions but < 30 clicks (high impressions + low clicks) | PARTIAL_CTR | PARTIAL — demand without clicks: rewrite titles/meta descriptions only; re-test in 14 days |
| D90-6 | 500–999 impressions (any clicks ≥ 10) | PARTIAL_EXTEND | PARTIAL — one 30-day extension, refresh only, no AdSense application; second PARTIAL = FAIL |
| D90-7 | Traffic passes but 10–11 of 12 indexed | PARTIAL_TECH | PARTIAL — 14-day technical audit (robots, sitemap, canonicals, rendering, internal links); no new pages |
| D90-8 | Traffic and indexation pass but proxy 2–4.9% | PARTIAL_EXTEND | PARTIAL — one 30-day extension, refresh only, no AdSense application; second PARTIAL = FAIL |
| D90-9 | Search traffic passes (≥ 1,000 impressions, ≥ 30 clicks) and 12/12 indexed, but Report-Page Engagement Proxy < 2% on ≥ 50 tool-page views | PARTIAL_UTILITY_D90 | PARTIAL UTILITY — one 14-day refresh limited to in-guide tool CTA placement and tool UI layout (no new pages, no title/meta or content changes, no AdSense application), then exactly one 14-day re-test (D90-R1/R3; a manual action during the re-test is STOP via D90-1): re-test PASS = apply for AdSense; anything else = FAIL |
| D90-10 | 12/12 indexed, ≥ 1,000 impressions, ≥ 30 clicks, proxy ≥ 5% or insufficient data | PASS_ADSENSE | PASS — apply for AdSense; then expand to 20 resources at the same standard |

## D90-9 in detail: PARTIAL UTILITY (search traffic passes, proxy < 2%)

**Trigger (D90-9).** At the Day-90 gate, all of: no manual action; ≥ 1,000 impressions and ≥ 30 clicks (28-day); 12/12 core URLs indexed; ≥ 50 tool-page views; Report-Page Engagement Proxy < 2%. (Proxy 2–4.9% is D90-8, a 30-day extension; proxy ≥ 5% or < 50 tool-page views is D90-10, PASS.)

**Refresh (days 1–14 after the gate).** One refresh, limited to:
1. In-guide tool CTA placement: where the embedded Service Window Checker / Lineage Evidence Matrix card sits in each guide, its lead-in sentence, and the link to the report page.
2. Tool UI layout: field order, button placement, and how the result links to the report page.

Not allowed during the refresh: new pages, title or meta-description changes, changes to factual content or the Source Manifest, or an AdSense application. All gates (`npm run build`, `npm run e2e`) must pass before the refresh ships. The day it ships starts the re-test window.

**Re-test (exactly one, the 14 days after the refresh ships).** Evaluate `evaluateGate(90, { ...28-day metrics, utilityRetest: true, retestProxyPct14, retestToolViews14 })`, where the proxy and tool-page views are measured only over the 14-day re-test window:
- **D90-1 STOP**: a manual action present at the re-test.
- **D90-R1 PASS**: 12/12 indexed, ≥ 1,000 impressions and ≥ 30 clicks (trailing 28 days) **and** proxy ≥ 5% on ≥ 25 tool-page views in the 14-day window. Result: apply for AdSense.
- **D90-R2 FAIL**: any of the above not met, including fewer than 25 tool-page views in the window (insufficient data cannot pass a re-test). Result: stop-loss; there is no second refresh and no further re-test.
