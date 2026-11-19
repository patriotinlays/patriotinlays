# t196 — "11 guides" count fix + production deploy (Tim approved Nov 19, 2026)

Code commit: 1d41e32

## Changes
- Home line (scripts/build.mjs): "Two free tools and 11 guides help you organize what you have and see what's still missing. What you type into the tools stays in your own browser."
- About body (src/pages/about.md): "The site has 11 plain-English guides and two free tools…"
- About meta description (scripts/lib/page-meta.mjs, 151 chars): "Who this site is for, what its 11 guides and two free tools can and cannot do, and how every fact is tied to a quoted official or institutional source."
- Test pins updated: qa/e2e.mjs (two home-line pins), scripts/test-page-meta.mjs (About lastmod now 2026-11-19).
- Not changed (reported only): ops/gates.js:2, docs/gates.md:5, scripts/gen-gates-doc.mjs:8 ("10 guides + 2 tools"); README.md:331 ("Each of the 10 guides…").

## Checks
- Live-source check: RUN (Nov 19, 2026, 9:25–9:29 AM CT) — 90 sources: 87 pass, 3 DAR 522 fallbacks (fallback window ends 2027-02-03), 0 failed; FamilySearch plain link BLOCKED (403, expected). Claims 447/447 matched, 14 held.
- Unit tests (npm test): all pass (page-meta 15/15, title-case 60/60, Skip for now 26/26, nysed TLS 5/5, Source scope 19/19, Held-back restore 10/10, …).
- Offline link check: 24 HTML files, 1475 internal links, 0 broken.
- E2E: 436/436.

## Deploy
Production deploy of this commit includes a04d1f9 (hire-a-pro guide, Privacy cookie line). Deploy/purge/public-verification results are recorded in the t196 report to Tim.
