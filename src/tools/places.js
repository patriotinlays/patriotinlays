// Era- and state-tailored "Where to look" facts for the Lineage Evidence Matrix.
// Rules: every sentence lists the Source Manifest claims behind it (check-manifest scans `claims: [...]`),
// every link is a manifest source_url (tested), and a state with no verified source gets an honest fallback.
// Nothing here says a record exists; it says what the official source says about that state and period.

export const STATES = [["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"]];
export const stateName = (code) => (STATES.find(([c]) => c === code) || [])[1] || "";

export const PLACE_SOURCES = Object.freeze({
  lvaRev: { label: "Library of Virginia: Virginia Revolutionary War service records (research guide)", url: "https://lva-virginia.libguides.com/revolutionary-war/home" },
  lvaBmd: { label: "Library of Virginia: birth, marriage and death records (1853 to present)", url: "https://lva-virginia.libguides.com/bmd" },
  msaMil: { label: "Maryland State Archives: military records guide", url: "https://guide.msa.maryland.gov/pages/viewer.aspx?page=military" },
  msaBirth: { label: "Maryland State Archives: birth records guide", url: "https://guide.msa.maryland.gov/pages/viewer.aspx?page=birth" },
  ncTrpr: { label: "State Archives of North Carolina: Troop Returns Collection (finding aid)", url: "https://appx.archives.ncdcr.gov/findingaids/TRPR_Troop_Returns_Collection.html" },
  ncVr: { label: "North Carolina Vital Records: research (which years they hold)", url: "https://vitalrecords.nc.gov/research.htm" },
  njMil: { label: "New Jersey State Archives: compiled rosters of NJ militia and Continental Line (PDF)", url: "https://nj.gov/state/archives/guides/sdea0003.pdf" },
  njGen: { label: "New Jersey State Archives: search genealogical collections", url: "https://www.nj.gov/state/archives/search-genealogical-collections.shtml" },
  paRev: { label: "Pennsylvania State Archives: Revolutionary War overview", url: "https://www.pa.gov/agencies/phmc/pa-state-archives/research-online/research-guides/revolutionary-war-overview" },
  paDoh: { label: "Pennsylvania Department of Health: vital records for genealogy", url: "https://www.pa.gov/agencies/health/programs/vital-records/genealogy" },
  paArch: { label: "Pennsylvania State Archives: archival birth and death certificates", url: "https://www.pa.gov/services/phmc/request-a-birth-or-death-certificate" },
  ctRev: { label: "Connecticut State Library: Revolutionary War military records", url: "https://libguides.ctstatelibrary.org/hg/militaryrecords/revwar" },
  scRev: { label: "South Carolina Archives: sources for the American Revolution (PDF)", url: "https://scdah.sc.gov/sites/scdah/files/Documents/Research%20and%20Genealogy/Resources/Military%20Records/rvwr.pdf" },
  scBirth: { label: "South Carolina Archives: birth certificates at the Archives", url: "https://scdah.sc.gov/news/2020-03/sc-birth-certificates-archives" },
  scSl: { label: "South Carolina State Library: vital records", url: "https://guides.statelibrary.sc.gov/genealogy/vitalrecords" },
  maMil: { label: "Mass.gov: researching Massachusetts soldiers and sailors", url: "https://www.mass.gov/info-details/researching-massachusetts-soldiers-and-sailors" },
  naraVital: { label: "National Archives: vital records (where birth, death and marriage records are kept)", url: "https://www.archives.gov/research/vital-records" },
  nypl: { label: "New York Public Library: Revolutionary War records, with state archives listed", url: "https://libguides.nypl.org/military-genealogy/revolutionary-war" },
  darPrp: { label: "DAR Genealogical Research Databases: Revolutionary War records", url: "https://services.dar.org/Public/DAR_Research/search_revwar/?Tab_ID=14&Tab_ID_Sub=0&action=list" },
});
const S = (...k) => k.map((x) => PLACE_SOURCES[x]);

