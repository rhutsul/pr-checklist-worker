// Офлайн-тести правил на golden data — без моделі: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InputError, ROOT, runChecks } from "../scripts/lib/checks.mjs";

const expected = JSON.parse(readFileSync(path.join(ROOT, "golden", "expected.json"), "utf8"));
const key = (f) => `${f.rule}|${f.file}|${f.line}`;

for (const [pr, exp] of Object.entries(expected).filter(([k]) => !k.startsWith("_"))) {
  test(`${pr}: ${exp.what} → ${exp.verdict}`, () => {
    const r = runChecks(`data/${pr}`);
    assert.equal(r.verdict, exp.verdict);
    const blocking = r.findings.filter((f) => f.severity === "блокує").map(key).sort();
    assert.deepEqual(blocking, exp.findings.map(key).sort());
  });
}

test("pr-101: кроки «Тоді» справді знайдено й звірено (а не пропущено)", () => {
  const r = runChecks("data/pr-101");
  assert.ok(r.checked.some((c) => c.includes("«Тоді»")));
  assert.deepEqual(r.notChecked, []);
});

test("тека поза data/ — відмова (InputError)", () => {
  assert.throws(() => runChecks("../"), InputError);
  assert.throws(() => runChecks("golden"), InputError);
});

test("секрет у звіті замасковано, значення не друкується", () => {
  const r = runChecks("data/pr-104");
  const s = r.findings.find((f) => f.rule === "SECRET");
  assert.ok(s);
  assert.ok(!s.evidence.includes("notarealtoken0123456789abcdef"));
});
