// Quote matching: whitespace runs collapse to one space, and whitespace directly before . , ; : ! ? is removed,
// on both the quote and the page text. Nothing else about matching changes.
import { norm, normJoin, stripHtml } from "./lib/normalize.mjs";
let ok = 0, fail = 0;
const t = (name, cond) => { const p = !!cond; p ? ok++ : fail++; console.log(`${p ? "PASS" : "FAIL"}  ${name}`); };
const has = (html, q) => norm(stripHtml(html)).includes(norm(q));
t("space before period (inline tag): NARA 'Search Within the series .' matches the quote",
  has('<p>To find a name, you can do a <a href="#">Search Within</a> the series <span></span>.</p>', "To find a name, you can do a Search Within the series."));
t("space before period after a link: NATF Form 85 '... placing an order online .' matches",
  has('Researchers can order copies of pension and bounty land applications by using <a>NATF Form 85</a> or <a>placing an order online</a> .', "Researchers can order copies of pension and bounty land applications by using NATF Form 85 or placing an order online."));
t("each of , ; : ! ? also loses the whitespace before it", [",", ";", ":", "!", "?"].every((p) => norm(`a \n\t ${p} b`) === `a${p} b`));
t("the same rule applies to the quote side", norm("the series .") === norm("the series."));
t("whitespace runs collapse to one space", norm("a \n\n\t  b") === "a b");
t("whitespace AFTER punctuation is kept (one space)", norm("end.   Next") === "end. next");
t("other characters keep their spacing (no change to ) or quotes)", norm("( a )") === "( a )" && norm('say " hi "') === 'say " hi "');
t("a genuinely different quote still fails", !has("<p>To find a person, search the catalog.</p>", "To find a name, you can do a Search Within the series."));
t("normJoin still rejoins hyphenated line breaks and gets the punctuation rule", normJoin("an-\nnuity .") === "annuity.");
console.log(`Quote normalization: ${ok}/${ok + fail} passed.`);
process.exit(fail ? 1 : 0);
