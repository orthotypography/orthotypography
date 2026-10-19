import assert from "node:assert/strict";
import { RULES } from "../src/catalogue/mod.ts";
import { EXECUTABLE_RULES } from "../src/mod.ts";
import { parseCoverage, readCoverage } from "../scripts/test_coverage.ts";

// Issue #28: tests declare the rules and exceptions they cover
// (docs/conception-matrice-generee-v0.1.md).
const root = new URL("../", import.meta.url);

Deno.test("every executable rule and testable exception is covered", async () => {
  const declarations = await readCoverage(root);
  const covered = new Set<string>();
  for (const { ruleId, exceptionIds } of declarations) {
    covered.add(ruleId);
    for (const exceptionId of exceptionIds) {
      covered.add(`${ruleId}#${exceptionId}`);
    }
  }
  const missing: string[] = [];
  for (const id of EXECUTABLE_RULES.keys()) {
    if (!covered.has(id)) missing.push(id);
    const rule = RULES.find((entry) => entry.id === id);
    for (const exception of rule?.exceptions ?? []) {
      // The core does not detect integration or review cases.
      if (exception.scope !== undefined) continue;
      if (!covered.has(`${id}#${exception.id}`)) {
        missing.push(`${id}#${exception.id}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

Deno.test("coverage declarations name catalogued rules and exceptions", async () => {
  for (const { file, ruleId, exceptionIds } of await readCoverage(root)) {
    const rule = RULES.find(({ id }) => id === ruleId);
    assert.ok(rule, `${file}: unknown rule ${ruleId}`);
    for (const exceptionId of exceptionIds) {
      assert.ok(
        rule.exceptions.some(({ id }) => id === exceptionId),
        `${file}: ${ruleId} has no exception ${exceptionId}`,
      );
    }
  }
});

Deno.test("coverage declarations are read from literal calls", () => {
  assert.deepEqual(
    parseCoverage(
      "x_test.ts",
      `covers("a.b");\ncovers("c.d", ["e", "f-g"]);\ncovers(\n  "h.i",\n  [\n    "j",\n  ],\n);`,
    ),
    [
      { file: "x_test.ts", ruleId: "a.b", exceptionIds: [] },
      { file: "x_test.ts", ruleId: "c.d", exceptionIds: ["e", "f-g"] },
      { file: "x_test.ts", ruleId: "h.i", exceptionIds: ["j"] },
    ],
  );
});
