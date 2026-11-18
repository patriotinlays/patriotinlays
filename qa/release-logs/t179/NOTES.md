# t179 release log — DAR source migration, 90-day safety net (Nov 18, 2026, America/Chicago)

On top of t178 (e5b9842). Preview deploy only (`--branch t179-preview`). NOT deployed to production; cache NOT purged. Routines untouched.

## DAR Genealogy Guidelines: not public
Fetched this run with curl (Nov 18, 2026):
- Part One https://www.dar.org/sites/default/files/members/darnet/forms/RGG-4000.pdf: 301 to /system/files/..., then 302 to /dar-members-login. Not public.
- Part Two .../RGG-4001.pdf: 200, but the body is an HTML page titled "Member Only Content" (not a PDF). .PDF variant 301 to the login. Not public.
- Part Three .../RGG-4002.pdf and .PDF: 301 to the login. Not public.
- No newer public edition of Part One found (RGG-1000/1006 also go to the login). pdftotext could not be run because no PDF was served.
So none of Tim's Part One quotes could be verified word for word. Those changes were skipped (dar-no-step, dar-each-relationship, dar-jpg, dar-eapp-established, dar-paper-analysis, dar-nbm, dar-upload-each, dar-case-by-case, dar-genealogy-may, dar-caution-genealogies, dar-review-staff). Step 2 (Parts Two and Three) was not possible.

## Changes
- dar-gen-1-3 re-sourced: https://blog.dar.org/2022/11/28/be-star-dar-genealogy-updates-registrar-general — "It is a must that the first three generations of the application and supplemental have complete dates and places." Site sentences unchanged. Note that the quote does not say "birth and death".
- dar-biological re-sourced: https://www.dar.org/national-society/faq/membership — "All lineage for DAR membership must be bloodline descent." Site sentence unchanged.
- dar-six-weeks removed: the Roadmap "Practical details" sentence and the Application Returned sentence were deleted.
- dar-fee ($75) removed. The Roadmap now uses Tim's wording verbatim: "DAR charges an application fee plus the first year's national dues; chapters and state societies add their own. Ask your chapter registrar for current amounts."
  - New claim dar-fee-dues, citing https://blog.dar.org/2024/05/16/new-commemorative-america-250-membership-certificates — "You must submit both first-year dues and Application fees for new member submissions."
  - Gap: no live DAR quote says "national" dues or that chapters and state societies add their own.
- GRS link: services.dar.org/Public/DAR_Research/search/?Tab_ID=1 returned HTTP 522 (5:41 PM CT), so Roadmap Step 0 "DAR Ancestor Search" now points to https://www.dar.org/research (200, "Research | Daughters of the American Revolution").
- Worksheet page (lineage-matrix.md):
  - Old: "For any other state it says so plainly and falls back to general advice: a census entry that gives the state and approximate year of birth tells you which local office to ask. [[claim:nara-vital-census]]"
  - New: "For any other state it points you to the CDC's Where to Write for Vital Records page and the FamilySearch Research Wiki page for that state."
- Safety net (STANDING RULE): unreachable sources (5xx/timeout) can fall back for 90 days from the last pass (was 30). 403/certificate errors keep 30 days. 404/410, changed quotes and never-passed sources still block. Reports show the last pass and the fallback end date.
  - Code: scripts/lib/source-pass.mjs and scripts/check-manifest.mjs. Documented in README.

## Tests
- Unit (`npm test`): all passed; Source-pass 34/34 (8 new t179).
- Offline link check: PASSED.
- E2E: 379/379 (t179 checks at 390 and 1280). The t124u #10 counts were updated: Practical details now has 2 dated rules, the Roadmap 4.
- page-meta: see below.

## Live-source check (run once): Wed Nov 18, 2026, 5:40 PM CT — Live-source check: RUN, result PASSED
- 409 claims (409 referenced); 76 sources: 73 passed, 3 fallbacks, 0 failed.
- Fallbacks (all HTTP 522). Last pass Nov 5, 2026 10:34 AM CT; the fallback ends Feb 3, 2027 10:34 AM CT (90-day limit):
  - Step by Step 1: 26 claims
  - FAQs: 11 claims
  - search_revwar: 4 claims
- Plain links: CDC PASSED. FamilySearch BLOCKED (check by hand).
- Held back: 14 still held, 0 restored. Source scope: 0 flagged. Node got 403 on 10 dar.org pages; all were verified with curl.
