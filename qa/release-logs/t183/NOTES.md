# t183 release log — Roadmap Step 0 sentence, production deploy (Nov 19, 2026, America/Chicago)

On top of t182 (7ab3677 code, e2f987c log). Tim authorized a production deploy (pt183u), on condition that the tests and the live-source check pass. Routines untouched.

## Change (exact)
- Roadmap Step 0 (src/content/lineage-proof-roadmap.md):
  - Old: "If you don't know your patriot's name yet, start here."
  - New: "To search for your patriot's name, use the tools below."
- E2E t124u #9 was updated to the new sentence; it also checks that "start here." is gone. No other edits.

## Tests
- Unit (`npm test`): all passed. Lineage Evidence Matrix 114/114, Source-pass 34/34, page-meta 15/15.
- Offline link check: PASSED (0 broken).
- E2E: 400/400.

## Live-source check (run once): Thu Nov 19, 2026, 6:56 AM CT — Live-source check: RUN, result PASSED
- 423 claims (423 referenced); 79 sources: 76 passed, 3 fallbacks, 0 failed.
- Fallbacks (all HTTP 522, 90-day rule): Step by Step 1 (26 claims), FAQs (11), search_revwar (4). Last pass Nov 5, 2026 10:34 AM CT; the fallback ends Feb 3, 2027 10:34 AM CT.
- Plain links: CDC PASSED. FamilySearch BLOCKED (check by hand).
- Held back: 14 still held, 0 restored. Source scope: 0 flagged.
