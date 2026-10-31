// Regenerates docs/gates.md from ops/gates.js so the document can never drift from the code.
import { writeFileSync } from "node:fs";
import { RULES, OUTCOMES } from "../ops/gates.js";
let s = `# Mixed-gate outcome matrix (Days 30 / 60 / 90)

Generated from \`ops/gates.js\` by \`node scripts/gen-gates-doc.mjs\`. Rules run top to bottom and the **first match decides**; the last row of each day is a catch-all, so every metric combination resolves to exactly one outcome. \`scripts/test-gates.mjs\` proves this by sweeping 19,906,560 combinations (all 24 rules reachable, re-tests can only end in STOP, PASS or FAIL).

Metrics are 28-day Search Console / Cloudflare Web Analytics numbers for the 12 core URLs (10 guides + 2 tools). The **Report-Page Engagement Proxy** = report-page views ÷ tool-page views. At the regular gates it counts as insufficient data when tool-page views < 50 and then neither blocks nor passes. Thresholds are pilot design choices, not industry benchmarks.

`;
for (const d of [30, 60, 90]) {
  s += `## Day ${d}\n\n| Rule | Condition | Outcome | Action |\n|---|---|---|---|\n`;
  for (const [id, c, , o] of RULES[d]) s += `| ${id} | ${c} | ${o} | ${OUTCOMES[o]} |\n`;
  s += "\n";
}
s += `## D90-9 in detail: PARTIAL UTILITY (search traffic passes, proxy < 2%)

**Trigger (D90-9).** At the Day-90 gate, all of: no manual action; ≥ 1,000 impressions and ≥ 30 clicks (28-day); 12/12 core URLs indexed; ≥ 50 tool-page views; Report-Page Engagement Proxy < 2%. (Proxy 2–4.9% is D90-8, a 30-day extension; proxy ≥ 5% or < 50 tool-page views is D90-10, PASS.)

**Refresh (days 1–14 after the gate).** One refresh, limited to:
1. In-guide tool CTA placement: where the embedded Service Window Checker / Lineage Evidence Matrix card sits in each guide, its lead-in sentence, and the link to the report page.
2. Tool UI layout: field order, button placement, and how the result links to the report page.

Not allowed during the refresh: new pages, title or meta-description changes, changes to factual content or the Source Manifest, or an AdSense application. All gates (\`npm run build\`, \`npm run e2e\`) must pass before the refresh ships. The day it ships starts the re-test window.

**Re-test (exactly one, the 14 days after the refresh ships).** Evaluate \`evaluateGate(90, { ...28-day metrics, utilityRetest: true, retestProxyPct14, retestToolViews14 })\`, where the proxy and tool-page views are measured only over the 14-day re-test window:
- **D90-1 STOP**: a manual action present at the re-test.
- **D90-R1 PASS**: 12/12 indexed, ≥ 1,000 impressions and ≥ 30 clicks (trailing 28 days) **and** proxy ≥ 5% on ≥ 25 tool-page views in the 14-day window. Result: apply for AdSense.
- **D90-R2 FAIL**: any of the above not met, including fewer than 25 tool-page views in the window (insufficient data cannot pass a re-test). Result: stop-loss; there is no second refresh and no further re-test.
`;
writeFileSync(new URL("../docs/gates.md", import.meta.url), s);
console.log("docs/gates.md regenerated");
