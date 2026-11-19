# t180 release log — fee wording, dar-gen-1-3 wording, production deploy (Nov 18, 2026, America/Chicago)

On top of t179 (d61d3de code, 20aa639 log). Tim authorized a production deploy (pt180u), on condition that the tests and the live-source check pass. Routines were not touched; Tim moved the DAR check himself.

## Wording changes (exact)
1. Fee (Roadmap "Practical details", claim dar-fee-dues, quote "You must submit both first-year dues and Application fees for new member submissions."):
   - Old: "DAR charges an application fee plus the first year's national dues; chapters and state societies add their own. Ask your chapter registrar for current amounts."
   - New: "DAR requires an application fee plus first-year dues. Ask your chapter registrar for current amounts."
2. dar-gen-1-3 (quote "It is a must that the first three generations of the application and supplemental have complete dates and places."). The claim marker is kept in all three places.
   - substitute-evidence.md:
     - Old: "Generations 1 to 3 are different: DAR expects complete birth and death dates and places for you, your parents and your grandparents."
     - New: "Generations 1 to 3 are different: DAR expects complete dates and places for you, your parents and your grandparents."
   - lineage-proof-roadmap.md table, Generations 1–3 row:
     - Old: "Complete dates and places of birth and death for each person"
     - New: "Complete dates and places for each person"
   - lineage-matrix.md:
     - Old: "Generations 1 to 3 need birth and death evidence, since DAR asks for complete dates and places for those generations."
     - New: "Generations 1 to 3 need complete dates and places, since DAR asks for them for those generations."
   - Tool logic unchanged. The worksheet has no label that states the old rule as a sentence. Its gap list still asks generations 1–3 for birth and death (death unless living), shows lines like "<who>: no death evidence entered yet." and cites dar-gen-1-3 for them (tool-b.js rowRequirements/gaps). This is reported, not changed.

## Tests
- Unit (`npm test`): all passed. Lineage Evidence Matrix 114/114, Source-pass 34/34, other suites unchanged.
- Offline link check: PASSED (0 broken).
- E2E: 381/381 (2 new t180 checks).

## Live-source check (run once): Wed Nov 18, 2026, 6:26 PM CT — Live-source check: RUN, result PASSED
- 409 claims (409 referenced); 76 sources: 73 passed, 3 fallbacks, 0 failed.
- The 3 fallbacks are the known DAR 522 pages, under the 90-day safety net. Last pass Nov 5, 2026 10:34 AM CT; the fallback ends Feb 3, 2027 10:34 AM CT:
  - Step by Step 1: 26 claims
  - FAQs: 11 claims
  - search_revwar: 4 claims
- Plain links: CDC PASSED. FamilySearch BLOCKED (check by hand).
- Held back: 14 still held, 0 restored. Source scope: 0 flagged.
- page-meta (after commit): 15/15 passed.

## Production deploy (authorized, pt180u)
- Code commit: d5bb5b1, built from that commit. This includes all of t179 (d61d3de).
- Deployed with `--branch main`: https://09bc10e9.patriotinlays.pages.dev (Nov 18, 2026, ~6:31 PM CT).
- Cache purge (purge_everything, zone 68ec36681050311b61f6b66ab9171d20) was run after the deploy: success: true, errors: [].
- Public check on https://patriotinlays.com:
  - Cache-busted curl: all 4 pages 200.
  - Playwright at 390px and 1280px:
    - New fee sentence present; "$75", "six weeks" and "national dues" gone (Roadmap, Application Returned).
    - "Complete dates and places" in all 3 places.
    - GRS link points to https://www.dar.org/research.
    - Worksheet "For any other state" line present.
    - No horizontal overflow; no console errors.
- Screenshots: public-roadmap-fee-*, public-roadmap-table-*, public-matrix-gen13-* (390, 1280).
