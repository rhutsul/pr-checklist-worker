#!/usr/bin/env node
// Хук PreToolUse для Bash і PowerShell: межу «команда рівно як написано» тримає код, а не інструкція в промпті.
// Пропускає РІВНО:
//   node scripts/check-pr.mjs data/<pr>
//   node scripts/validate-report.mjs data/<pr>
// Усе інше (cd, &&, ;, |, echo $?, абсолютні шляхи, інші програми) — відмова з поясненням, яке бачить модель.
// Пропуск не означає «дозволено»: далі рішення за правилами allow/deny у .claude/settings.json і --allowedTools.
// Вхід — JSON хука в stdin; вихід — JSON з permissionDecision "deny" у stdout (код 0). Зламаний вхід — відмова (код 2).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ALLOWED = /^node scripts\/(check-pr|validate-report)\.mjs data\/pr-[A-Za-z0-9_-]+\/?$/;

const EXACT_HINT =
  "Дозволено рівно: `node scripts/check-pr.mjs data/<pr>` або `node scripts/validate-report.mjs data/<pr>` — " +
  "одна команда на виклик, відносні шляхи (робоча тека вже корінь проєкту). Код виходу не потрібен: скрипт друкує " +
  "«ВЕРДИКТ СКРИПТА» і JSON.";

/** Причини, чому команда не точна (порожній масив — команда точна). */
export function problems(command) {
  if (typeof command !== "string" || command.trim() === "") return ["порожня команда"];
  const c = command.trim();
  if (ALLOWED.test(c)) return [];
  const out = [];
  if (/(^|[\s;&|(])cd(\s|$)/i.test(c) || /\b(Set-Location|Push-Location|pushd)\b/i.test(c)) out.push("`cd` (зміна теки)");
  if (/&&|\|\|/.test(c)) out.push("`&&` / `||` (склеєні команди)");
  if (/;/.test(c)) out.push("`;` (кілька команд)");
  if (/(^|[^|])\|([^|]|$)/.test(c)) out.push("`|` (конвеєр)");
  if (/\$\?|\$LASTEXITCODE|EXIT=/i.test(c)) out.push("`echo $?` / `$LASTEXITCODE` (код виходу)");
  if (/(^|[\s"'=])([A-Za-z]:[\\/]|\/(?!\/)|\\\\|~[\\/])/.test(c)) out.push("абсолютний шлях");
  if (/[\r\n]/.test(c)) out.push("кілька рядків");
  if (/[<>`]|\$\(/.test(c)) out.push("перенаправлення чи підстановка (`>`, `<`, `$(…)`)");
  if (out.length === 0) out.push("команда не з дозволеного списку");
  return out;
}

/** Рішення хука для вхідного JSON (об'єкт). null — пропустити без думки (далі правила дозволів). */
export function decide(input) {
  const tool = input?.tool_name;
  if (tool !== "Bash" && tool !== "PowerShell") return null;
  const command = input?.tool_input?.command;
  const why = problems(command);
  if (why.length === 0) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Хук exact-command відхилив ${tool}-команду: ${why.join(", ")}. ${EXACT_HINT}`,
    },
  };
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.stderr.write("Хук exact-command: не вдалося прочитати JSON зі stdin — відмова. " + EXACT_HINT + "\n");
    process.exit(2);
  }
  const d = decide(input);
  if (d) process.stdout.write(JSON.stringify(d) + "\n");
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
