# t175 release log — production deploy of t174 (f6baab5) (Nov 15, 2026, America/Chicago)

Tim (verbatim): "Keep the FamilySearch link with "blocked, not verified" status; don't fail the check. In the monthly report, list blocked links separately as "check by hand" with their URLs. Deploy f6baab5, purge the cache, verify publicly. Reply with deployed yes/no."

No code changes. The blocked-status behavior is unchanged from t174: a blocked link is a warning and does not fail the check.
The live-check output already lists the blocked link and its URL on two lines: `plain link 403 BLOCKED <url>` and `WARN  PLAIN LINK BLOCKED <url>: ... NOT verified`. It is also in `manifest-live-check-report.json` under `plainLinks` (`result: "blocked"`).
There is no separate "BLOCKED (check by hand)" heading. Adding one needs a code change to `scripts/check-manifest.mjs`, so it was not made.

## Live-source check (run again before this deploy)
- Live-source check: RUN, result PASSED, Sunday Nov 15, 2026, 9:44 AM CT
- 410 claims (410 referenced); 73 sources: 70 passed, 3 known DAR 522 fallbacks (App_Help_Step_By_Step_1, FAQs, search_revwar; last pass 2026-11-05T16:34:49.000Z, 9.96 days), 0 failed
- Plain links: CDC 200 PASSED; FamilySearch index 403 BLOCKED (check by hand): https://www.familysearch.org/en/wiki/United_States_Online_Genealogy_Records_by_State
- Held back: 14 still held, 0 restored; source scope 0 flagged

## Deploy
- Built dist from a clean worktree at f6baab58c9c8f4e2e1e4133fdff0efd7c568ad46. It was byte-identical to a build from HEAD 77fae0c (`diff -rq`: no differences).
- `wrangler pages deploy dist --branch main`: https://5b80b4ba.patriotinlays.pages.dev
- Purge after the deploy: POST /zones/68ec36681050311b61f6b66ab9171d20/purge_cache {purge_everything:true}, success: true

## Public verification (patriotinlays.com)
- Cache-busted curl, all HTTP 200: /tools/lineage-matrix/, /assets/js/places.js, tool-b.js, tool-b-ui.js. The three JS files are byte-identical to the f6baab5 build.
- Playwright at 390px and 1280px, on /tools/lineage-matrix/ and /tools/lineage-matrix/report/:
  - checkbox label "Still living" (unticked for saved data with no `living` field)
  - Texas and Ohio sentences present, each with the CDC and FamilySearch links
  - ticking "Still living" removes generation 1's death gap
  - the report shows "Living: death details not needed."
  - no console errors
- Screenshots: public-top-*, public-where-*, public-report-living-* (390, 1280)
