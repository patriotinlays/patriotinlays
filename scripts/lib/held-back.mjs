// t129u/t130: automatic restore of held-back claim uses (manifest/held-back.json).
// An entry is restored (its "held" text replaced by its "restore" text) only when EVERY source it depends on passed the
// live check in this run with all quotes found. Nothing is restored on a fallback, a failure or an offline run.
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";

export function loadHeldBack(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { schema_version: 1, entries: [] };
}
export function saveHeldBack(path, reg) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(reg, null, 2) + "\n"); renameSync(tmp, path);
}
// passedUrls: Set of source URLs that returned 200 with every quote matched in this run.
export function restoreHeld(reg, passedUrls, root, at = new Date()) {
  const restored = [], waiting = [], problems = [];
  for (const e of reg.entries) {
    if (e.status !== "held") continue;
    const missing = e.sources.filter((u) => !passedUrls.has(u));
    if (missing.length) { waiting.push({ id: e.id, waitingOn: missing }); continue; }
    const f = join(root, e.file); const s = readFileSync(f, "utf8");
    const n = s.split(e.held).length - 1;
    if (n !== 1) { problems.push({ id: e.id, reason: `held text found ${n} times in ${e.file}; not restored automatically` }); continue; }
    writeFileSync(f, s.replace(e.held, e.restore));
    e.status = "restored"; e.restoredAt = at.toISOString();
    restored.push({ id: e.id, file: e.file, claims: e.claims });
  }
  return { restored, waiting, problems };
}
