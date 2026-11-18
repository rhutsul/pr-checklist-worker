#!/usr/bin/env node
// Хук PreToolUse для Grep і Glob: шукати можна лише в data/ і references/.
// Навіщо хук, а не правило: Claude Code приймає `Grep(/data/**)` у allow, але не звіряє з ним шлях пошуку
// (https://code.claude.com/docs/en/permissions — «A `Grep(docs/**)` deny rule doesn't stop Grep from searching `docs`»).
// Тому межу тримає код: path (або, для Glob без path, сам шаблон) мусить бути всередині data/ або references/.
// Вихід — JSON з permissionDecision "deny" (код 0); зламаний вхід — відмова (код 2).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SCOPES = ["data", "references"];

const HINT =
  "Grep і Glob — лише в `data/` і `references/`: вкажи `path`, напр. `data/pr-103/tree` або `references`; " +
  "для Glob без `path` шаблон має починатися з `data/` чи `references/`.";

function inScope(p, root, cwd) {
  if (typeof p !== "string" || p.trim() === "") return false;
  const abs = path.resolve(cwd, p);
  const rel = path.relative(root, abs);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return false;
  const first = rel.split(/[\\/]/)[0].toLowerCase();
  return SCOPES.includes(first);
}

/** Рішення для вхідного JSON хука. null — пропустити (далі правила дозволів). */
export function decide(input, root = process.env.CLAUDE_PROJECT_DIR || ROOT) {
  const tool = input?.tool_name;
  if (tool !== "Grep" && tool !== "Glob") return null;
  const ti = input?.tool_input ?? {};
  const cwd = input?.cwd || root;
  let ok;
  if (ti.path) ok = inScope(ti.path, root, cwd);
  else if (tool === "Glob") ok = typeof ti.pattern === "string" && !ti.pattern.includes("..") && inScope(ti.pattern.replace(/[*?[{].*$/, "") || ".", root, cwd);
  else ok = false; // Grep без path шукає по всьому репо
  if (ti.path && tool === "Glob" && typeof ti.pattern === "string" && (ti.pattern.includes("..") || path.isAbsolute(ti.pattern))) ok = false;
  if (ok) return null;
  const what = ti.path ? `path «${ti.path}»` : tool === "Glob" ? `шаблон «${ti.pattern}» без path` : "без path (усе репо)";
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Хук search-scope відхилив ${tool}: ${what} — поза data/ і references/. ${HINT}`,
    },
  };
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.stderr.write("Хук search-scope: не вдалося прочитати JSON зі stdin — відмова. " + HINT + "\n");
    process.exit(2);
  }
  const d = decide(input);
  if (d) process.stdout.write(JSON.stringify(d) + "\n");
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
