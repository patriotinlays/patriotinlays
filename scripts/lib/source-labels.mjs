// t124u #1: the short "Used for: ..." line under each entry in a page's Sources list.
// Topics only, never facts: each claim maps to a short topic phrase by its claim_id (first matching rule wins, else the
// source's default). A page's label joins the topics of the claims THAT PAGE cites from that source, in order of first use;
// if that runs past MAX_WORDS, the source's default topic (which covers every claim from it) is used instead.
export const MAX_WORDS = 8;
const R = (def, ...rules) => ({ def, rules });
export const SOURCE_TOPICS = {
  "https://www.dar.org/national-society/accepted-revolutionary-war-service": R("the service DAR accepts",
    [/^dar-(window-core|committee-1774|va-oath|galvez-)/, "DAR's accepted service dates"], [/^dar-reserves-right/, "DAR's review of service"], [/./, "kinds of service DAR accepts"]),
  "https://membership.dar.org/NSDAR/AppFormz/App_Help_Step_By_Step_1.aspx": R("DAR application rules",
    [/^dar-(gen-1-3|gen-older|each-relationship|both-parents|biological|no-step)$/, "what DAR asks for each generation"],
    [/^dar-(gen1-applicant|gen-numbering|pedigree)$/, "how DAR numbers generations"],
    [/^dar-jpg$/, "DAR upload file format"],
    [/^dar-(census-cite|upload-each|4digit|symbols|circa|death-post|death-ante|cert-names|cs|ps)$/, "how to fill in DAR's form"],
    [/^dar-(usually-acceptable|caution-genealogies|baptism|no-genealogy-service)$/, "records DAR accepts"],
    [/^dar-(service-state|unit-state)$/, "DAR's service state"], [/^dar-(delay|review-staff)$/, "DAR's review"]),
  "https://membership.dar.org/NSDAR/AppFormz/FAQs.aspx": R("DAR's application questions and answers",
    [/^dar-(six-weeks|nbm)$/, "DAR review time"], [/^dar-fee$/, "DAR application fees"],
    [/^dar-(eapp-established|paper-analysis)$/, "DAR paper or electronic application"], [/^dar-unknown-parent$/, "unknown parents"],
    [/^dar-service-sources$/, "DAR service sources"], [/./, "records DAR accepts"]),
  "https://blog.dar.org/2021/02/26/why-was-his-service-removed": R("why DAR questions or removes service"),
  "https://services.dar.org/Public/DAR_Research/search_revwar/?Tab_ID=14&Tab_ID_Sub=0&action=list": R("DAR's Revolutionary War records indexes"),
  "https://www.sar.org/step-1/": R("SAR eligibility rules",
    [/^sar-window$/, "SAR's service dates"], [/^sar-sponsors$/, "SAR sponsors"], [/^sar-(bloodline|tradition|ggp|no-prelim)$/, "what SAR accepts as proof"],
    [/./, "kinds of service SAR accepts"]),
  "https://www.sar.org/wp-content/uploads/2019/10/Revolutionary-Taxes-as-Evidence-of-Patriotic-Service.pdf": R("when taxes count as patriotic service"),
  "https://cincinnatisar.org/wp-content/uploads/2023/05/Presentation-How-to-Produce-Approval-Ready-Applications-and-Reduce-Turnaround-Time.pdf": R("common SAR application problems",
    [/^ohsar-(fee|nonrefundable)$/, "SAR application fees"], [/^ohsar-30min$/, "SAR review time"],
    [/^ohsar-(signatures|supp-sig|replacements|supp-once|3yrs)$/, "SAR signature and replacement rules"], [/^ohsar-date-format$/, "SAR date format"], [/./, "common SAR application problems"]),
  "https://www.archives.gov/files/research/military/army/dc/m804.pdf": R("pension and bounty-land files",
    [/^nara-act-/, "the federal pension laws"], [/^(m804-bl-|m804-1856|m804-sold|m804-blwt|nara-bounty-1855)/, "bounty-land warrants"],
    [/^m805-/, "the M805 microfilm"], [/^m804-(s|w|r-latest|r-approved|former-widow|dis|55|star)$/, "pension file numbers"], [/./, "what pension files contain"]),
  "https://www.archives.gov/files/research/military/american-revolution/service-records.pdf": R("federal service records",
    [/^nara-svc-/, "where service records are kept"], [/^nara-cmsr-/, "compiled service records"], [/./, "federal record series"]),
  "https://www.archives.gov/research/military/genealogy": R("military records at the National Archives",
    [/^nara-natf8[56]$/, "ordering copies"], [/./, "military records at the National Archives"]),
  "https://www.archives.gov/research/military/american-revolution": R("finding Revolutionary War records online"),
  "https://www.dar.org/library/search.cfm": R("record copies of approved applications"),
  "https://www.dar.org/library/collections/dar-lineage-resources": R("record copies of approved applications"),
  "https://www.sar.org/genealogical-copy-services/": R("record copies of approved applications"),
  "https://www.archives.gov/research/census/1790-1840.html": R("what the early censuses show"),
  "https://www.archives.gov/research/catalog/catalog-bulk-downloads/revwarpensionfiles": R("pension file transcriptions"),
  "https://www.archives.gov/publications/prologue/2015/summer/rev-war-pensions.html": R("a pension-file research example"),
  "https://www.nps.gov/articles/000/what-might-you-find-in-the-revolutionary-war-pension-files.htm": R("pension laws and files",
    [/^nps-(applegate|shoemaker)/, "pension file examples"], [/./, "pension laws and files"]),
  "https://lva-virginia.libguides.com/bounty-claims/home": R("Virginia bounty land"),
  "https://libguides.nypl.org/military-genealogy/revolutionary-war": R("state archives for service records"),
  "https://nscdasnc.memberclicks.net/assets/membership/Standards%20of%20Proof%202025.pdf": R("evidence standards",
    [/^nscda-census/, "censuses as evidence"], [/./, "evidence standards"]),
  "https://uelac.ca/loyalist-directory/help/": R("Loyalist records"),
  "https://www.dar.org/discover/become-member/chapter-locator": R("finding a DAR chapter"),
  "https://www.dar.org/discover/become-member/how-join": R("joining DAR"),
  "https://www.sar.org/how-to-apply/": R("applying to SAR"),
  "https://www.sar.org/find-your-contact/": R("finding an SAR contact"),
  "https://www.loc.gov/collections/united-states-statutes-at-large/about-this-collection/": R("reading statute citations"),
  "https://www.dar.org/discover/become-member/what-dar": R("what DAR is"),
  "https://www.sar.org/sar-missions-and-goals/": R("who SAR is and who can join"),
  "https://nscda.org/about/membership/": R("what NSCDA is"),
  "https://lva-virginia.libguides.com/revolutionary-war/home": R("Virginia service records"),
  "https://lva-virginia.libguides.com/bmd": R("Virginia birth, marriage and death records"),
  "https://guide.msa.maryland.gov/pages/viewer.aspx?page=military": R("Maryland service records"),
  "https://guide.msa.maryland.gov/pages/viewer.aspx?page=birth": R("Maryland birth records"),
  "https://appx.archives.ncdcr.gov/findingaids/TRPR_Troop_Returns_Collection.html": R("North Carolina troop records"),
  "https://vitalrecords.nc.gov/research.htm": R("North Carolina vital records"),
  "https://nj.gov/state/archives/guides/sdea0003.pdf": R("New Jersey service rosters"),
  "https://www.nj.gov/state/archives/search-genealogical-collections.shtml": R("New Jersey vital records"),
  "https://www.pa.gov/agencies/phmc/pa-state-archives/research-online/research-guides/revolutionary-war-overview": R("Pennsylvania service records"),
  "https://www.pa.gov/agencies/health/programs/vital-records/genealogy": R("Pennsylvania birth and death records"),
  "https://www.pa.gov/services/phmc/request-a-birth-or-death-certificate": R("Pennsylvania birth and death records"),
  "https://libguides.ctstatelibrary.org/hg/militaryrecords/revwar": R("Connecticut service records"),
  "https://scdah.sc.gov/sites/scdah/files/Documents/Research%20and%20Genealogy/Resources/Military%20Records/rvwr.pdf": R("South Carolina service records"),
  "https://scdah.sc.gov/news/2020-03/sc-birth-certificates-archives": R("South Carolina birth records"),
  "https://guides.statelibrary.sc.gov/genealogy/vitalrecords": R("South Carolina death and marriage records"),
  "https://www.mass.gov/info-details/researching-massachusetts-soldiers-and-sailors": R("Massachusetts service records"),
  "https://www.archives.gov/research/vital-records": R("where vital records are kept"),
  "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c24/llsl-c24.pdf": R("the 1836 widow law's own wording"),
  "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c25/llsl-c25.pdf": R("the 1838 widow law's own wording"),
  "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c30/llsl-c30.pdf": R("the 1848 widow law's own wording"),
  "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c33/llsl-c33.pdf": R("the 1855 laws' own wording"),
  "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c45/llsl-c45.pdf": R("the 1878 widow law's own wording"),
  "https://tile.loc.gov/storage-services/service/ll/llsl/llsl-c32/llsl-c32.pdf": R("the 1853 widow law's own wording"),
  "https://www.archives.gov/veterans/military-service-records/pre-ww-1-records": R("ordering pension file copies"),
  "https://www.georgiaarchives.org/research/bounty_land_grants/": R("Georgia bounty land and service"),
  "https://www.nhsl.dncr.nh.gov/collections/genealogical-resources/researching-your-nh-family-history": R("New Hampshire records"),
  "https://www.sos.ri.gov/divisions/state-archives/VitalRecords": R("Rhode Island vital records"),
  "https://archives.delaware.gov/digital-archives/military-records-revolutionary-war-oaths-of-allegiance/": R("Delaware oaths of allegiance"),
  "https://archives.delaware.gov/digital-archives/guide-to-vital-statistics-records/": R("Delaware vital records"),
  "https://sosri.access.preservica.com/uncategorized/SO_6db31295-6c55-44bb-a5af-83989afb8c81/": R("Rhode Island service records"),
  "https://blog.dar.org/using-ancestor-tab-grs": R("DAR's Ancestor Search"),
  "https://www.sar.org/patriot-research-system/": R("SAR's Patriot Research System"),
  "https://www.archives.gov/citizen-archivist/missions/revolutionary-war-pension-files": R("searching the pension files"),
  "https://www.archives.gov/research/military/army/pensions": R("ordering pension file copies"),
  "https://nysl.nysed.gov/genealogy/precivil": R("New York service records"),
  "https://nysl.nysed.gov/genealogy/vitrec": R("New York vital records"),
  "https://guides.loc.gov/connecticut-local-history-genealogy/vital-records": R("Connecticut birth, marriage and death records"),
  "https://georgiaarchives.org/research/vital_records": R("Georgia birth, marriage and death records"),
  "https://www.mass.gov/guides/guide-to-genealogical-resources-in-the-state-library": R("Massachusetts birth, marriage and death records"),
};
export const words = (s) => s.split(/\s+/).filter(Boolean).length;
export function topicFor(url, claimId) {
  const t = SOURCE_TOPICS[url]; if (!t) throw new Error(`source-labels: no topic entry for ${url} (add one to scripts/lib/source-labels.mjs)`);
  for (const [re, topic] of t.rules) if (re.test(claimId)) return topic;
  return t.def;
}
// Topics that already contain "and" are separated with semicolons so the line never reads "x and y and z".
const andList = (a) => a.length <= 1 ? a.join("") : a.some((x) => / and /.test(x)) ? a.join("; ") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`;
// claimIds: the claims this page cites from this source, in order of first use. Returns the text after "Used for: ".
export function sourceLabel(url, claimIds) {
  const topics = [...new Set(claimIds.map((id) => topicFor(url, id)))];
  const joined = andList(topics);
  return words(joined) <= MAX_WORDS ? joined : SOURCE_TOPICS[url].def;
}
