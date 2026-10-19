import assert from "node:assert/strict";
import {
  EURO_SPACING_RULE,
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";

Deno.test("euro spacing is diagnostic by default", () => {
  const result = runPipeline(
    "12€",
    [NUMERIC_PROTECTION_RULE, EURO_SPACING_RULE],
    { locale: "fr-FR" },
  );
  assert.equal(result.value, "12€");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].replacement, "12\u00a0€");
});

Deno.test("euro spacing fixes placement and spacing when requested", () => {
  const result = runPipeline("€12 ; 20 €", IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    mode: "fix",
  });
  assert.equal(result.value, "12\u00a0€\u202f; 20\u00a0€");
});

Deno.test("euro spacing preserves other and ambiguous currencies", () => {
  const input = "12 USD / 12$ / $12 / 12 £ / £12 / 12 EUR";
  const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
  });
  assert.equal(result.value, input);
  assert.deepEqual(
    result.diagnostics.filter(({ ruleId }) =>
      ruleId === "number.euro.nbsp-before"
    ),
    [],
  );
});

Deno.test("euro spacing preserves protected URI", () => {
  const input = "https://x.test/12€";
  const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
  });
  assert.equal(result.value, input);
});

Deno.test("euro spacing requires classification and is idempotent", () => {
  assertCode(
    () => runPipeline("12€", [EURO_SPACING_RULE], { locale: "fr-FR" }),
    "MISSING_ANNOTATION_PROVIDER",
  );
  const rules = [NUMERIC_PROTECTION_RULE, EURO_SPACING_RULE];
  const first = runPipeline("€12", rules, {
    locale: "fr-FR",
    mode: "fix",
  });
  const second = runPipeline(first.value, rules, {
    locale: "fr-FR",
    mode: "fix",
  });
  assert.equal(second.value, first.value);
  assert.deepEqual(second.diagnostics, []);
});

Deno.test("euro spacing keeps a symbol with the amount it follows", () => {
  const rules = [NUMERIC_PROTECTION_RULE, EURO_SPACING_RULE];
  for (
    const [input, expected] of [
      ["Prix : 25\u00a0€ 30\u00a0€", "Prix : 25\u00a0€ 30\u00a0€"],
      ["Prix : 25 € 30 €", "Prix : 25\u00a0€ 30\u00a0€"],
      ["25 € 12,5", "25\u00a0€ 12,5"],
      ["€ 25 12,5 12,5", "25\u00a0€ 12,5 12,5"],
      ["12€ et €30", "12\u00a0€ et 30\u00a0€"],
    ]
  ) {
    const lint = runPipeline(input, rules, { locale: "fr-FR", mode: "lint" });
    const fix = runPipeline(input, rules, { locale: "fr-FR", mode: "fix" });
    assert.equal(fix.value, expected, input);
    assert.deepEqual(
      lint.diagnostics.map(({ replacement }) => replacement),
      fix.changes.map(({ replacement }) => replacement),
      input,
    );
    const again = runPipeline(fix.value, rules, {
      locale: "fr-FR",
      mode: "fix",
    });
    assert.deepEqual(again.changes, [], input);
  }
});

Deno.test("a euro sign attached to the preceding text is reported, not moved", () => {
  // Issue #36: moving the sign would glue the preceding word to the amount.
  const rules = [NUMERIC_PROTECTION_RULE, EURO_SPACING_RULE];
  for (
    const input of ["Prix€ 12", "le prix€12 est", "Prix:€12", "coût€ 1 200"]
  ) {
    for (const mode of ["lint", "fix"] as const) {
      const result = runPipeline(input, rules, { locale: "fr-FR", mode });
      assert.equal(result.value, input, `${mode} ${input}`);
      assert.deepEqual(result.changes, [], `${mode} ${input}`);
      assert.equal(result.diagnostics.length, 1, `${mode} ${input}`);
      const [diagnostic] = result.diagnostics;
      assert.equal(diagnostic.ruleId, "number.euro.nbsp-before");
      assert.equal(diagnostic.replacement, undefined);
      assert.match(diagnostic.message, /attached to the preceding text/);
    }
  }

  // After a space, an opening sign, or at the start, the sign still moves.
  for (
    const [input, expected] of [
      ["Prix €12", "Prix 12 €"],
      ["(€12)", "(12 €)"],
      ["«€12»", "«12 €»"],
      ["€12", "12 €"],
    ]
  ) {
    assert.equal(
      runPipeline(input, rules, { locale: "fr-FR", mode: "fix" }).value,
      expected,
    );
  }

  // In the preset, the colon rule runs first and leaves a space before the
  // sign, which can then move.
  assert.equal(
    runPipeline("Prix:€12", IMPRIMERIE_NATIONALE_RULES, {
      locale: "fr-FR",
      mode: "fix",
    }).value,
    "Prix : 12 €",
  );
});