// Revolutionary War service records held or described by a state's own archives (used by the patriot step).
export const STATE_SERVICE = Object.freeze({
  VA: { text: "Most Virginians who served did so in the county militia, and the Library of Virginia says few records of militia service exist. Militia officer appointments are often in the county court order books, and many federal pensions after 1832 mention militia service. Payrolls and muster rolls exist for most Continental Line soldiers.",
    claims: ["lva-rev-militia", "lva-rev-few", "lva-rev-orderbooks", "lva-rev-pensions", "lva-rev-continental"], links: S("lvaRev") },
  MD: { text: "Maryland militia was organized by county. The Maryland State Archives' Revolutionary War Papers Index (MSA S1422) is a place to start, and the Archives notes that many Maryland service records are at the National Archives.",
    claims: ["msa-militia", "msa-index", "msa-nara"], links: S("msaMil") },
  NC: { text: "The State Archives of North Carolina holds 221 rosters, troop returns and muster rolls for militia, volunteers and draftees. Militia records usually name the officers and soldiers and are organized by district or county, and the lists are arranged by year, then by county, commanding officer or unit number, so search by his county, commander and unit as well as his name.",
    claims: ["nc-trpr-rosters", "nc-trpr-county", "nc-trpr-arranged"], links: S("ncTrpr") },
  NJ: { text: "The New Jersey State Archives holds compiled rosters of New Jersey militia and Continental Line, including a county-by-county list of militiamen who were issued indents.",
    claims: ["nj-mil-rosters", "nj-mil-indents"], links: S("njMil") },
  PA: { text: "Many Pennsylvania militiamen came home unpaid with only a slip signed by a commanding officer. The Pennsylvania State Archives' Revolutionary War overview describes the records.",
    claims: ["pa-rev-slip"], links: S("paRev") },
  CT: { text: "The Connecticut State Library points to Connecticut Archives indexes under Militia and Revolutionary War, and has an index to pensions held in the State Archives.",
    claims: ["ct-archives-indexes", "ct-pension-index"], links: S("ctRev") },
  SC: { text: "The South Carolina Department of Archives and History holds the Accounts Audited of Claims Growing Out of the Revolution and a card index to Revolutionary service.",
    claims: ["sc-rev-audited", "sc-rev-cardindex"], links: S("scRev") },
  MA: { text: "The Massachusetts Archives holds the Adjutant General's historical military records, one of the most complete state records of Massachusetts service from 1775 on.",
    claims: ["ma-adjutant", "ma-complete"], links: S("maMil") },
});
export const NO_STATE_SERVICE = (name) => ({ text: `This site has no verified guide yet for ${name}'s Revolutionary War records. The New York Public Library suggests searching for the State Archives or State Historical Society.`,
  claims: ["nypl-search"], links: S("nypl") });

