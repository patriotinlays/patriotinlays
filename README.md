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
| `src/pages/*.md` | About (AI disclosure), Privacy, Contact |
| `src/tools/` | Tool logic (`tool-a.js`, `tool-b.js`), UI modules (`tool-a-ui.js`, `tool-b-ui.js`), `storage.js` |
| `src/assets/` | CSS (responsive + print) and favicon |
| `manifest/` | Source Manifest (`claims.json`) and the Python that regenerates it (`npm run manifest`) |
| `scripts/` | Static site generator, tests, manifest gate, link checker, gates doc generator |
| `ops/gates.js`, `docs/gates.md` | Day 30/60/90 mixed-gate decision rules (code + generated doc) |
| `qa/e2e.mjs` | Headless-browser end-to-end suite (127 checks, incl. 360px, fresh profile and the report page count) |
| `.github/workflows/` | `build.yml` and `ci.yml`. **Both workflows are disabled on GitHub** (they don't run); every check they define is run locally before each deploy instead (see below) |
| `dist/` | Build output (generated; this is what gets deployed) |

There is no `src/components/` directory; tool code lives in `src/tools/`.


### Beginner features (Oct 31, 2026)

- Home page opens with "Just starting? Start here" and a sourced "How to join, in short" box (DAR How to Join, SAR How to Apply).
- The Roadmap guide starts with a sourced "Step 0: find the soldier's name".
- Every guide and tool page has a "New here?" definitions box (DAR, SAR, NSCDA, lineage society, patriot, bounty land, Stat.) linking to the glossary.
- Widow checker: a one-line plain answer above the results table and a plain-terms note.
- Worksheet: a "What do you have?" checklist per generation and plain relationship choices ("my 3rd-great-grandfather").
- Worksheet report: a summary first, each "Where to look" block shown once and referenced from the gaps, and a "Save as PDF" button. The example prints on 2 Letter pages with "Save as PDF" and 3 with Ctrl+P (headers and footers on, the way Chrome's print window prints), measured by `npm run e2e` (`exampleReportPages` in `qa/e2e-results.json`).

### Round 4 changes (Oct 31, 2026)

- Widow checker with only dates: each law is labelled "Fits" (only when what you typed settles every rule), "Ruled out by the dates", "Ruled out by the service you typed", "Still possible: need X" or "Can't check here", and the answer asks for the one field that settles the most. Battle is Don't know / Yes / No and the 1836 law now asks for his kind of service. Tests prove dates-only input only gives "Fits" when the dates decide every rule, and that a settled answer never flips when more fields are filled in.
- Worksheet page: "Where to look" uses the report's lettered A-L index; gaps and "What to do next" point to letters, each block appears once.
- Worksheet patriot step: "Don't know his name yet?" links to Roadmap Step 0.
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
