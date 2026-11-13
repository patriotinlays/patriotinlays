# t173 release log — widow 2b wording (Nov 13, 2026, America/Chicago)

On top of t172 (cbdff53). One change only: drop the unquoted federal-officials clause from the 2b sentence.

## Wording

Old: "It does not look anything up, and it doesn't decide anything. Federal officials decided the historical pension claims; DAR or SAR decides whether your evidence meets its membership rules."

New (Tim, verbatim): "It does not look anything up, and it doesn't decide anything. DAR or SAR decides whether your evidence meets its membership rules."

Files: `src/content/widow-pension-checker.md` (Its limits), `src/partials/limits-widow.md` (What it doesn't do). E2E assertion updated. No other edits.

## Live-source check (run once)

- Live-source check: RUN, result PASSED
- checkedAt: Friday Nov 13, 2026, 8:53 AM CT (Fri Nov 13 2026 08:53:10 GMT-0600)
- Claims: 410 referenced / 410 in the manifest
- Sources: 73 (70 passed HTTP 200, 3 known DAR 522 fallbacks, 0 failed)
- Fallbacks (last pass 2026-11-05T16:34:49.000Z, age ~7.93 days): App_Help_Step_By_Step_1, FAQs, search_revwar
- Held back: 14 still held, 0 restored
- Source scope (rule 7): 0 flagged

## Tests

- Unit: all passed (`npm test`)
  - Service Window: 36/36 scenarios; Plain-language 57/57
  - Lineage Evidence Matrix: 96/96
  - Mixed-gate: 19,906,560; Gate examples 29/29
  - Source-pass: 27/27; Normalize: 9/9; Live-status: 7/7
  - Skip for now: 26/26; nysed TLS: 5/5; Source scope: 19/19; Held-back: 10/10
  - Page-meta: 15/15; Title-case: 60/60
- Offline link check: PASSED, 23 HTML files, 1393 internal links, 76 unique external URLs
- E2E: 351/351

## Production

Deployed to production (`--branch main`) after the checks passed. Cache purged (purge_everything) on zone 68ec36681050311b61f6b66ab9171d20. Public verification on patriotinlays.com (cache-busted curl and Playwright at 390px and 1280px): new 2b text present, federal-officials clause gone; t172 wording (25 November 1783, Step 1 note, junior membership, §2.4004 tax quote) live.