// When each state's own offices say birth, death and marriage records begin. Periods are [from, to] years (inclusive);
// era "state" = the source says the state recorded it then; "none" = the source says it was not recorded statewide
// (look for church, probate and other older records); null = information only.
// noRecord: the source says the state kept no (or almost no) birth records then, so the gap links the substitute-evidence guide.
const P = (from, to, era, text, { claims, noRecord = false }) => ({ from, to, era, text, claims, noRecord });
export const STATE_VITAL = Object.freeze({
  VA: { links: S("lvaBmd"),
    birth: [P(null, 1852, "none", "Virginia had no statewide recording of births before 1853, so there is no state birth record to find for this person. Birth records from before then are rare.", { claims: ["lva-bmd-pre1853", "lva-bmd-rare"], noRecord: true }),
      P(1853, 1896, "state", "Virginia counties and cities kept birth registers from 1853 to 1896.", { claims: ["lva-bmd-1853"] }),
      P(1897, 1911, "none", "Most Virginia counties and cities did not record births from 1897 to 1911.", { claims: ["lva-bmd-gap"], noRecord: true }),
      P(1912, null, "state", "Virginia resumed recording births in 1912.", { claims: ["lva-bmd-1912"] })],
    death: [P(null, 1852, "none", "Virginia did not record deaths statewide before 1853, and death records from before then are rare.", { claims: ["lva-bmd-pre1853", "lva-bmd-rare"] }),
      P(1853, 1896, "state", "Virginia counties and cities kept death registers from 1853 to 1896.", { claims: ["lva-bmd-1853"] }),
      P(1897, 1911, "none", "Most Virginia counties and cities did not record deaths from 1897 to 1911.", { claims: ["lva-bmd-gap"] }),
      P(1912, null, "state", "Virginia resumed recording deaths in 1912.", { claims: ["lva-bmd-1912"] })],
    marriage: [P(null, 1852, null, "Virginia did not record marriages statewide before 1853, but many earlier marriage records survive.", { claims: ["lva-bmd-pre1853", "lva-bmd-rare"] }),
      P(1853, null, "state", "Virginia counties and cities kept marriage registers from 1853.", { claims: ["lva-bmd-1853"] })] },
  NC: { links: S("ncVr"),
    birth: [P(null, 1912, "none", "For North Carolina births before 1913, the state vital records office says to contact the Register of Deeds in the county where the birth happened.", { claims: ["nc-vr-birth"] }),
      P(1913, null, "state", "North Carolina Vital Records has birth certificates from 1913.", { claims: ["nc-vr-have-birth"] })],
    death: [P(null, 1929, null, "For North Carolina death certificates before 1930, the state vital records office says to contact the State Archives.", { claims: ["nc-vr-death"] }),
      P(1930, null, "state", "North Carolina Vital Records has death certificates from 1930.", { claims: ["nc-vr-have-death"] })],
    marriage: [P(null, 1961, null, "For North Carolina marriages before 1962, contact the Register of Deeds in the county where the license was issued.", { claims: ["nc-vr-marriage"] }),
      P(1962, null, "state", "North Carolina Vital Records has marriage certificates from 1962.", { claims: ["nc-vr-have-marriage"] })] },
  PA: { links: S("paDoh", "paArch"),
    birth: [P(null, 1905, "none", "For Pennsylvania births before 1906, the state Department of Health says to contact the county courthouse.", { claims: ["pa-doh-pre1906"] }),
      P(1906, null, "state", "The Pennsylvania State Archives holds state birth certificates for 1906 to 1920, and all certified copies of birth records come from the Department of Health's Division of Vital Records.", { claims: ["pa-arch-1906", "pa-doh-certified"] })],
    death: [P(null, 1905, "none", "For Pennsylvania deaths before 1906, the state Department of Health says to contact the county courthouse.", { claims: ["pa-doh-pre1906"] }),
      P(1906, null, "state", "The Pennsylvania State Archives holds state death certificates for 1906 to 1975, and all certified copies of death records come from the Department of Health's Division of Vital Records.", { claims: ["pa-arch-1906", "pa-doh-certified"] })] },
  NJ: { links: S("njGen"),
    birth: [P(null, 1847, "none", "New Jersey births before 1848 were not filed by any level of government, except records of births of enslaved children.", { claims: ["nj-pre1848-birth"], noRecord: true }),
      P(1848, null, "state", "The New Jersey State Archives holds state birth records from May 1, 1848.", { claims: ["nj-vital-1848"] })],
    death: [P(null, 1847, "none", "New Jersey deaths before 1848 were not filed by any government.", { claims: ["nj-pre1848-death"] }),
      P(1848, null, "state", "The New Jersey State Archives holds state death records from May 1, 1848.", { claims: ["nj-vital-1848"] })],
    marriage: [P(null, 1847, null, "New Jersey marriages before 1848 had to be filed with the County Clerk starting in 1795.", { claims: ["nj-pre1848-marriage"] }),
      P(1848, null, "state", "The New Jersey State Archives holds state marriage records from May 1, 1848.", { claims: ["nj-vital-1848"] })] },
  SC: { links: S("scBirth", "scSl"),
    birth: [P(null, 1914, "none", "South Carolina did not require registration of all births until a 1914 law; the state's birth records begin in 1915.", { claims: ["sc-birth-law", "sc-birth-1915"], noRecord: true }),
      P(1915, null, "state", "South Carolina's state birth records begin in 1915.", { claims: ["sc-birth-1915"] })],
    death: [P(null, 1914, "none", "South Carolina required death certificates from January 1, 1915.", { claims: ["sc-death-1915"] }),
      P(1915, null, "state", "South Carolina required death certificates from January 1, 1915.", { claims: ["sc-death-1915"] })],
    marriage: [P(null, 1910, null, "South Carolina required marriage licenses from July 1, 1911.", { claims: ["sc-marriage-1911"] }),
      P(1911, null, "state", "South Carolina required marriage licenses from July 1, 1911.", { claims: ["sc-marriage-1911"] })] },
  MD: { links: S("msaBirth"),
    birth: [P(null, null, null, "The Maryland State Archives lists birth records for the counties from 1898 and for Baltimore City from 1875.", { claims: ["msa-birth-counties", "msa-birth-baltimore"] })] },
});
// facts: one fact ("birth") or several (["birth", "death"]) when the report merges a state's notes into one block.
export const noVitalText = (name, facts) => { const f = [].concat(facts); const list = f.length > 1 ? `${f.slice(0, -1).join(", ")} or ${f.at(-1)}` : f[0];
  return `This site has no verified source yet on when ${name} began keeping ${list} records, so it can't say whether one exists for this person. A census entry that gives the state and approximate year of birth tells you which local office to ask, and the National Archives points to the CDC's National Center for Health Statistics for how to get records from each state's office.`; };
