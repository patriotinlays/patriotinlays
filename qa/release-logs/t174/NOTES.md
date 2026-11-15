# t174 release log — Lineage Evidence Matrix: states outside the 13, "Still living" (Nov 15, 2026, America/Chicago)

On top of t173 (3a94544). Lineage Evidence Matrix only; no other pages. Preview deploy only (`--branch t174-preview`); NOT deployed to production, cache not purged.

## 1. States outside the 13

"Outside the 13" = every entry in the worksheet's state list (`STATES`, 51 entries) except the 13 original states
CT, DE, GA, MD, MA, NH, NJ, NY, NC, PA, RI, SC, VA: 37 states plus the District of Columbia (38 entries).

Wording added (Tim, verbatim; shown for birth, death and marriage records alike):
"For birth, death and marriage records in [state], start with the CDC's Where to Write for Vital Records page and the FamilySearch Research Wiki page for that state."

Links (plain labels, no claims):
- "CDC: Where to Write for Vital Records" — https://www.cdc.gov/nchs/w2w/index.htm
- "FamilySearch Research Wiki: United States Online Genealogy Records by State" — https://www.familysearch.org/en/wiki/United_States_Online_Genealogy_Records_by_State

FamilySearch state pages: NONE linked; all 38 fall back to the index page. familysearch.org answered every automated
read this run with HTTP 403 and an Incapsula bot-filter page (Node fetch, curl with the checker UA and a browser UA,
headless Chrome via Playwright, and the WebFetch tool), for the index page and for a sample state page. The index
could not be read, so no state URL could be discovered, and none could pass a live link check. No URL was guessed
(`FS_STATE_PAGES` is empty).

The live check (`check-manifest.mjs --links`) now checks these plain links:
- CDC: HTTP 200 (Node fetch) — PASSED. (curl gets 403 from Akamai; Node fetch and headless Chrome get 200.)
- FamilySearch index: HTTP 403 Incapsula — BLOCKED, reported as NOT verified (warning, not counted as passed or as a fallback).

The 13 original states keep their verified notes. Their remaining gaps (PA marriage, MD death, MD marriage) keep the
existing "no verified source yet" note.

## 2. Still living

- Checkbox label: "Still living" (was "Still living (then no death record is needed)").
- When ticked, no missing-death gap for that person in any generation. Generations 1–3 already worked this way. Generation 4+ now asks for a birth record instead of "birth or death".
- Report line: "Living: death details not needed."
- Saved data: `pi.toolB.v1` loads as before. A generation with no `living` value is treated as not living (`normalizeLiving`, both on the worksheet and on the report).
- DAR quote: NOT attached. App_Help_Step_By_Step_1/2/3.aspx returned HTTP 522 this run, so the label text alone is used.

## Live-source check (run once)

- Live-source check: RUN, result PASSED
- checkedAt: Sunday Nov 15, 2026, 9:35 AM CT
- Claims: 410 referenced / 410 in the manifest
- Sources: 73 (70 passed HTTP 200, 3 known DAR 522 fallbacks, 0 failed)
- Fallbacks (last pass 2026-11-05T16:34:49.000Z, age 9.96 days): App_Help_Step_By_Step_1, FAQs, search_revwar
- Plain links: CDC 200 PASSED; FamilySearch 403 BLOCKED (not verified)
- Held back: 14 still held, 0 restored. Source scope: 0 flagged.

## Tests

- Unit (`npm test`): all passed. Lineage Evidence Matrix 109/109 (was 96; 2 updated, 13 new). Other suites unchanged.
- Offline link check: PASSED, 23 HTML files, 1393 internal links, 76 unique external URLs
- E2E: 365/365 (was 351; 14 new t174 checks at 390px and 1280px, 3 Ohio/Texas checks updated)

Screenshots: worksheet-old-data-*, worksheet-still-living-*, report-living-* (390, 1280).
