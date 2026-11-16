#!/usr/bin/env node
// Звірка звітів працівника (out/<pr>.json) з відомими вердиктами golden/expected.json.
// Запускає ЛЮДИНА після прогону працівника; працівнику цей скрипт і golden/ не дозволено.
//   node scripts/golden.mjs            усі набори з golden/expected.json
// Код виходу: 0 — усі збіглися, 1 — є розбіжності чи немає звіту.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/checks.mjs";

const expected = JSON.parse(readFileSync(path.join(ROOT, "golden", "expected.json"), "utf8"));
const key = (f) => `${f.rule}|${f.file}|${f.line}`;
let bad = 0;
console.log("| Набір | Що закладено | Очікуваний вердикт | Вердикт працівника | Знахідки (очік. / звіт) | Збіг |");
console.log("|---|---|---|---|---|---|");
for (const [pr, exp] of Object.entries(expected)) {
  if (pr.startsWith("_")) continue;
  const file = path.join(ROOT, "out", `${pr}.json`);
  if (!existsSync(file)) {
    console.log(`| ${pr} | ${exp.what} | ${exp.verdict} | немає out/${pr}.json | — | ✗ |`);
    bad++;
    continue;
  }
  const rep = JSON.parse(readFileSync(file, "utf8"));
  const got = new Set((rep.findings ?? []).filter((f) => f.severity === "блокує").map(key));
  const want = new Set(exp.findings.map(key));
  const same = rep.verdict === exp.verdict && got.size === want.size && [...want].every((k) => got.has(k));
  if (!same) bad++;
  const list = (s) => [...s].map((k) => k.split("|")[0]).join(", ") || "—";
  console.log(`| ${pr} | ${exp.what} | ${exp.verdict} | ${rep.verdict} | ${list(want)} / ${list(got)} | ${same ? "✓" : "✗"} |`);
}
process.exit(bad ? 1 : 0);
