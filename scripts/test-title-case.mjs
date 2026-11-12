// t163 #4: Title Case capitalizes every word, including former small-word exceptions, and every hyphen part.
import { titleCase, titleCaseHeadings, titleCaseInner, KEEP } from "./lib/title-case.mjs";

let passed = 0, failed = 0;
function t(name, ok, detail = "") {
  if (ok) { passed++; console.log("  ok  " + name); }
  else { failed++; console.log("  FAIL  " + name + (detail ? " — " + detail : "")); }
}

const cases = [
  ["Check a Widow's Pension", "Check A Widow's Pension"],
  ["Read the Full Plan", "Read The Full Plan"],
  ["See how the tools work", "See How The Tools Work"],
  ["Terms Used on This Page", "Terms Used On This Page"],
  ["Era-by-Era Substitute Matrix", "Era-By-Era Substitute Matrix"],
  ["What They Prove, and What They Don't", "What They Prove, And What They Don't"],
  ["How to Join, in Short", "How To Join, In Short"],
  ["Sources in the Manifest", "Sources In The Manifest"],
  ["What to Do Next", "What To Do Next"],
  ["Build your to-do list", "Build Your To-Do List"],
  ["From the 1850 Census Back to 1776: Bridging the Unnamed-Household Gap", "From The 1850 Census Back To 1776: Bridging The Unnamed-Household Gap"],
  ["The Patriot Lineage Proof Roadmap: Proving Every Generation for DAR or SAR", "The Patriot Lineage Proof Roadmap: Proving Every Generation For DAR Or SAR"],
  ["Patriot, In Lay Terms: Plain-English help with DAR and SAR applications, for the Daughters and the Sons of the American Revolution",
   "Patriot, In Lay Terms: Plain-English Help With DAR And SAR Applications, For The Daughters And The Sons Of The American Revolution"],
  ["FAQ", "FAQ"],
  ["NSCDA", "NSCDA"],
  ["AI Disclosure", "AI Disclosure"],
  ["In Short", "In Short"],
  ["M804", "M804"],
  ["DAR's", "DAR's"],
];
for (const [a, b] of cases) {
  const g = titleCase(a);
  t(`titleCase(${JSON.stringify(a)})`, g === b, `got ${JSON.stringify(g)}`);
  t(`idempotent: ${JSON.stringify(b)}`, titleCase(b) === b);
  t(`length-stable: ${JSON.stringify(a)}`, g.length === a.length);
}
t("KEEP includes the site name", KEEP.includes("Patriot, In Lay Terms") && KEEP.includes("Patriot In Lay Terms"));
t("titleCaseHeadings covers h1–h6 and summary",
  titleCaseHeadings('<h2 id="x">Era-by-era substitute matrix</h2><summary>Terms Used on This Page</summary><p>See how the tools work</p>')
    === '<h2 id="x">Era-By-Era Substitute Matrix</h2><summary>Terms Used On This Page</summary><p>See how the tools work</p>');
t("titleCaseInner leaves tags in place", titleCaseInner('Check a <em>widow\'s</em> pension') === "Check A <em>Widow's</em> Pension");

console.log(`\ntitle-case: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
