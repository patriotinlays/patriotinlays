# t193 release log (Tim's "t192", with the t195 amendments): "Should You Hire A Pro?" + Privacy cookie line

Code commit: a04d1f9. Preview only (--branch t193-preview). NOT deployed to production (waiting for Tim's "deploy [commit]").

## New guide: /guides/hire-a-pro/ (guide 11 of 11)
Tim's text as written, with [S#] markers as manifest claims. Headings Title Case (already as written).
"Questions to ask before you hire:" renders as a list lead-in paragraph (not a heading), like the other lead-ins.
Listed: home guide list, sitemap.xml (21 URLs), worksheet "Related guides" line, Application Returned's "Next guide" link. Canonical apex.
Layout pieces every guide has (needed by the build/tests, not new content): In Short box (3 lines from the guide's own text),
"Terms Used On This Page", "What to do next" partial, "Guide N of 11" meta line, Sources list with Last checked dates,
meta description (139 chars). The template count "Guide N of 10"/"All 10 Guides" now uses the real guide count (11).
contact@patriotinlays.com is a mailto link, same as the Contact page.

## Claims (14 new, 11 new sources) - all matched in this run's live check
S1 SAR_RESEARCH_CONTACT (national): sar-rc-helpers, sar-rc-rate
S2 DAR_LIB_SEARCHSVC (national, www.dar.org reachable; Node 403 -> verified with curl): darlib-search-member, darlib-search-nonmember
S3 SAR_LIB_RESEARCH (national): sarlib-copies-15
S4 ICAPGEN_COST (third-party): icapgen-50-200
S5 MAYFLOWER_RS PDF (third-party): mayflower-app-prep
S6 LLC_LINEAGE (third-party; t195 URL .../2017/11/18/...): ll-no-guarantee (used twice)
S8 BCG_ABOUT + BCG_HOME (third-party; t195 wording): bcg-award, bcg-find
S9 APG_ABOUT (third-party; t195 wording, www.apgen.org/about_us.php): apg-professional-org, apg-2000-members; directory linked to https://www.apgen.org/directory
S10 ICAPGEN_FIND (third-party): icapgen-directory
S11 reused SAR_APPLY claims sar-sponsor-often-registrar + sar-registrar-guide (FAQ)
S12 reused DAR_JOIN claim dar-member-guides
Privacy: cf-wa-no-cookies (CF_WA, third-party, https://www.cloudflare.com/web-analytics/)
S7 (internal, no claim): confirmed on the worksheet page - "What to do next" plan and report you can print or save as a PDF;
"saved only in this browser" + "Clearing your browser data or switching browsers deletes your work."; best label "Evidence Entered — Review Required";
"It shows what is still missing for each generation and where to look for it."
No "As of [date]" on any third-party source.

## Removed: none (after t195). Before t195, the original S9 quote "directory of more than 2,000 genealogy professionals" was not on apgen.org/cpages/about (redirects to about_us.php); t195 replaced the bullet.

## Tests
Unit all pass (page-meta 15/15: page count 23 -> 24). Offline links: 0 broken. E2E 436/436 (11 guides in the guide lists; new t193 checks; sitemap 21; Privacy regex).
Live-source check: RUN 9:12-9:15 AM CT - PASSED. 90 sources: 87 pass, 3 DAR 522 fallbacks (90-day, ends 2027-02-03), 0 failed; plain link FamilySearch BLOCKED; 447/447 claims; 14 held.
Beacon blocked in all test browsers (qa/lib/block-beacon.mjs, unchanged).
