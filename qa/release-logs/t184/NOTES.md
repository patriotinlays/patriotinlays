# t184 release log — ACCURACY BATCH 3 (Nov 19, 2026, America/Chicago)

On top of t183 (9f8e063; production = 8c35325). Preview deploy only (`--branch t184-preview`). NOT deployed to production; cache NOT purged. Routines untouched.

```
t184 ACCURACY BATCH 3: per-item report (Nov 19, 2026, America/Chicago)
Every quote below was checked word for word against the source fetched on Nov 19, 2026 (about 7:05 AM CT): curl, pdftotext for PDFs, and the site's own normalizer. The full live-source check (7:11 AM CT) then re-read each one. Nothing was skipped.

1. RECORDS BY STATE, Library of Virginia bounty land (records-by-state.md)
   - Old: "The Library of Virginia has put images of those state bounty-land application files and certificate files online."
   - New: "The Library of Virginia's online collection consists of images of application files for military bounty land. The certificate files and registers have not been digitized, but they are available on microfilm."
   - Source: https://lva-virginia.libguides.com/bounty-claims/home
     - lva-files-online (new): "The online collection consists of images of application files for military bounty land"
     - lva-not-digitized (new): "The certificate files and registers have not been digitized, but they are available on microfilm"
   - The old claim lva-files is no longer used and was dropped.
   - Note: the page's full sentence reads "…images of application files for military bounty land and related military certificate files." The new wording uses only the application-files part, so it doesn't say certificate files are online.

2. SUBSTITUTE EVIDENCE, after NSCDA's "Other societies' papers" advice
   - Added (Tim's wording): "For SAR, qualifying official DAR, C.A.R. and SAR record copies can be accepted as evidence."
   - Claims, from GCP (https://www.sar.org/app/uploads/NSSAR-Genealogy-Policy-Manual-2026-12-5.pdf):
     - sar-gcp-35003-drc (reused), §3.5003(1): "Official record copies of applications for membership in the Daughters of the American Revolution (DAR) or the Children of the American Revolution (C.A.R.) approved after 1 January 1985 shall be accepted as evidence of corresponding service, lineage and related facts on SAR applications."
     - sar-gcp-35004-sar (new), §3.5004(1): "Official record copies of applications for membership in the Sons of the American Revolution approved after 1 January 2012 shall be accepted as evidence of corresponding service, lineage and related facts on SAR applications."
   - Note: §3.5003 itself covers DAR and C.A.R. SAR's own record copies are in §3.5004. §3.5003(2) refers to "These official DAR, SAR, or C.A.R. record copies, used to support a SAR application…"

3. APPLICATION RETURNED, pre-submission checklist item 5
   - Old: "As of <date>, DAR says its fields take no slashes, quotation marks or ampersands."
   - New: "DAR only: As of <date>, DAR says its fields take no slashes, quotation marks or ampersands. SAR's application guide differs: use slashes to show other spellings of a name, and put any nickname you enter in quotation marks."
   - Claims, from APG "Names on the Application" (https://www.sar.org/app/uploads/APG-07-June-2026.pdf):
     - sar-apg-slashes (new): "Use slashes to indicate additional spellings of the name"
     - sar-apg-nicknames (new): "When entered, they are to be in quotation marks"

4. PATRIOTIC SERVICE, Petitions row (after DAR's religious-petition exclusion)
   - Added: "; SAR: "Petitions on any subject can be accepted," including the relationship between church and state, from petitioners recognizing the authority of revolutionary governments"
   - Claims, from GCP:
     - sar-gcp-petitions-any (new), §2.3002(3)(e): "Petitions on any subject can be accepted. This includes, but is not limited to, petitions on military processes, locations of county boundaries, and the relationship between church and state."
     - sar-gcp-petitioners-authority (new), §2.3002(3)(d): "Petitioners recognizing the authority of revolutionary governments, Continental, provincial/state, or local."

5. BOUNTY LAND WARRANTS, "How to use a bounty-land file" step 4
   - Old: "Log any mismatch between the land and the family's known home as a conflict in the Lineage Evidence Matrix, then resolve it."
   - New (Tim's wording): "Don't assume the family moved to the bounty land; many veterans sold their warrants. Flag a conflict only if records give incompatible residences or identities."
   - Reused claim m804-sold, M804 (https://www.archives.gov/files/research/military/army/dc/m804.pdf): "they remained in their old homes and sold the warrants"
   - Not changed (not listed): the guide's In Short line still says "Then: log any mismatch between the land and the family's home in the Lineage Evidence Matrix." Tim may want that matched.

6. WIDOW CHECKER (no claim change)
   - "each federal widow pension and bounty-land law from 1836 to 1878" became "the major federal widow pension and bounty-land laws from 1836 to 1878" in 3 places:
     - widow-pension-checker.md intro
     - the "What it is" line
     - the page's meta description (scripts/lib/page-meta.mjs; now 155 characters, the maximum)
   - Not changed (not the listed text):
     - limits-widow partial: "date rules in each federal widow pension and bounty-land law, as the National Archives describes them"
     - home start card: "with each federal widow pension law."

7. WORKSHEET, Virginia (lineage-matrix.md, "Where to look" notes)
   - Old: "Virginia did not record births, marriages and deaths statewide before 1853"
   - New: "Virginia did not systematically record births, marriages and deaths statewide before 1853; many pre-1853 marriage records survive"
   - I dropped Tim's last word "locally" because the source doesn't say it. The page says "The Library also has … a range of pre-1853 marriage records."
   - Claims, from https://lva-virginia.libguides.com/bmd:
     - lva-bmd-pre1853 (reused): "Before 1853, systematic statewide recording of births, marriages, and deaths did not occur in Virginia."
     - lva-bmd-rare (reused): "Many pre-1853 marriage records survive, but birth and death records are rare."
   - Not changed: the tool's Virginia notes in places.js ("did not record deaths/marriages statewide before 1853 …") aren't the listed text.

8. APPLICATION RETURNED, gaps and conflicts
   a. Checklist item 8:
      - Old: "Run the Lineage Evidence Matrix report and clear every gap and conflict it lists."
      - New: "Run the Lineage Evidence Matrix report. Review each gap with your registrar; a blank box isn't automatically a defect. Resolve real conflicts in writing and keep the conflicting evidence."
   b. In Short "Then" line, which the format limits to about 20 words with only tool links:
      - Old: "Then: run the Lineage Evidence Matrix report and clear every gap and conflict it lists."
      - New: "Then: run the Lineage Evidence Matrix report and review each gap with your registrar."
   - Both SAR parts are sourced; nothing here is unsourced:
     - sar-apg-not-every (new), APG PDF p. 5: "The applicant is not required to provide every name, date, and place on the application"
     - sar-gcp-32001 (new), GCP §3.2001: "the applicant must present the conflicting evidence and provide a written explanation of how to resolve the conflict"
   - "Review each gap with your registrar" is editorial guidance.

9. APPLICATION RETURNED, "Service questioned" (the "does not recognize the service source" row), Fix column
   - Old: "Supply the original record or a transcription of it"
   - New: "Supply the original record or a transcription of it. The record must name your patriot and show qualifying service, not just exist; DAR says the source must be found and confirmed as accurate"
   - Claims, from https://blog.dar.org/2021/02/26/why-was-his-service-removed:
     - darblog-found-confirmed (new): "it must be found and confirmed as accurate to meet current DAR standards"
     - darblog-not-in-source (new): "Sometimes the Patriot doesn’t appear in the source, or what the source says doesn’t qualify as service."

10. "FIND LOCAL HELP" / CHAPTER LOCATOR LINKS (no claim changes)
   Destinations, opened this run:
   - https://www.dar.org/discover/become-member/chapter-locator: 200, title "Chapter Locator | Daughters of the American Revolution" (H1 "CHAPTER LOCATOR")
   - https://www.sar.org/find-your-contact/: 200, title "Find Your Local Society Contact – National Society Sons of the American Revolution"
   Changed:
   - next-steps-lineage partial (shown on 5 guide pages):
     - "DAR's [Chapter Locator]" → "The [DAR Chapter Locator]"
     - "[pick your state on SAR's contact page]" → "pick your state on [SAR's Find Your Local Society Contact page]"
   - next-steps-widow partial (shown on 5 guide pages): the same two changes.
   - how-to-join partial (Roadmap "Find local help"):
     - "DAR's [chapter locator]" → "The [DAR Chapter Locator]"
     - "[find your state's contact]" → "find your state's contact on [SAR's Find Your Local Society Contact page]"
   Already named, unchanged:
   - Sources lists: "DAR — Chapter Locator" and "SAR — Find Your Local Society Contact"
   - Tool buttons (next-steps.js): "DAR Chapter Locator (find a DAR chapter near you)" and "SAR: Find Your Local Society Contact (pick your state)"
   - Walkthroughs mentions DAR's Chapter Locator without a link.
   E2E now checks every locator/contact link on the built pages.
```

## Tests
- Unit (`npm test`): all passed. Lineage Evidence Matrix 114/114, Source-pass 34/34. page-meta 15/15 after the commit (Same Name, widow checker and lineage-matrix lastmod expectations updated to 2026-11-19).
- Offline link check: PASSED (0 broken).
- E2E: 420/420, including 20 new t184 checks.

## Live-source check (run once): Thu Nov 19, 2026, 7:11 AM CT — Live-source check: RUN, result PASSED
- 433 claims (433 referenced); 79 sources: 76 passed, 3 fallbacks, 0 failed; 0 NEW USE warnings.
- Fallbacks (all HTTP 522, 90-day rule): Step by Step 1 (26 claims), FAQs (11), search_revwar (4). Last pass Nov 5, 2026 10:34 AM CT; the fallback ends Feb 3, 2027 10:34 AM CT.
- Plain links: CDC PASSED. FamilySearch BLOCKED (check by hand).
- Held back: 14 still held, 0 restored. Source scope: 0 flagged.
- After the run, the In Short "Then" line on Application Returned was shortened to fit the In Short format (item 8b). That edit only removed two claim markers from that line and added no claim or source. The same claims are still cited in checklist item 8.
