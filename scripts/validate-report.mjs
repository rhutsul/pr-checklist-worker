#!/usr/bin/env node
// Перевірка звіту працівника кодом — останній крок перед відповіддю людині.
// Звіряє out/<pr>.json зі схемою, з першоджерелами (файл і рядок кожної знахідки існують у data/<pr>/)
// і з повторним прогоном scripts/check-pr.mjs (жодна блокувальна знахідка скрипта не загубилась,
// вердикт узгоджений зі знахідками). Код виходу: 0 — звіт коректний, 1 — ні, 2 — звіту чи входу немає.
//
//   node scripts/validate-report.mjs data/pr-101
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { InputError, ROOT, VERDICT_FIX, VERDICT_OK, lineExists, runChecks } from "./lib/checks.mjs";

const [dirArg] = process.argv.slice(2);
let expected;
try {
  expected = runChecks(dirArg);
} catch (e) {
  if (e instanceof InputError) {
    console.error(`ПОМИЛКА ВХОДУ: ${e.message}`);
    process.exit(2);
  }
  throw e;
}

const jsonPath = path.join(ROOT, "out", `${expected.pr}.json`);
const mdPath = path.join(ROOT, "out", `${expected.pr}.md`);
if (!existsSync(jsonPath)) {
  console.error(`ПОМИЛКА ВХОДУ: немає звіту out/${expected.pr}.json`);
  process.exit(2);
}
let report;
try {
  report = JSON.parse(readFileSync(jsonPath, "utf8"));
} catch (e) {
  console.error(`ПОМИЛКА ВХОДУ: out/${expected.pr}.json — не JSON (${e.message})`);
  process.exit(2);
}

const problems = [];
const need = (cond, msg) => cond || problems.push(msg);

need(report.pr === expected.pr, `pr: «${report.pr}», очікується «${expected.pr}»`);
need([VERDICT_OK, VERDICT_FIX].includes(report.verdict), `verdict: «${report.verdict}» — лише «${VERDICT_OK}» або «${VERDICT_FIX}»`);
need(Array.isArray(report.findings), "findings: має бути масив");
need(Array.isArray(report.rejected), "rejected: має бути масив (знахідки, які перевіряльник відкинув)");
need(report.verifier && typeof report.verifier.verdict === "string", "verifier.verdict: немає вердикту перевіряльника");
need(existsSync(mdPath), `немає звіту для людини out/${expected.pr}.md`);

const findings = Array.isArray(report.findings) ? report.findings : [];
for (const [i, f] of findings.entries()) {
  const where = `findings[${i}] (${f.id ?? "?"})`;
  for (const k of ["id", "rule", "severity", "file", "line", "message", "verified"]) {
    need(f[k] !== undefined && f[k] !== "", `${where}: немає поля ${k}`);
  }
  need(["блокує", "попередження"].includes(f.severity), `${where}: severity «${f.severity}»`);
  need(f.verified === "підтверджено", `${where}: у звіті лише знахідки, які перевіряльник підтвердив (verified: «підтверджено»)`);
  need(lineExists(f.file, f.line), `${where}: ${f.file}:${f.line} не існує в data/ — знахідка без доказу`);
}

// Жодна блокувальна знахідка скрипта не загубилась (зіставлення за правилом, файлом і рядком).
const key = (f) => `${f.rule}|${f.file}|${f.line}`;
const reported = new Set(findings.map(key));
const rejected = new Set((Array.isArray(report.rejected) ? report.rejected : []).map(key));
for (const f of expected.findings.filter((x) => x.severity === "блокує")) {
  need(
    reported.has(key(f)) || rejected.has(key(f)),
    `знахідку скрипта ${f.rule} ${f.file}:${f.line} не включено в звіт і не відкинуто з причиною`,
  );
}
for (const r of Array.isArray(report.rejected) ? report.rejected : []) {
  need(typeof r.reason === "string" && r.reason.length > 0, `rejected ${r.rule ?? "?"} ${r.file ?? "?"}:${r.line ?? "?"}: немає причини`);
}

// Вердикт узгоджений зі знахідками у звіті.
const blocking = findings.filter((f) => f.severity === "блокує").length;
need(
  report.verdict === (blocking ? VERDICT_FIX : VERDICT_OK),
  `verdict «${report.verdict}» не узгоджений зі знахідками (блокувальних: ${blocking})`,
);

if (problems.length) {
  console.log(`ЗВІТ out/${expected.pr}.json: НЕКОРЕКТНИЙ (${problems.length})`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`ЗВІТ out/${expected.pr}.json: OK — схема, докази (файл:рядок) і узгодженість з check-pr.mjs`);
process.exit(0);
