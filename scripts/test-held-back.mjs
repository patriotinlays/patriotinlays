// t129u/t130: held-back claim uses are restored automatically only when every source they depend on passes live.
import { loadHeldBack, saveHeldBack, restoreHeld } from "./lib/held-back.mjs";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let ok = 0, fail = 0;
const t = (name, cond) => { const p = !!cond; p ? ok++ : fail++; console.log(`${p ? "PASS" : "FAIL"}  ${name}`); };
const A = "https://dar.example/step", B = "https://dar.example/faq";
const setup = () => { const root = mkdtempSync(join(tmpdir(), "held-")); mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/p.md"), "Intro. SC wording [[claim:sc]]. Outro.\n");
  writeFileSync(join(root, "src/q.md"), "Q held [[claim:sc2]].\n");
  const reg = { schema_version: 1, entries: [
    { id: "one", file: "src/p.md", held: "SC wording [[claim:sc]]", restore: "DAR wording [[claim:dar-a]]", claims: ["dar-a"], sources: [A], status: "held" },
    { id: "two", file: "src/q.md", held: "Q held [[claim:sc2]]", restore: "Q restored [[claim:dar-b]] [[claim:dar-a]]", claims: ["dar-a", "dar-b"], sources: [A, B], status: "held" } ] };
  const path = join(root, "held-back.json"); saveHeldBack(path, reg); return { root, path }; };

{ const { root, path } = setup(); const reg = loadHeldBack(path);
  const r = restoreHeld(reg, new Set(), root);
  t("nothing is restored while the DAR pages are unreachable (fallback/fail)", r.restored.length === 0 && r.waiting.length === 2 && readFileSync(join(root, "src/p.md"), "utf8").includes("SC wording"));
  t("waiting entries name the sources they wait on", r.waiting.find((w) => w.id === "two").waitingOn.join() === [A, B].join()); }
{ const { root, path } = setup(); const reg = loadHeldBack(path);
  const r = restoreHeld(reg, new Set([A]), root, new Date("2026-12-01T00:00:00Z"));
  t("an entry is restored automatically when every source it depends on passed live", r.restored.map((x) => x.id).join() === "one" && readFileSync(join(root, "src/p.md"), "utf8") === "Intro. DAR wording [[claim:dar-a]]. Outro.\n");
  t("an entry that still depends on an unreachable source stays held", r.waiting.map((x) => x.id).join() === "two" && readFileSync(join(root, "src/q.md"), "utf8").includes("Q held"));
  t("a restored entry is marked restored with its time", reg.entries[0].status === "restored" && reg.entries[0].restoredAt === "2026-12-01T00:00:00.000Z");
  const r2 = restoreHeld(reg, new Set([A, B]), root);
  t("all held entries restore once all their pages pass; already-restored ones are not touched twice", r2.restored.map((x) => x.id).join() === "two" && readFileSync(join(root, "src/p.md"), "utf8") === "Intro. DAR wording [[claim:dar-a]]. Outro.\n"); }
{ const { root, path } = setup(); writeFileSync(join(root, "src/p.md"), "edited by hand\n"); const reg = loadHeldBack(path);
  const r = restoreHeld(reg, new Set([A, B]), root);
  t("if the held text was edited by hand, it is reported and not restored blindly", r.problems.length === 1 && r.problems[0].id === "one" && readFileSync(join(root, "src/p.md"), "utf8") === "edited by hand\n"); }
// The real registry: every held entry's held text is on the site now, exactly once.
{ const root = new URL("..", import.meta.url).pathname; const reg = loadHeldBack(join(root, "manifest/held-back.json"));
  const held = reg.entries.filter((e) => e.status === "held");
  t(`real registry: ${held.length} held entries, each held text present exactly once in its file`, held.length > 0 && held.every((e) => readFileSync(join(root, e.file), "utf8").split(e.held).length === 2));
  t("real registry includes the t129 holds (dar-each-relationship on the FAQ, dar-review-staff on the worksheet limits)", ["dar-each-relationship", "dar-review-staff"].every((c) => reg.entries.some((e) => e.claims.includes(c))));
  t("real registry: every entry depends only on the DAR pages", reg.entries.every((e) => e.sources.every((u) => /membership\.dar\.org\/NSDAR\/AppFormz\//.test(u)))); }
console.log(`Held-back restore: ${ok}/${ok + fail} passed.`);
process.exit(fail ? 1 : 0);
