// t127u rule 7: source scope tags and the society-wide-wording check (scripts/lib/source-scope.mjs).
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { scopeFlags, asofAllowed, SCOPES, societyRuleMentions } from "./lib/source-scope.mjs";
import { WHERE_TO_LOOK, BIRTH_SUBSTITUTES, CAUTIONS, MODE_HELP, NSCDA_TERM, START_HERE } from "../src/tools/tool-b.js";
import { CENSUS_ERAS } from "../src/tools/places.js";
const root = new URL("..", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(root + "manifest/claims.json", "utf8"));
const byId = new Map(manifest.claims.map((c) => [c.claim_id, c]));
const T = []; const t = (n, ok) => T.push([n, !!ok]);
const OH = manifest.claims.filter((c) => c.source_url.includes("cincinnatisar.org")), SC = manifest.claims.filter((c) => c.source_url.includes("nscdasnc.memberclicks.net"));
t("every manifest claim carries a scope tag: national, state, chapter-local or third-party", manifest.claims.every((c) => SCOPES.includes(c.source_scope)));
t("the 2023 Ohio Society SAR presentation (hosted by a chapter) is chapter-local; NSCDA's South Carolina standards are state; the SAR checklist is national", OH.length > 0 && OH.every((c) => c.source_scope === "chapter-local") && SC.length > 0 && SC.every((c) => c.source_scope === "state") && byId.get("sar-checklist-signatures")?.source_scope === "national");
t("the NSCDA South Carolina source is renamed exactly", SC.every((c) => c.source_title === "NSCDA South Carolina Society — Standards of Proof (2025)"));
t("flags 'SAR says' backed only by the Ohio presentation", scopeFlags("SAR says a supplemental may be replaced only once.", ["ohsar-supp-once"], byId).length === 1);
// t146: the date-format point now comes from SAR's national Application Preparation Guide, so "SAR's application guide says" is not flagged.
t("t146: SAR's application guide (APG) is national, and the re-sourced lines are not flagged", byId.get("sar-apg-date-format")?.source_scope === "national" && byId.get("sar-apg-bc-gender")?.source_scope === "national" && byId.get("sar-apg-record-copy")?.source_scope === "national" && scopeFlags("As of Nov 11, 2026, SAR's application guide says all dates must be entered in the format 01 Jan 1900", ["sar-apg-date-format"], byId).length === 0);
t("flags 'As of <date>, SAR says' backed only by the Ohio presentation", scopeFlags("As of May 1, 2026, SAR says applications pended for three years are withdrawn.", ["ohsar-3yrs"], byId).length === 1);
t("flags 'NSCDA lists' / 'Listed by NSCDA' / 'under NSCDA rules' backed only by the South Carolina standards", ["NSCDA lists affidavits among substitutes.", "Listed by NSCDA among primary sources", "Supporting evidence only under NSCDA rules"].every((s) => scopeFlags(s, ["nscda-affidavits"], byId).length === 1));
t("flags 'SAR says' backed only by a DAR claim (wrong society)", scopeFlags("SAR says every relationship needs a document.", ["dar-each-relationship"], byId).length === 1);
t("flags a third-party source worded as a DAR rule", scopeFlags("DAR says this list is representative.", ["nypl-representative"], byId).length === 1);
t("does not flag honest attribution: 'A 2023 Ohio Society SAR presentation said ...' and 'NSCDA's South Carolina society's standards say ...'", scopeFlags("A 2023 Ohio Society SAR presentation said applications pended for three years are withdrawn.", ["ohsar-3yrs"], byId).length === 0 && scopeFlags("NSCDA's South Carolina society's standards say short forms are not acceptable.", ["nscda-short-form"], byId).length === 0);
t("does not flag 'DAR says' backed by DAR's national site, or SAR wording backed by SAR's national checklist", scopeFlags("DAR says years are four digits.", ["dar-4digit"], byId).length === 0 && scopeFlags("SAR says the State Registrar, State Secretary and two sponsors sign.", ["sar-checklist-signatures"], byId).length === 0);
t("'As of' is allowed only for national and state sources", asofAllowed(byId.get("dar-4digit")) && asofAllowed(byId.get("lva-militia")) && !asofAllowed(byId.get("ohsar-3yrs")) && !asofAllowed(byId.get("nypl-representative")) && !asofAllowed(undefined));
// The live content: no {{asof:}} on a chapter-local or third-party claim, and no flagged sentence anywhere (the gate itself).
const pages = execFileSync("bash", ["-lc", `cat ${root}src/content/*.md ${root}src/pages/*.md ${root}src/partials/*.md`]).toString();
t("no {{asof:}} uses a chapter-local or third-party source (and none uses the Ohio presentation)", [...pages.matchAll(/\{\{asof:([a-z0-9-]+)\}\}/g)].every((m) => asofAllowed(byId.get(m[1])) && !m[1].startsWith("ohsar-")));
const gate = execFileSync("node", [root + "scripts/check-manifest.mjs"], { encoding: "utf8" });
t("the offline gate reports 0 rule-7 flags on the site's pages and tools", /Source scope \(rule 7\): 0 flagged/.test(gate) && /PASSED/.test(gate));
// The pre-t127u text (commit 95fcfa8) is what the rule exists to catch.
const old = execFileSync("git", ["-C", root, "show", "95fcfa8:src/content/application-problems.md"], { encoding: "utf8" }) + execFileSync("git", ["-C", root, "show", "95fcfa8:src/content/substitute-evidence.md"], { encoding: "utf8" });
const oldFlags = old.split("\n").filter((l) => /\[\[claim:/.test(l)).map((l) => scopeFlags(l, [...l.matchAll(/\[\[claim:([a-z0-9-]+)\]\]/g)].map((m) => m[1]), byId)).filter((f) => f.length).length;
t(`the pre-t127u Application Returned and Substitute Evidence text gets flagged (${oldFlags} lines)`, oldFlags >= 10);
// Tool text: worksheet advice, cautions, substitutes and census notes.
const toolTexts = [...Object.values(WHERE_TO_LOOK).flatMap((v) => Object.values(v)), ...BIRTH_SUBSTITUTES.steps, BIRTH_SUBSTITUTES.combine, ...CAUTIONS.map((c) => ({ text: c.text, claims: [c.claim] })), ...CENSUS_ERAS, { text: MODE_HELP.indirect, claims: [MODE_HELP.claim] }, NSCDA_TERM, START_HERE];
t(`no worksheet text (${toolTexts.length} items) is worded as a society-wide rule on a non-national source`, toolTexts.every((x) => scopeFlags(x.text, x.claims, byId).length === 0));
t("worksheet text never says 'NSCDA says/lists/asks/advises' without naming the South Carolina society", toolTexts.every((x) => !/\bNSCDA (?:says|lists|asks|advises|treats|notes)\b/.test(x.text)));
t("societyRuleMentions ignores claim markers and finds DAR/SAR/NSCDA rule wording", societyRuleMentions("DAR: x [[claim:sar-y]]").join() === "DAR" && societyRuleMentions("SAR presenters list").join() === "SAR");
let p = 0; for (const [n, ok] of T) { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (ok) p++; }
console.log(`\nSource scope (rule 7): ${p}/${T.length} passed.`); process.exit(p === T.length ? 0 : 1);
