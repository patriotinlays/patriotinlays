# patriotinlays.com

A static website of plain-English, source-backed procedure guides for proving descent from a Revolutionary War patriot
(DAR / SAR style lineage applications), plus two client-side tools:

- **Widow Pension Law Checker** (`/tools/widow-pension-checker/`, leads the home page and nav): tests a widow's
  marriage date and her husband's service against the date rules of each federal widow pension and bounty-land law
  (1836 to 1878) and points to the widow's pension file. It describes date rules, it never decides eligibility.
  The old standalone service-date checker was folded into the worksheet's patriot step; `/tools/service-window-checker/`
  (and `/report/`) 301-redirect here via `dist/_redirects`.
- **Lineage Evidence Matrix** (`/tools/lineage-matrix/`): step 1 records the patriot (state, unit, type of service,
  rough dates), checks the dates against DAR's period for that type of service, and feeds the widow checker
  (`?from=worksheet`). Then a generation-by-generation evidence worksheet with direct/indirect and conflict flags;
  every label means "review required". Every gap shows a "Where to look" note fitted to the person's era and state
  (`src/tools/places.js`: state archive guides for VA, MD, NC, NJ, PA, CT, SC, MA, and the censuses in their lifetime),
  linking only Source Manifest URLs or the site's guides. A state with no verified source says so and falls back to
  general advice plus the society's registrar.

Script and CSS URLs carry `?v=<content hash>` (module imports too), so returning visitors never get stale JS after a deploy.

Neither tool searches records. Both open with a plain "How this works" box and a "Load an example" button.

Both tools run entirely in the visitor's browser, make no network requests, and save only to `localStorage`
under the `pi.toolA.*` and `pi.toolB.*` keys.

**Zero-fabrication rule.** Every factual sentence carries a `[[claim:id]]` marker that must resolve to a verified entry
in `manifest/claims.json` (verbatim quote + official source URL). The build fails on any unmarked factual sentence,
unknown or unverified claim, stale entry (> 120 days), quote that no longer appears at its source, or broken link.

## Layout

