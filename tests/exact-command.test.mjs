// Тести хука PreToolUse scripts/hooks/exact-command.mjs — без моделі: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ROOT } from "../scripts/lib/checks.mjs";
import { decide, problems } from "../scripts/hooks/exact-command.mjs";

const HOOK = path.join(ROOT, "scripts", "hooks", "exact-command.mjs");
const run = (stdin) => spawnSync(process.execPath, [HOOK], { input: stdin, encoding: "utf8" });
const call = (tool, command) => ({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command } });

const EXACT = [
  "node scripts/check-pr.mjs data/pr-101",
  "node scripts/validate-report.mjs data/pr-104",
  "node scripts/check-pr.mjs data/pr-103/",
  "  node scripts/check-pr.mjs data/pr-102  ",
];

// Перші три — дослівно з журналів невдалих запусків 16.11 (docs/worker/runs/failed, attempt-2).
const GLUED = [
  ['cd "C:/Users/Dell/Documents/Agentic Engineering/ws-10/pr-checklist-worker" && node scripts/check-pr.mjs data/pr-103; echo "EXIT=$?"', ["cd", "&&", ";", "echo $?", "абсолютний"]],
  ['node scripts/check-pr.mjs data/pr-103; "EXIT=$LASTEXITCODE"', [";", "$LASTEXITCODE"]],
  ['node "C:/Users/Dell/Documents/Agentic Engineering/ws-10/pr-checklist-worker/scripts/check-pr.mjs" "C:/Users/Dell/Documents/Agentic Engineering/ws-10/pr-checklist-worker/data/pr-103"; echo "EXIT=$?"', [";", "абсолютний"]],
  ["node scripts/check-pr.mjs data/pr-103 | head -50", ["`|`"]],
  ["node scripts/check-pr.mjs /etc/passwd", ["абсолютний"]],
  ["node scripts/check-pr.mjs ../golden", ["не з дозволеного"]],
  ["node scripts/check-pr.mjs data/pr-101 > out/x.txt", ["перенаправлення"]],
  ["node scripts/golden.mjs", ["не з дозволеного"]],
  ["git push", ["не з дозволеного"]],
  ["node scripts/check-pr.mjs data/pr-101\nnode scripts/golden.mjs", ["кілька рядків"]],
];

for (const cmd of EXACT) {
  test(`пропускає точну команду: ${cmd.trim()}`, () => {
    assert.deepEqual(problems(cmd), []);
    assert.equal(decide(call("Bash", cmd)), null);
    assert.equal(decide(call("PowerShell", cmd)), null);
  });
}

for (const [cmd, reasons] of GLUED) {
  test(`відхиляє: ${cmd.slice(0, 70)}`, () => {
    for (const tool of ["Bash", "PowerShell"]) {
      const d = decide(call(tool, cmd));
      assert.equal(d.hookSpecificOutput.hookEventName, "PreToolUse");
      assert.equal(d.hookSpecificOutput.permissionDecision, "deny");
      const why = d.hookSpecificOutput.permissionDecisionReason;
      for (const r of reasons) assert.ok(why.includes(r), `у поясненні нема «${r}»: ${why}`);
      assert.ok(why.includes("node scripts/check-pr.mjs data/<pr>"), "пояснення каже, як правильно");
    }
  });
}

test("інші інструменти (Read, Grep) хук не чіпає", () => {
  assert.equal(decide({ tool_name: "Read", tool_input: { file_path: "data/pr-101/pr.md" } }), null);
  assert.equal(decide({ tool_name: "Grep", tool_input: { pattern: "AC-DEMO", path: "data" } }), null);
});

test("процес хука: точна команда → код 0 і порожній stdout", () => {
  const r = run(JSON.stringify(call("Bash", "node scripts/check-pr.mjs data/pr-101")));
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "");
});

test("процес хука: склеєна команда → код 0 і JSON з permissionDecision deny", () => {
  const r = run(JSON.stringify(call("PowerShell", 'node scripts/check-pr.mjs data/pr-103; "EXIT=$LASTEXITCODE"')));
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
});

test("процес хука: зламаний вхід → код 2 (відмова), пояснення в stderr", () => {
  const r = run("не json");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /відмова/);
});
