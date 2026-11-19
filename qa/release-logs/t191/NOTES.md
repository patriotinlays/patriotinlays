# t191 release log ([pt191u]): analytics disclosure, www -> apex 301, beacon blocked in tests, "based on" wording

Code commit: 36906e6. Production: https://2f5ec0be.patriotinlays.pages.dev (--branch main). Cache purged (purge_everything, success:true).

## 1a Privacy line
Added: "The site uses Cloudflare Web Analytics to count page visits."
Second sentence ("It doesn't use cookies and doesn't track you across other websites.") NOT used: fetched this run,
https://www.cloudflare.com/web-analytics/ says word for word "Cloudflare Web Analytics does not use any client-side state, such as cookies or localStorage, to collect usage metrics."
(supports the cookie part) and "We also don't "fingerprint" individuals via their IP address, User Agent string, or any other data for the purpose of displaying analytics."
No Cloudflare page checked (that page; developers.cloudflare.com/web-analytics/, /about/, /faq/, /data-metrics/; blog.cloudflare.com/privacy-first-web-analytics/)
says anything word for word about tracking across other websites, so per Tim's rule only the first sentence is used. No claim added (no quote needed for the first sentence).

## 1b wording (old -> new)
- privacy.md (Tim's t132 sentence): "...and adds two small features: a script that hides email addresses from spam robots, and a short error report if a page fails to load."
  -> "...and adds three small features: a script that hides email addresses from spam robots, a short error report if a page fails to load, and a visit-counting script that loads from Cloudflare."
- Widow checker storage note (build.mjs): "Nothing is sent anywhere. Your entries are saved only in this browser..." -> "Nothing you type is sent anywhere. Your entries are saved only in this browser..."
- Worksheet privacy note (build.mjs): "Saved only in this browser. Nothing is sent anywhere." -> "Saved only in this browser. Nothing you type is sent anywhere."
- Widow tool card (build.mjs, shown on /guides/read-pension-file/): "Free; nothing leaves your browser." -> "Free; nothing you type leaves your browser."
- lineage-matrix.md and partials/limits-matrix.md: "Everything you enter is saved only in this browser, and nothing is sent anywhere." -> "Everything you enter is saved only in this browser, and none of it is sent anywhere."
- faq.md: "...stays in your own browser on the device you're using, so there's nothing uploaded to a server somewhere." -> "...so none of it is uploaded to a server."
Not changed: homepage-LOCK lines ("What you type into the tools stays in your own browser.", "It's free, there's nothing to sign up for, and what you type into the tools stays in your own browser.") - still true.
Not changed (not visible to visitors): site.css comment "no outside fonts or services" (true of the stylesheet).

## 2 www -> apex
Canonical: https://patriotinlays.com (all 23 canonical tags, all 20 sitemap <loc>s, robots.txt Sitemap line; Search Console property sc-domain:patriotinlays.com).
www CNAME -> patriotinlays.pages.dev already proxied. Created Single Redirect (zone ruleset 90dfc7141d3a44ba88522a9c945cea63, phase http_request_dynamic_redirect, rule f0e32d8da8be449e9267e59174057ca6):
  when (http.host eq "www.patriotinlays.com") -> 301 to concat("https://patriotinlays.com", http.request.uri.path), preserve query string.
Tests: www /, /faq/?cb=.., /guides/same-name/?a=1&b=two, /tools/lineage-matrix/, /privacy/?utm_source=x, /sitemap.xml, /robots.txt, /no-such-page/ -> 301 with Location on apex, same path+query; apex / /faq/ /privacy/ /sitemap.xml /robots.txt -> 200.

## 3 beacon blocked in tests
qa/lib/block-beacon.mjs wraps browser.newContext/newPage with route-abort for static.cloudflareinsights.com and /cdn-cgi/rum; used by qa/e2e.mjs, qa/page-weight.mjs, scripts/capture-walkthroughs.mjs and new qa/public-check.mjs.
E2E t191 #3 PASS (both requests aborted). Live: public-check.txt - 14 beacon requests aborted, 0 reached Cloudflare.

## 4 "fitted to that person's era and state" -> "based on that person's era and state"
src/content/lineage-matrix.md (worksheet page), src/pages/walkthroughs.md; README.md "fitted to the person's era and state" -> "based on the person's era and state".

## Tests
Unit all pass; page-meta 15/15; offline links 0 broken; E2E 427/427.
Live-source check: RUN 8:15-8:18 AM CT - PASSED, 79 sources: 76 pass, 3 DAR 522 fallbacks (90-day, ends 2027-02-03), 0 failed; FamilySearch BLOCKED; 433/433 claims; 14 held.
Public: curl content checks PASS; Playwright 390/1280 on 7 pages, 0 overflow, 0 page errors; beacon still injected for real browsers (Web Analytics stays on).
