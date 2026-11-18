# t178 release log — worksheet labels: DAR/SAR line and SAR end date (Nov 18, 2026, America/Chicago)

On top of t175 (82646a3). Lineage Evidence Matrix only. Preview deploy only (`--branch t178-preview`). NOT deployed to production; cache NOT purged.

## Wording added (Tim, verbatim)

a. "These checks follow DAR's application instructions. SAR's standards differ; ask your SAR registrar."
   - Where: `src/content/lineage-matrix.md`, section "The gap rules", right after the three rules for what each generation needs.
   - It has no claim marker. Adding one would be a new use of DAR claims whose page (Step by Step) is on 522 fallback.
   - The manifest gate and the source-scope rule both pass (0 flagged).
b. "SAR's end date is 25 November 1783 (DAR's is 26 November)."
   - Where: the patriot's date-check result box in the worksheet, right after "Period checked: …" (`SAR_END_NOTE` in `src/tools/tool-b.js`, rendered in `tool-b-ui.js`).
   - Claims:
     - sar-gcp-window, the existing GCP §2.0000/§2.3000 quote: "Service must have been rendered between 19 April 1775 and 25 November 1783 except as noted below."
     - dar-window-core, the existing DAR quote: "must occur during the period between 19 April 1775 (Battle of Lexington) and 26 November 1783".
   - No new quotes. Date logic unchanged: `patriot.js` was not touched. Tests confirm that an end date of 1783-11-26 still fits DAR's period and 1783-11-27 is partial.

## Tests
- Unit (`npm test`): all passed. Lineage Evidence Matrix 114/114 (5 new). Page-meta 15/15 after updating the lineage-matrix lastmod expectation to 2026-11-18. Other suites unchanged.
- Offline link check: PASSED
- E2E: 373/373 (8 new t178 checks at 390px and 1280px)

## Live-source check (run once): Wed Nov 18, 2026, 5:19 PM CT — Live-source check: RUN, result PASSED
- 410 claims (410 referenced); 73 sources: 69 passed, 4 fallbacks, 0 failed
- Fallbacks:
  - the 3 known DAR 522s (Step by Step 1, FAQs, search_revwar; last pass 2026-11-05T16:34:49Z, 13.28 days)
  - dar.org/national-society/accepted-revolutionary-war-service: HTTP 403 during the run (last pass 2026-11-15, 3.32 days)
- That page answered 200 to curl again at 5:19 PM CT, a few minutes after the run, and the dar-window-core quote was on it (checked by hand). The checker's claim-match record was NOT updated, so the next live run will re-read it.
- The 403 most likely came from Task 1's sweep of about 100 dar.org pages just before the run.
- Warning: NEW USE dar-window-core (tool:tool-b.js) on the fallback page, never read against the page by the checker. See the hand check above.
- Plain links: CDC PASSED; FamilySearch BLOCKED (check by hand): https://www.familysearch.org/en/wiki/United_States_Online_Genealogy_Records_by_State
- Held back: 14 still held, 0 restored. Source scope: 0 flagged.

Screenshots: date-check-sar-end-*, gap-rules-line-* (390, 1280).

## Preview (not production)
Code commit 04e51b7fcc418d940662869fba395276c43e2b61. Deployed `--branch t178-preview`: https://t178-preview.patriotinlays.pages.dev (deployment https://4d792c14.patriotinlays.pages.dev).
Playwright at 390px and 1280px: the DAR/SAR line appears once; the SAR end-date note shows in the date check with the unchanged DAR badge; no console errors. Production NOT deployed; cache NOT purged.
