# t172 release log — accuracy batch (Nov 13, 2026, America/Chicago)

Preview only (`--branch t172-preview`). Not deployed to production. Cache not purged.

## Live-source check (run once)

- Live-source check: RUN, result PASSED
- checkedAt: Friday Nov 13, 2026, 8:42 AM CT (Fri Nov 13 2026 08:42:26 GMT-0600)
- Claims: 410 referenced / 410 in the manifest
- Sources: 73 (70 passed HTTP 200, 3 known DAR 522 fallbacks, 0 failed)
- Fallbacks (last pass 2026-11-05T16:34:49.000Z, age ~7.92 days): App_Help_Step_By_Step_1, FAQs, search_revwar
- Held back: 14 still held, 0 restored
- Source scope (rule 7): 0 flagged
- New quotes all matched: GCP 12 found / 0 missing; APG 10/0; M804 44/0; NARA census 8/0; Step 1 13/0

## Tests

- Unit: all passed (`npm test`)
  - Service Window Checker: 36/36 scenarios; Plain-language checks 57/57 (includes t172 #2d navy not ruled out)
  - Lineage Evidence Matrix: 96/96
  - Mixed-gate matrix: 19,906,560 combinations; Gate examples 29/29
  - Source-pass rules: 27/27; Quote normalization: 9/9; Live-source status: 7/7
  - Skip for now: 26/26; nysed TLS: 5/5; Source scope: 19/19; Held-back: 10/10
  - Page-meta: 15/15 (lastmod expectations updated for 2026-11-13 after this commit)
  - Title-case: 60 passed, 0 failed
- Offline link check: PASSED, 23 HTML files, 1393 internal links, 76 unique external URLs
- E2E: 351/351 (was 345 at t170; +t172 checks). Persona-B full report ceiling raised 3 → 4 pages because the SAR §3.4001 sentence was added to worksheet cautions.

## Item 4 — 2015 points removed

Removed because they conflict with current GCP §2.4004 (tax payment is deemed Patriotic Service; no “must show the tax supported the War” test):

- “The statute behind the tax has to address a request of the Continental Congress or support the War.” (`sartax-statute`)
- “Unless a society report already approved the tax record, the burden is on the applicant to show the tax supported the War.” (`sartax-burden`)

Replaced (not conflicting, but restated from current policy) with verbatim §2.4004 wording: fees/penalty exclusion, record required, obligation not sufficient, license/personal-benefit exclusion and examples. Kept non-conflicting: no surviving SC/GA lists (`sartax-scga`); DAR 2006 extension; SAR 2012 adoption.

## Item 2d — widow checker navy logic (no logic change)

File: `src/tools/tool-a.js`. Functions: `kindNeed`, `WIDOW_ACTS` `act1836`/`act1838` `test`, `PASS_KINDS = ["continental", "militia"]`.

For 1836 and 1838, `kindNeed` returns `"kindCheck"` when the kind is navy (navy is not in `PASS_KINDS`, and the 1848-only auto-pass does not apply). Status is “Still possible” (need whether the 1832 law covered his kind of service), not “inconsistent” / ruled out. The checker therefore does **not** rule out navy or marine service under the 1836 or 1838 laws because of the 1832 categories. Tim authorized a logic fix only if it did. M804 supports including navy (“Naval and marine officers and enlisted men were also included”), which was added as a sentence on the page and in field help. `PASS_KINDS` is unchanged. A unit test documents the existing Still-possible behavior.

## Production

Not deployed. No cache purge.