const NO_VITAL = (name, fact) => ({ era: null, noSource: true, place: name, fact, text: `This site has no verified source yet on when ${name} began keeping ${fact} records, so it can't say whether one exists for this person. A census entry that gives the state and approximate year of birth tells you which local office to ask, and the National Archives points to the CDC's National Center for Health Statistics for how to get records from each state's office.`,
  claims: ["nara-vital-census", "nara-vital-states"], links: S("naraVital") });

const inP = (p, y) => (p.from == null || y >= p.from) && (p.to == null || y <= p.to);
// The vital-records note for one fact. year = the event year if known; lower = earliest possible year (e.g. birth year
// for a death or marriage). With no single matching period, every period is listed so the visitor sees the whole picture.
export function vitalNote(state, fact, { year = null, lower = null } = {}) {
  if (!state || !["birth", "death", "marriage"].includes(fact)) return null;
  const v = STATE_VITAL[state];
  if (!v || !v[fact]) return NO_VITAL(stateName(state), fact);
  const ps = v[fact];
  let hit = year != null ? ps.filter((p) => inP(p, year)) : lower != null ? ps.filter((p) => p.to == null || p.to >= lower) : ps;
  if (!hit.length) hit = ps;
  return { era: hit.length === 1 ? hit[0].era : null, text: hit.map((p) => p.text).join(" "), claims: [...new Set(hit.flatMap((p) => p.claims))], links: v.links,
    noRecord: hit.length === 1 && hit[0].noRecord };
}

// Which censuses fall in this person's lifetime (by the years typed), and what the sources say about each.
export const CENSUS_ERAS = Object.freeze([
  { from: 1790, to: 1840, text: "The 1790–1840 censuses named only the head of household and counted everyone else by age group.", claims: ["nara-census-head"] },
  { from: 1850, to: 1870, text: "The 1850–1870 censuses do not state relationships.", claims: ["nscda-census-1850-1870"] },
  { from: 1880, to: 1900, text: "NSCDA lists the 1880–1900 censuses as primary sources.", claims: ["nscda-census-1880"] },
]);
export const PENSIONER_1840 = Object.freeze({ text: "The 1840 census named Revolutionary War pensioners with their exact ages; pensioners included veterans and widows.", claims: ["nara-census-1840", "nara-census-widows"] });
export function censusNote(born, died, { patriot = false } = {}) {
  if (born == null) return null;
  const hi = died ?? Infinity;
  const eras = CENSUS_ERAS.filter((e) => e.to >= born && e.from <= hi);
  const parts = eras.map((e) => ({ text: e.text, claims: e.claims }));
  if (patriot && born <= 1840 && hi >= 1840) parts.push(PENSIONER_1840);
  if (!parts.length) return null;
  return { text: `Censuses in their lifetime (by the years you typed): ${parts.map((p) => p.text).join(" ")}`, claims: [...new Set(parts.flatMap((p) => p.claims))], links: [], parts: parts.map((p) => p.text) };
}