| Path | What it is |
|---|---|
| `src/content/*.md` | 10 cornerstone guides + 2 tool pages |
| `src/pages/*.md` | About, AI disclosure, Privacy, Contact |
| `src/tools/` | Tool logic (`tool-a.js`, `tool-b.js`), UI modules (`tool-a-ui.js`, `tool-b-ui.js`), `storage.js` |
| `src/assets/` | CSS (responsive + print), header logo, favicons, apple-touch icon and social share image |
| `tools/logo/` | Logo sources and rebuild scripts (`build.py`, `preview.py`, `og_image.py`; fonts under the SIL OFL, see `FONT-LICENSE.txt`) |
| `manifest/` | Source Manifest (`claims.json`) and the Python that regenerates it (`npm run manifest`) |
| `scripts/` | Static site generator, tests, manifest gate, link checker, gates doc generator |
| `ops/gates.js`, `docs/gates.md` | Day 30/60/90 mixed-gate decision rules (code + generated doc) |
| `qa/e2e.mjs` | Headless-browser end-to-end suite (143 checks, incl. 360px, fresh profile and the report page count) |
| `.github/workflows/` | `build.yml` and `ci.yml`. **Both workflows are disabled on GitHub** (they don't run); every check they define is run locally before each deploy instead (see below) |
| `dist/` | Build output (generated; this is what gets deployed) |

There is no `src/components/` directory; tool code lives in `src/tools/`.


### Beginner features (Oct 31, 2026)

- Home page opens with "Just starting? Start here" and a sourced "How to join, in short" box (DAR How to Join, SAR How to Apply).
- The Roadmap guide starts with a sourced "Step 0: find your patriot's name" (old `#step-0-find-the-soldier-s-name` anchor kept).
- Every guide and tool page has a "New here?" definitions box (DAR, SAR, NSCDA, lineage society, patriot, bounty land, Stat.) linking to the glossary.
- Widow checker: a one-line plain answer above the results table and a plain-terms note.
- Worksheet: a "What do you have?" checklist per generation and plain relationship choices ("my 3rd-great-grandfather").
- Worksheet report: a summary first, each "Where to look" block shown once and referenced from the gaps, and a "Save as PDF" button. The example prints on 2 Letter pages with "Save as PDF" and 3 with Ctrl+P (headers and footers on, the way Chrome's print window prints), measured by `npm run e2e` (`exampleReportPages` in `qa/e2e-results.json`).

### FAQ and job aids (Nov 5, 2026, second batch)

- `/faq/`: plain-English answers about eligibility, patriots, records, substitutes, help, cost, privacy and accuracy, all manifest-gated.
- `/walkthroughs/`: both tools walked through with their built-in made-up example families, real screenshots and exact outputs.
- Evidence for the walkthroughs lives in `qa/walkthroughs/outputs.json` and `texts.json`, captured by running the tools: `node scripts/capture-walkthroughs.mjs` after a build. Every `::quote` in `src/pages/walkthroughs.md` must match a captured output, so the page cannot invent a result. `::figure name.png caption` renders a captioned screenshot from `qa/walkthroughs/`, cache-busted like other assets.
- Nav, footer, sitemap, home and tool pages link to both pages; the only other changes are build support and tests.

### Thursday batch (Nov 5, 2026)

- Home page replaced: flowing mission text (`src/partials/home.md`, manifest-gated), subtitle naming DAR and SAR, the locked AI line, the sourced SAR sponsor line, "Ready to get started?" links. The old "Just starting?" path and "How to join" box live in the Roadmap guide.
- Dates use the memorable-date pattern (`src/tools/dates.js`, `src/tools/date-ui.js`): Month / Day / Year plus Exactly / About / Before / After. Stored as `1777-05`, `~1780`, `<1780-05`, `>1781`, so old saved values still load. About = ±2 years (year only) or ±6 months (month and year); the day is ignored.
- 1853 (10 Stat. 154, sec. 2) and February 1855 (10 Stat. 616, sec. 3) widow laws are now tested from the statute text; Navy is a service option in both tools.
- Statute links open the Library of Congress scan at the law's page (`#page=N`); the live source check retries slow downloads (3 tries, 5 minutes each).
- Pension-file help: M805 and ordering a copy with NATF Form 85. Softer "Worth a second look" date warnings, an age ceiling and a died-before-service-ended check. "In short" is a list of short lines.
- 7-question intros on both tool pages; About and Privacy rewritten in plain words; family-tree import feedback line on the worksheet.

### Logo and audit 4 proposals (Oct 31, 2026)

- Header logo (white on navy, 44px tall, 38px on narrow phones), SVG + PNG favicons, apple-touch icon and a 1200x630 og:image; all cache-busted. Sources and rebuild scripts in `tools/logo/`.
- Worksheet: a purpose line; a first visit shows "Start my worksheet" and an inline "Don't know your patriot's name yet?" checklist (ticks saved as `pi.toolB.nameChecklist`), and the steps stay hidden until you start (saved data, the example, or a link to a step opens them).
- Worksheet: each generation with no birth record gets a closed "No birth certificate? Try these substitutes, in order" panel (baptism, Bible, pension file for generation 4+, census or death age, affidavit; use two or more), all from manifest claims.
- Home page: a first-screen note that the site is independent (not affiliated with DAR, SAR or any lineage society) and doesn't search records.
- The unfinished-record label is now "Needs details" (was "Entry Incomplete").

### Round 4 changes (Oct 31, 2026)

- Widow checker with only dates: each law is labelled "Fits" (only when what you typed settles every rule), "Ruled out by the dates", "Ruled out by the service you typed", "Still possible: need X" or "Can't check here", and the answer asks for the one field that settles the most. Battle is Don't know / Yes / No and the 1836 law now asks for his kind of service. Tests prove dates-only input only gives "Fits" when the dates decide every rule, and that a settled answer never flips when more fields are filled in.
- Worksheet page: "Where to look" uses the report's lettered A-L index; gaps and "What to do next" point to letters, each block appears once.
- Worksheet patriot step: "Don't know your patriot's name yet?" links to Roadmap Step 0.
- Home page: shorter (about 1190 to 955 words); start-here path, "How to join, in short" and beginner guides come before the widow checker.

### Audit 3 fixes (Oct 31, 2026)

- Widow checker: a failed rule wins over a missing field (married after his service ended = "Doesn't fit as typed" for 1836, months or not). "What to do next" shows a labelled placeholder until a check runs.
- Report: print shows short source names (e.g. "archives.gov") instead of link addresses; the page-count line matches the measured example; own records (birth, death) come before link records; missing records link to their generation in the worksheet.
- Worksheet: a ticked "Census entry" has a real kind and an "Entry Incomplete" status; "no verified source for this state" notes and census facts print once; missing records get an "+ Add" button.
- Plain terms: "patriot" glossed at its first use on the home page; "society" and "registrar" explained above both tools and in the glossary (SAR How to Apply).

## Requirements

- **Node.js 20** (`.node-version` pins it; no npm dependencies are needed to build the site).
- **poppler-utils** (`pdftotext`), used by the live Source Manifest check to read PDF sources.
  Debian/Ubuntu: `sudo apt-get install -y poppler-utils` · macOS: `brew install poppler`.
- **Python 3**, only if you regenerate the manifest (`npm run manifest`).
- **Chromium/Chrome, for the E2E suite only.** Install the QA driver without adding it to package.json:
  `npm install --no-save --no-package-lock playwright-core@1.64.1`, then either set `CHROME_PATH` to an
  installed Chrome/Chromium, rely on `/usr/bin/google-chrome`, or install Playwright's Chromium with
  `npx playwright-core install --with-deps chromium` and set `E2E_USE_BUNDLED=1`.
- Internet access for `npm run build` (it re-fetches every source and every external link; if a site's bot filter
  answers Node with 403/429, the checkers re-read that page with `curl`, so `curl` must be installed).

## Local verification

```bash
npm test          # service-window (34 + 39 plain-language, answer-line, plain-terms and widow-ordering), lineage-matrix (74), gate examples (29) + exhaustive gate sweep (~30 s)
npm run check     # Source Manifest gate, offline: every factual sentence -> verified manifest claim
npm run build     # prebuild: npm test + live manifest check (fetches all sources);
                  # build: writes dist/; postbuild: internal + external link check
npm run e2e       # headless browser suite against dist/ (needs playwright-core + a Chromium, see above)
```

All four must exit 0 before any deploy. Other scripts: `npm run check:links` (live manifest check only),
`npm run build:pages` (build for Cloudflare's builder, see below), `npm run gates:doc` (regenerate `docs/gates.md`),
`npm run manifest` (regenerate `manifest/claims.json`).

Results land in `test-results-service-window.json`, `manifest-check-report.json`, `build-report.json`,
`link-check-report.json` and `qa/e2e-results.json`.

## Deploying dist/ to Cloudflare Pages

Dashboard wording below was checked against Cloudflare's official docs on Oct 31, 2026
(Pages Git integration, Direct Upload, Custom domains, Build image, Web Analytics; DNS full setup; Email Routing).
Cloudflare renames menus from time to time; if a label differs, follow the linked doc.

Choose **one** method. Cloudflare's docs state you cannot switch a project from Git integration to Direct Upload or
the other way later; you would have to create a new project.

### Option A: Direct Upload with Wrangler (recommended: deploys exactly the dist/ that passed every gate)

Docs: https://developers.cloudflare.com/pages/get-started/direct-upload/

1. On a machine that meets the requirements: `npm run build` (and `npm run e2e`); every step must exit 0.
2. Log in: `npx wrangler login` (opens a browser to authorize Wrangler with Tim's Cloudflare account).
3. Create the project once: `npx wrangler pages project create` → project name `patriotinlays`,
   production branch `main`.
4. Deploy: `npx wrangler pages deploy dist` (from the repo root). The site appears at `patriotinlays.pages.dev`
   (Cloudflare adds random characters if that name is taken).
5. For later releases repeat steps 1 and 4. Preview deploy: `npx wrangler pages deploy dist --branch=<name>`.

Alternative without a CLI: Workers & Pages → **Create application** → **Get started** → **Drag and drop your files**,
enter the project name, drop the `dist` folder, **Deploy site**.

### Option B: Git integration (Cloudflare builds on every push)

Docs: https://developers.cloudflare.com/pages/get-started/git-integration/ ·
build image: https://developers.cloudflare.com/pages/configuration/build-image/

1. Push this repository to GitHub (private is fine).
2. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** → GitHub →
   authorize → select the repository → **Begin setup**.
3. **Set up builds and deployments**:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `npm run build:pages`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `20` (the `.node-version` file also pins it)
4. **Save and Deploy**.

Why `build:pages` and not `build`: Cloudflare's build image does not list poppler-utils, so the live PDF quote check
cannot run there. `build:pages` runs all tests, the offline manifest gate, the build and the internal link check.
The live source re-verification and external link check are defined in GitHub Actions (`build.yml`), and `ci.yml`
defines the E2E suite, but **both workflows are currently disabled on GitHub, so no checks run there**. Every release
is checked locally instead before it is deployed: `npm run build` (unit tests, live source and quote check, build,
link check) and `npm run e2e` (browser suite). If the workflows are ever re-enabled, protect `main` so they must pass.

### Custom domain + GoDaddy nameservers

Docs: https://developers.cloudflare.com/pages/configuration/custom-domains/ ·
https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/ ·
GoDaddy: https://www.godaddy.com/help/edit-my-domain-nameservers-664

An apex domain (`patriotinlays.com`) must be a zone on the same Cloudflare account, which means moving its nameservers.

1. Cloudflare dashboard → **Domains** → **Onboard a domain** → enter `patriotinlays.com` → let Cloudflare scan
   existing records → **Continue** → choose the **Free** plan.
2. Review the DNS records it found (there should be nothing important on a parked domain; note any existing MX
   records before continuing).
3. Copy the **two nameservers** Cloudflare assigns (shown during onboarding and on the zone **Overview** page).
4. GoDaddy: if DNSSEC is on for the domain, turn it off first (Cloudflare's instruction; re-enable it in Cloudflare later).
5. GoDaddy: sign in → **Domain Portfolio** → select `patriotinlays.com` → **DNS** → **Nameservers** →
   **I'll use my own nameservers** → enter the two Cloudflare nameservers exactly → **Save** → **Continue**
   (complete GoDaddy's identity verification if Domain Protection asks).
6. Wait until Cloudflare shows the domain **Active** (Cloudflare says up to 24 hours; GoDaddy says up to 48 hours globally).
   Check with `dig ns patriotinlays.com @1.1.1.1`.
7. Workers & Pages → the `patriotinlays` project → **Custom domains** → **Set up a domain** → `patriotinlays.com` →
   **Continue** → confirm the DNS record Cloudflare proposes. Repeat for `www.patriotinlays.com` if wanted.
8. Optional: re-enable DNSSEC in Cloudflare (DNS → Settings).

### Email Routing for contact@patriotinlays.com

Docs: https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/ ·
pricing: https://developers.cloudflare.com/email-service/platform/pricing/ (inbound routing is available on the Free plan).

The Contact and Privacy pages publish `contact@patriotinlays.com`. **Done:** forwarding is set up and working, so the build no longer prints a launch-setup warning for the Contact page. The steps below are kept for reference.
Requires the domain to be on Cloudflare DNS (previous section).

1. Cloudflare dashboard → **Compute** → **Email Service** → **Email Routing** → **Onboard Domain** → choose
   `patriotinlays.com` → review the MX, SPF and DKIM records Cloudflare will add → **Done**.
2. **Destination Addresses** → enter the inbox Tim chooses → open Cloudflare's email there → **Verify email address**.
3. Back in Email Routing → select the domain → **Routing Rules** → **Create routing rule**:
   Email pattern `contact`, Action **Send to an email**, Destination = the verified inbox → **Save**.
4. Test: send a message to contact@patriotinlays.com from a *different* account and confirm it arrives (check spam).

### Google Search Console: verify and submit the sitemap

Docs: https://support.google.com/webmasters/answer/9008080 · https://support.google.com/webmasters/answer/7451001

1. https://search.google.com/search-console → add a property → **Domain** → `patriotinlays.com`.
2. Search Console shows a TXT record (`google-site-verification=…`). In Cloudflare → the zone → **DNS** → **Records** →
   **Add record**: Type `TXT`, Name `@`, Content = the full string → Save.
3. Back in Search Console select **Verify** (Google notes manual records can take a day or two to be seen). Keep the TXT
   record afterwards; removing it un-verifies the property.
4. Search Console → **Sitemaps** → enter `https://patriotinlays.com/sitemap.xml` → **Submit**. Status should become
   **Success** (17 URLs). `robots.txt` also points to the sitemap and blocks the two `noindex` report pages.

### Cloudflare Web Analytics

Docs: https://developers.cloudflare.com/pages/how-to/web-analytics/

1. Workers & Pages → the `patriotinlays` project → **Metrics** → under **Web Analytics** select **Enable**.
2. Cloudflare injects its beacon on the **next deployment**, so redeploy (Option A step 4, or push a commit for Option B).
3. View data under **Web Analytics** in the dashboard. It feeds the Report-Page Engagement Proxy used by the gates
   (report-page views ÷ tool-page views).

## After launch

- Gates: evaluate Day 30, 60 and 90 with `ops/gates.js` (rules and the D90-9 refresh / re-test in `docs/gates.md`).
- AdSense: apply only after a Day-90 PASS; ad code and `ads.txt` are added then, and the Privacy page is updated first.
- Re-run `npm run build` at least every 120 days; the manifest age gate fails the build when sources go stale.

### t124u (Nov 9, 2026)
- Separate `/ai-disclosure/` page (AI text moved unchanged from About); every footer starts "About · AI disclosure".
- Sources lists: a "Used for: ..." label per source (`scripts/lib/source-labels.mjs`, build fails if a URL has no label); raw URLs hidden on screen, shown in print.
- Every outside link opens in a new tab (`rel="noopener noreferrer"`, small inline SVG icon, sr-only "(opens in new tab)"), in built pages and tool-rendered links (`markExternal` in `src/tools/storage.js`).
- `{{asof:claim-id}}` in content expands to "As of <last-passed date>," from `manifest/source-last-passed.json`; the build fails if the source has no record.
- Worksheet birth/death/marriage notes for Connecticut and Georgia (12 vital states, 13 service states). Massachusetts dropped (live check failed).
- check-manifest re-reads tiny Incapsula bot-check pages (up to 4 curl retries) and never widens the fallback.

### t125u (Nov 9, 2026)
- Process rule: run the full live-source check (`node scripts/check-manifest.mjs --links`) before EVERY deploy, including visual-only batches.
- About now says the quote check runs "each time the site is updated, and on a regular schedule" (FAQ wording).
- Home SAR line and glossary no longer say "often the chapter registrar" (Tim approved the lock change).
- Widow checker storage note: plain text, no `pi.toolA` key names.
- Worksheet: Massachusetts birth/death/marriage note from the Mass.gov State Library guide (13 vital states, 13 service states).

### t126u (Nov 9, 2026)
- Widow checker storage note starts with "Nothing is sent anywhere." again.

### t127u (Nov 9, 2026)
- Source scope tags (standing rule): every source in `manifest/src/sources.py` has a `SCOPE` of national / state / chapter-local / third-party, copied to each claim as `source_scope` (manifest build fails if a source is untagged). `scripts/lib/source-scope.mjs` flags any sentence or tool text worded as a society-wide rule ("DAR says", "SAR:", "NSCDA lists", "As of ..., SAR says") without a cited claim from that society's national source; the gate fails on any flag (`Source scope (rule 7): N flagged`). Test: `scripts/test-source-scope.mjs`.
- `{{asof:}}` is only allowed for national or state sources; the build stops otherwise.
- The 2023 Ohio Society SAR presentation (chapter-local) and NSCDA's South Carolina standards (state) are attributed by name; SAR new-member signatures come from SAR's national application checklist.
- February 28, 1855 navy-widow law cited as ch. 126, sec. 3, 10 Stat. 616 (chapter begins at 615); 10 Stat. 701 is only the March 3, 1855 bounty-land act.
- Worksheet: step 1 is the patriot, step 2 starts the family with yourself; removing the oldest generation asks for confirmation.

### t133 (Nov 10, 2026)
- Home: the page-level "About this site · AI disclosure · Privacy" row is gone (the footer has those links).
- Footer under 600px: two-column grid, each link on one line; desktop unchanged.
- The old "Ready to start?" box (`START_HERE`) is now the home page's three start cards (`START_CARDS`) on About, AI disclosure, Contact, FAQ, Privacy, Sources, Walkthroughs and 404.
- Less empty space above the footer on phones.

### t132 (Nov 10, 2026)
- Guide and tool pages: the definitions box is titled "Terms used on this page", closed by default, opens on tap, and prints expanded (`details.defs::details-content` in print CSS). The home glossary stays open.
- Privacy: Tim's sentence replaces "The site itself collects nothing." and the Cloudflare sentence; the ads line stays.
- Application Returned: the $100 SAR fee claim (ohsar-fee) is removed from the page and manifest; the non-refundable line is followed by "Confirm current fees with your registrar."

### t130 (Nov 10, 2026) — usability batch
- Home: Tim's intro sentence under the heading, three "Start here" cards (worksheet, widow checker, roadmap; stacked on phones, three across from 760px) with navy buttons, and a "See how the tools work" line. The "Ready to get started?" box is gone; the longer paragraphs follow unchanged. Guide titles in the home list are bolder/larger; more space between major sections.
- Worksheet: "Start with just the patriot and me" (default; creates the Patriot section and Generation 1 only) and "See a filled-in example" (asks "Loading the example replaces your current entries. Continue?" when entries exist). The form is grouped into "Your patriot" and "Generations"; only the newest generation is open, older ones collapse under a heading with their name. The rarely used "disagrees with another record" box sits under "More details". Saved data format unchanged.
- Print: both reports hide menu, footer and buttons (e2e t130 #4); page counts unchanged (example 2/3, persona B 2/3).
- Pension-file guide: one real page from M804 (W. 14,734, Jacob Daniels, N.H., NAID 54368689, image 4156793_00373.jpg), downloaded from catalog.archives.gov, cropped and compressed to 119 KB, with alt text, caption and 3 numbered labels (`::archive-figure`, `src/figures/m804-daniels.json`).
- Held back (t129): dar-each-relationship (FAQ) and dar-review-staff (limits box) uses reverted; all 14 held DAR uses are in `manifest/held-back.json` and restore automatically (`scripts/lib/held-back.mjs`) when every DAR page they depend on passes live in a run.
- `qa/page-weight.mjs` measures bytes for home, worksheet and the pension guide.

### t128u (Nov 10, 2026)
- Per-claim match records (`manifest/claim-last-matched.json`, `scripts/lib/claim-match.mjs`): every live quote match records the claim's URL, exact quote, time and the pages using it. When a source is on the 30-day fallback, a claim with no earlier match against that page (new claim, changed quote or moved source) is HELD and the gate fails; a matched claim used on a new page or tool since its match is a `NEW USE` warning. The three DAR pages unreachable since Nov 5 were seeded from the committed Nov 5 report (5cf3fab `manifest-check-report.json`, 10:34:49 AM CST: FAQs 13/13, Step-by-step 28/28, search_revwar 4/4 quotes found, 0 missing). Tests in `scripts/test-source-pass.mjs`.
- The t127 rewordings that newly used `dar-usually-acceptable` / `dar-lineage-sources` are held back (South Carolina-attributed NSCDA wording restored) until those DAR pages are reachable again.
- FAQ "Do I have to hire a genealogist?": Tim's sentence "SAR's national site says your sponsor is often the local chapter registrar." sourced to sar.org/how-to-apply (national).
- Application Returned: supplemental signatures now from SAR's national application checklist; DAR record copies stay attributed to the Ohio presentation.
