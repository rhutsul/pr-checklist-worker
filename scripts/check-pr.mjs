#!/usr/bin/env node
// Перевірка синтетичного PR за чеклістом процесу. Node 24, без залежностей.
// Три речі, як у шаблоні курсу:
//   1) таблиця для людини + маркер ###JSON### і машиночитний JSON для агента;
//   2) код виходу: 0 — блокувальних знахідок немає, 1 — є, 2 — вхід не читається;
//   3) знахідки — ДАНІ з файлом і рядком; вердикт для людини, рішення зливати — за людиною.
//
//   node scripts/check-pr.mjs data/pr-101
import { InputError, runChecks } from "./lib/checks.mjs";

const [dirArg] = process.argv.slice(2);
let result;
try {
  result = runChecks(dirArg);
} catch (e) {
  if (e instanceof InputError) {
    console.error(`ПОМИЛКА ВХОДУ: ${e.message}`);
    console.error("використання: node scripts/check-pr.mjs data/<pr>");
    process.exit(2);
  }
  throw e;
}

console.log(`PR: ${result.pr} · тип: ${result.type ?? "не визначено"} · AC у PR: ${result.acs.map((a) => `${a.id} (${a.status ?? "?"})`).join(", ") || "—"}`);
console.log("");
console.log("Перевірено:");
for (const c of result.checked) console.log(`  - ${c}`);
if (result.notChecked.length) {
  console.log("Не перевірено:");
  for (const c of result.notChecked) console.log(`  - ${c}`);
}
console.log("");
if (result.findings.length === 0) {
  console.log("Знахідок немає.");
} else {
  console.log("| ID | Правило | Важливість | Файл:рядок | Що не так |");
  console.log("|---|---|---|---|---|");
  for (const f of result.findings) {
    console.log(`| ${f.id} | ${f.rule} | ${f.severity} | ${f.file}:${f.line} | ${f.message} |`);
  }
}
console.log("");
console.log(`ВЕРДИКТ СКРИПТА: ${result.verdict.toUpperCase()}`);
console.log("###JSON###");
console.log(JSON.stringify(result, null, 2));
process.exit(result.verdict === "можна зливати" ? 0 : 1);
