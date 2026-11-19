# t182 release log — ACCURACY BATCH 2 (Nov 19, 2026, America/Chicago)

On top of t180 (4dff1dc; production = d5bb5b1). Preview deploy only (`--branch t182-preview`). NOT deployed to production; cache NOT purged. Routines untouched.

```
t182 ACCURACY BATCH 2: per-item report (Nov 19, 2026, America/Chicago)
Every quote below was checked word for word against the source fetched on Nov 19, 2026 (6:3x AM CT): curl, pdftotext for PDFs, and the site's own normalizer. The full live-source check then re-read each one.

1. WORKSHEET "same period": NO CHANGE NEEDED. It was already fixed in t172 (cbdff53).
   - Searched all of src/, the built site and production for "same period" and "with some exceptions, for": 0 hits.
   - Current worksheet text (lineage-matrix.md): "SAR accepts patriotic service rendered between 19 April 1775 and 25 November 1783. [sar-gcp-window] SAR's Step 1 page gives 26 November; this site follows SAR's Genealogy Committee Policies. [sar-window]"
   - The same wording is on Patriotic Service, and the Roadmap has the Step 1 note.
   - The Roadmap table cell "Patriotic service, with some exceptions, between 19 April 1775 and 25 November 1783" already gives the dates.
   - sar-gcp-window quote, re-verified: "Service must have been rendered between 19 April 1775 and 25 November 1783 except as noted below." (GCP, https://www.sar.org/app/uploads/NSSAR-Genealogy-Policy-Manual-2026-12-5.pdf)

2. CENSUS AND ENSLAVED PEOPLE. 1870 is kept as naming everyone because NARA's 1870 page supports it.
   a. Substitute Evidence matrix, row 1850–1870, "What it can show" column:
      - Old: "Names every household member"
      - New: "The 1850 and 1860 free-population schedules name each household member; enslaved people were counted on separate schedules, generally without names. The 1870 census names every household member."
   b. Census Bridge, "the census gap" paragraph:
      - Old: "The 1850–1870 censuses name everyone, but NSCDA's South Carolina society's standards say they do not state relationships and treat them as supporting evidence only."
      - New: "The 1850 and 1860 free-population schedules name each household member; enslaved people were counted on separate schedules, generally without names. The 1870 census names every household member. NSCDA's South Carolina society's standards say the 1850–1870 censuses do not state relationships and treat them as supporting evidence only."
   Claims (all new):
   - nara-1850-free-names, https://www.archives.gov/research/census/1850: "Name of every person whose usual place of abode on the first day of June, 1850, was in this family."
   - nara-1850-slave-schedule, same page: "Schedule 2 - Slave Inhabitants Name of slave owner Number of slaves"
   - nara-1860-free-names, https://www.archives.gov/research/census/1860: "Name of every person whose usual place of abode on the first day of June, 1860, was in this family"
   - nara-1860-slave-schedule, same page: "Schedule 2 - Slave Inhabitants Name of slave owner Number of slaves"
   - nara-1870-every, https://www.archives.gov/research/census/1870: "Name of every person whose usual place of abode on the first day of June 1870, was in this family."
     The same page says the 1870 law was amended "to cancel the slave schedule".
   Notes:
   - On "generally": the 1850 page notes an exception, a Utah County page that "lists 26 slaves (24 are named)".
   - Census Bridge also says (lines 11 and 37) "earliest census entry that lists every household member by name". It doesn't name 1850–1870, so I left it.
   - The worksheet tool has no "names everyone" text.

3. SAR LOYALTY RULE (Patriot or Loyalist)
   a. Added right after DAR's last-known-act sentence: "SAR's Genealogy Committee Policies say activity disloyal to the American cause of Independence "disqualifies service prior to the act of disloyalty.""
      - Claim sar-gcp-loyalty, GCP §2.5000: "In all cases, activity disloyal to the American cause of Independence disqualifies service prior to the act of disloyalty as acceptable for membership in the SAR."
   b. Opening sentence (editorial):
      - Old: "A lineage society cares about which side your ancestor ended up on, not only about one act of service."
      - New: "Lineage societies look at which side your ancestor ended up on, not only at one act of service, and DAR and SAR each have their own rule."

4. ROADMAP, SAR column of "What has to be proven?"
   - Old: "Family tradition about service is not proof"
   - New: "All names, dates and places on the application must be proven; family tradition about service is not proof"
   - New claim sar-apg-all-proven, APG (https://www.sar.org/app/uploads/APG-07-June-2026.pdf): "All names, dates and places on the application must be proven"
   - Family tradition is kept because it is still sourced: sar-tradition (https://www.sar.org/step-1/, "family tradition in regard to the services of an ancestor will not be considered proof") passed the live check.

5. FAQ, "Can I use a family story or an old family tree as proof?"
   - Added after the SAR family-tradition sentence: "Online or other undocumented family trees are a separate case: SAR doesn't accept undocumented family trees or GEDCOM files as evidence."
   - New claim sar-gcp-undoc-trees, GCP §3.5006(4): "Undocumented family trees and Genealogical Data Communications (GEDCOMS)."
   - The DAR published-genealogy sentence (dar-genealogy-may) is unchanged.

6. FAQ, DAR eligibility
   - Old: "DAR is open to women who can prove they descend from…"
   - New: "DAR is open to women 18 or older who can prove they descend from…"
   - Reused claim dar-join-eligible, https://www.dar.org/discover/become-member/how-join: "Any woman 18 years or older who can prove lineal, bloodline descent from an ancestor who aided in achieving American independence is eligible to join the DAR."

7. PENSION GUIDE TIMELINE, 1820 row
   - Old: "Added proof of financial need" (claim nps-1820, now unused and dropped)
   - New: "Required a certified schedule of estate and income (the 1818 law already limited pensions to veterans in need)". There is no final period, to match the other table cells.
   - New claims from M804 (https://www.archives.gov/files/research/military/army/dc/m804.pdf), Pension Legislation, PDF p. 4:
     - m804-1820-schedule: "to submit a certified schedule of his estate and income to the Secretary of War"
     - m804-1818-need: "Officers and enlisted men in need of assistance were eligible under the terms of the 1818 act"

8. APPLICATION RETURNED SIGNATURES ("Supplementals and replacements (SAR)")
   - Old: "As of <date>, SAR's application guide lists signatures from the applicant, two sponsors, the State Registrar and the State Secretary."
   - New: "New applications: As of <date>, SAR's application guide lists signatures from the applicant, two sponsors, the State Registrar and the State Secretary." The claim sar-apg-signatures is unchanged.
   - Added: "Supplementals: As of <date>, SAR's application guide says, "A supplemental application only requires the signatures of the applicant and the State Registrar.""
     - New claim sar-apg-supp-sig, APG, Missing Signatures: "A supplemental application only requires the signatures of the applicant and the State Registrar"
   - The existing SAR checklist bullet about supplementals is unchanged.

9. APPLICATION RETURNED, service source (pre-submission checklist item 7)
   - Old: "Service source is an original record or a published transcription; SAR doesn't accept unpublished transcriptions or abstracts of legal documents posted online."
   - New: "Service source is an original record, an acceptable published transcription, or a qualifying official record copy; SAR doesn't accept unpublished transcriptions or abstracts of legal documents posted online."
   Claims:
   - sar-gcp-35003-drc (new), GCP §3.5003(1): "Official record copies of applications for membership in the Daughters of the American Revolution (DAR) or the Children of the American Revolution (C.A.R.) approved after 1 January 1985 shall be accepted as evidence of corresponding service, lineage and related facts on SAR applications."
   - sar-gcp-35006-7 (existing), §3.5006(7): "Unpublished transcriptions or abstracts of wills or other legal documents posted online."
   - sar-gcp-45003-pub (new, same GCP): §4.5003 "Publications are admissible which" … "Quote or abstract records of the first two types". Added for "acceptable published transcription", since §3.5003 doesn't cover published transcriptions.

10. CENSUS BRIDGE, step 4
   - Old: "A real father keeps appearing with a matching child in the right bracket."
   - New: "A household that keeps showing a child of the right age stays a candidate; matching age brackets don't identify the child or prove the relationship."
   - Reused claim nara-census-confirm, https://www.archives.gov/research/census/1790-1840.html (Clues in Census Records, 1790-1840): "which the researcher must confirm from other records"

11. ROADMAP STEP 0 (editorial, no claim)
   - Old: "Everything else in this guide depends on knowing which ancestor was the patriot."
   - New: "If you don't know your patriot yet, start with yourself and work back one generation at a time; a name found in a patriot database is a lead until your documented line connects to it."
   - The next sentence "If you don't know your patriot's name yet, start here." was kept, since it wasn't listed and a t124u test pins it. It now repeats the idea.

12a. ROADMAP, "If your patriot is already in DAR's or SAR's database" (record copies)
   - Added after the DAR record-copy lines: "DAR doesn't accept another hereditary society's application, such as a brother's SAR application, as proof."
   - New claim dar-faq-other-societies, https://www.dar.org/national-society/faq/membership: "No, DAR does not utilize applications of other hereditary societies."

12b. ROADMAP, "How to join, in short" step 4, next to SAR's application
   - Added: "For SAR, completing the online form isn't submitting it: print the application and give it to your chapter registrar."
   - New claim sar-apply-print, https://www.sar.org/how-to-apply/ (Option #1, NSSAR Digital Application): "Please make sure that you print off the application and give it to your Chapter Registrar to begin processing."
   - The same paragraph also says: "This is not an automated system (yet)."

Skipped (quote not found): none.
```

## Tests
- Unit (`npm test`): all passed. Lineage Evidence Matrix 114/114, Source-pass 34/34, page-meta 15/15 after the commit (FAQ lastmod expectation updated to 2026-11-19).
- Offline link check: PASSED (0 broken).
- E2E: 400/400, including 19 new t182 checks. Two older checks now accept the t182 wording: t172 #6 (service-source wording) and t127u #1 (Census Bridge NSCDA subject).

## Live-source check (run once): Thu Nov 19, 2026, 6:41 AM CT — Live-source check: RUN, result PASSED
- 423 claims (423 referenced); 79 sources: 76 passed, 3 fallbacks, 0 failed.
- Fallbacks (all HTTP 522, 90-day rule): Step by Step 1 (26 claims), FAQs (11), search_revwar (4). Last pass Nov 5, 2026 10:34 AM CT; the fallback ends Feb 3, 2027 10:34 AM CT.
- Plain links: CDC PASSED. FamilySearch BLOCKED (check by hand).
- Held back: 14 still held, 0 restored. Source scope: 0 flagged.

Screenshots: substitute-census-*, loyalist-sar-rule-*, returned-signatures-*, pension-1820-* (390, 1280).
