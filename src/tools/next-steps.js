// Shared "What to do next" building blocks for both tools. Pure data + functions; no network, no storage.
// Every link is a Source Manifest source_url (tested) or a page on this site; every sentence lists its claims.
export const CHAPTER_LINKS = Object.freeze({
  darLocator: { label: "DAR Chapter Locator (find a DAR chapter near you)", url: "https://www.dar.org/discover/become-member/chapter-locator" },
  darJoin: { label: "DAR: How to Join", url: "https://www.dar.org/discover/become-member/how-join" },
  sarApply: { label: "SAR: Apply in 4 Easy Steps", url: "https://www.sar.org/how-to-apply/" },
  sarContact: { label: "SAR: Find Your Local Society Contact (pick your state)", url: "https://www.sar.org/find-your-contact/" },
  pensionFiles: { label: "National Archives: Revolutionary War pension and bounty-land files (free on FamilySearch with login)", url: "https://www.archives.gov/research/military/american-revolution" },
  serviceRecords: { label: "National Archives: Revolutionary War service records (PDF)", url: "https://www.archives.gov/files/research/military/american-revolution/service-records.pdf" },
  darFaq: { label: "DAR: which records prove service and lineage", url: "https://membership.dar.org/NSDAR/AppFormz/FAQs.aspx" },
});
export const SITE_LINKS = Object.freeze({
  matrix: { label: "Lineage Evidence Matrix (free worksheet on this site)", url: "/tools/lineage-matrix/" },
  checker: { label: "Service Window Checker (free tool on this site)", url: "/tools/service-window-checker/" },
  roadmap: { label: "Guide: The Patriot Lineage Proof Roadmap", url: "/guides/lineage-proof-roadmap/" },
  pension: { label: "Guide: How to Read a Revolutionary War Pension File", url: "/guides/read-pension-file/" },
  service: { label: "Guide: Patriotic Service Without a Musket", url: "/guides/patriotic-service/" },
  byState: { label: "Guide: Revolutionary War Records by State", url: "/guides/records-by-state/" },
  sides: { label: "Guide: Patriot or Loyalist?", url: "/guides/patriot-or-loyalist/" },
  problems: { label: "Guide: Application Returned?", url: "/guides/application-problems/" },
});
const L = (...k) => k.map((x) => CHAPTER_LINKS[x] || SITE_LINKS[x]);
// A plan step: { title, text, items?: [{text, links}], links, claims }
export const CONTACT_STEP = Object.freeze({
  title: "Contact a local chapter's registrar",
  text: "The registrar is the chapter member who helps people with their applications. For DAR, the Chapter Locator finds chapters in your area, and the Membership Interest Form connects you to one. For SAR, your sponsor is often the local chapter registrar; pick your state on SAR's contact page.",
  claims: ["dar-chapter-locator", "dar-interest-form", "sar-sponsor-registrar", "sar-state-residence", "sar-find-contact"],
  links: L("darLocator", "darJoin", "sarApply", "sarContact"),
});
export const APPLY_STEP = Object.freeze({
  title: "Start the application with that person's help",
  text: "A DAR member, or your SAR sponsor, helps guide you through the application. Bring your printed plan and copies of your records. Only the society decides what is proven.",
  claims: ["dar-member-guides", "sar-sponsor-guides", "dar-review-staff", "sar-no-prelim"],
  links: L("roadmap", "problems"),
});
export const linksFor = L;
