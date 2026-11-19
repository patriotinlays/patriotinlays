# t185 release log ([pt185u]): production deploy of t184 (049223b) + three fixes

Code commit: 2b5631a (on top of t184 049223b / 0b6920f).

## Fixes (exact old -> new)
1. src/content/bounty-land-warrants.md In Short:
   - Old: "Then: log any mismatch between the land and the family's home in the Lineage Evidence Matrix."
   - New: "Then: if records give incompatible residences or identities, flag the conflict in the Lineage Evidence Matrix."
2. Widow wording:
   - src/partials/limits-widow.md (and the identical sentence in the checker's "How this works" box in scripts/build.mjs):
     "...the date rules in each federal widow pension and bounty-land law, as the National Archives describes them..." ->
     "...the date rules in the major federal widow pension and bounty-land laws, as the National Archives describes them..."
   - Home start card (scripts/build.mjs): "Compare a widow's marriage date and her husband's service with each federal widow pension law." ->
     "Compare a widow's marriage date and her husband's service with the major federal widow pension laws."
3. src/tools/places.js Virginia notes (claims unchanged: lva-bmd-pre1853, lva-bmd-rare):
   - Birth: "Virginia had no statewide recording of births before 1853, ..." -> "Virginia did not systematically record births statewide before 1853, ..."
   - Death: "Virginia did not record deaths statewide before 1853, ..." -> "Virginia did not systematically record deaths statewide before 1853, ..."
   - Marriage: "Virginia did not record marriages statewide before 1853, but many earlier marriage records survive." ->
     "Virginia did not systematically record marriages statewide before 1853; many pre-1853 marriage records survive."

## Tests
- Unit (npm test): all suites pass (lineage-matrix 114/114 after updating the audit-2 Virginia regex + one test title to the new wording).
- Offline links: 23 HTML files, 1412 internal links, 0 broken.
- E2E: 423/423 (new t185 #1-#3 checks; the older audit-2 birth-gap assertion updated to the new wording).
- page-meta: 15/15 (no lastmod expectation changes needed).

## Live-source check: RUN (Nov 19 2026, 7:19-7:22 AM CT)
PASSED. 79 sources: 76 pass, 3 known DAR 522 fallbacks (last passed 2026-11-05, fallback ends 2027-02-03, 90-day rule), 0 errors. FamilySearch plain link 403 BLOCKED (allowed). 433/433 claims; 14 held unchanged.

## Production
- Deploy: https://ea6e7537.patriotinlays.pages.dev (--branch main), built from 2b5631a.
- Purge: purge_everything on zone 68ec3668... -> success:true, errors [].
- Public check (https://patriotinlays.com, cache-busted curl + Playwright 390/1280): all 3 fixes PASS (places.js?v=9f6a32e400 has the new Virginia notes, none of the old); t184 items 1-10 spot-checked PASS; no horizontal overflow on 8 pages at 390/1280; 0 console errors. Screenshots: public-*-390.png / public-*-1280.png.
