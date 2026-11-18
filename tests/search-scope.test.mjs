// Тести хука PreToolUse scripts/hooks/search-scope.mjs (Grep / Glob лише в data/ і references/) — без моделі
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ROOT } from "../scripts/lib/checks.mjs";
import { decide } from "../scripts/hooks/search-scope.mjs";

const g = (tool, tool_input, cwd = ROOT) => decide({ hook_event_name: "PreToolUse", tool_name: tool, tool_input, cwd }, ROOT);

const ALLOWED = [
  ["Grep", { pattern: "AC-DEMO-03", path: "data/pr-103/tree" }],
  ["Grep", { pattern: "AC-DEMO", path: path.join(ROOT, "data", "pr-103") }],
  ["Grep", { pattern: "THEN_VERBATIM", path: "references" }],
  ["Grep", { pattern: "x", path: "references/rules.md" }],
  ["Glob", { pattern: "**/*.spec.ts", path: "data/pr-101/tree" }],
  ["Glob", { pattern: "data/pr-10*/files.txt" }],
  ["Glob", { pattern: "references/*.md" }],
];

const DENIED = [
  ["Grep", { pattern: "verdict" }, "без path"],
  ["Grep", { pattern: "verdict", path: "golden" }, "golden"],
  ["Grep", { pattern: "x", path: "." }, "«.»"],
  ["Grep", { pattern: "x", path: "data/../golden" }, "data/../golden"],
  ["Grep", { pattern: "x", path: "tests" }, "tests"],
  ["Grep", { pattern: "x", path: "docs/worker/runs" }, "docs/worker/runs"],
  ["Grep", { pattern: "x", path: "C:/Windows" }, "C:/Windows"],
  ["Glob", { pattern: "**/*.json" }, "без path"],
  ["Glob", { pattern: "golden/*" }, "golden"],
  ["Glob", { pattern: "../**" }, "../**"],
  ["Glob", { pattern: "../../golden/*", path: "data/pr-101" }, "data/pr-101"],
  ["Glob", { pattern: "*", path: "scripts" }, "scripts"],
];

for (const [tool, ti] of ALLOWED) {
  test(`пропускає ${tool} ${JSON.stringify(ti).replaceAll(ROOT, "<ROOT>")}`, () => assert.equal(g(tool, ti), null));
}

for (const [tool, ti, mention] of DENIED) {
  test(`відхиляє ${tool} ${JSON.stringify(ti)}`, () => {
    const d = g(tool, ti);
    assert.equal(d.hookSpecificOutput.permissionDecision, "deny");
    const why = d.hookSpecificOutput.permissionDecisionReason;
    assert.ok(why.includes(mention), why);
    assert.ok(why.includes("data/") && why.includes("references/"), "пояснення каже, де можна");
  });
}

test("Bash і Read цей хук не чіпає", () => {
  assert.equal(g("Bash", { command: "git push" }), null);
  assert.equal(g("Read", { file_path: "golden/expected.json" }), null);
});

test("процес хука: Grep у golden → JSON deny; зламаний вхід → код 2", () => {
  const hook = path.join(ROOT, "scripts", "hooks", "search-scope.mjs");
  const env = { ...process.env, CLAUDE_PROJECT_DIR: ROOT };
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_name: "Grep", tool_input: { pattern: "x", path: "golden" }, cwd: ROOT }), encoding: "utf8", env,
  });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, "deny");
  const bad = spawnSync(process.execPath, [hook], { input: "{", encoding: "utf8", env });
  assert.equal(bad.status, 2);
});
