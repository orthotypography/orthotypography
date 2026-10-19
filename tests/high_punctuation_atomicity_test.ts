import assert from "node:assert/strict";
import {
  HIGH_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
} from "../src/mod.ts";

const beforeRuleIds = [
  "punctuation.colon.nbsp-before",
  "punctuation.semicolon.nnbsp-before",
  "punctuation.question.nnbsp-before",
  "punctuation.exclamation.nnbsp-before",
] as const;

const afterRuleIds = [
  "punctuation.colon.space-after",
  "punctuation.semicolon.space-after",
  "punctuation.question.space-after",
  "punctuation.exclamation.space-after",
] as const;

function selectedHighRules(ruleIds: readonly string[]) {
  const selected = HIGH_PUNCTUATION_RULES.filter(({ id }) =>
    ruleIds.includes(id)
  );
  return [NUMERIC_PROTECTION_RULE, ...selected];
}

Deno.test("high-punctuation before rules only normalize preceding whitespace", () => {
  const result = runPipeline(
    "Colon :suite;encore?vraiment!fin",
    selectedHighRules(beforeRuleIds),
    { locale: "fr-FR", mode: "fix" },
  );

  assert.equal(
    result.value,
    "Colon\u00a0:suite\u202f;encore\u202f?vraiment\u202f!fin",
  );
  assert.deepEqual(
    result.diagnostics.map(({ ruleId }) => ruleId),
    beforeRuleIds,
  );
});

Deno.test("high-punctuation after rules only normalize following whitespace", () => {
  const result = runPipeline(
    "Colon :suite ;encore ?vraiment !fin",
    selectedHighRules(afterRuleIds),
    { locale: "fr-FR", mode: "fix" },
  );

  assert.equal(result.value, "Colon : suite ; encore ? vraiment ! fin");
  assert.deepEqual(
    result.diagnostics.map(({ ruleId }) => ruleId),
    afterRuleIds,
  );
});

Deno.test("atomic high-punctuation rules report independently in lint mode", () => {
  const input = "Colon:suite;encore?vraiment!fin";
  const result = runPipeline(
    input,
    [NUMERIC_PROTECTION_RULE, ...HIGH_PUNCTUATION_RULES],
    { locale: "fr-FR", mode: "lint" },
  );

  assert.equal(result.value, input);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(
    result.diagnostics.map(({ ruleId }) => ruleId),
    [
      "punctuation.colon.nbsp-before",
      "punctuation.colon.space-after",
      "punctuation.semicolon.nnbsp-before",
      "punctuation.semicolon.space-after",
      "punctuation.question.nnbsp-before",
      "punctuation.question.space-after",
      "punctuation.exclamation.nnbsp-before",
      "punctuation.exclamation.space-after",
    ],
  );
  assert.equal(
    new Set(
      result.diagnostics.map(({ ruleId, segmentIndex, start, end }) =>
        `${ruleId}:${segmentIndex}:${start}:${end}`
      ),
    ).size,
    result.diagnostics.length,
  );
});

Deno.test("shared high-punctuation boundaries have one owning rule", () => {
  const input = "A:;B;:C";
  const rules = [NUMERIC_PROTECTION_RULE, ...HIGH_PUNCTUATION_RULES];
  const linted = runPipeline(input, rules, {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(linted.diagnostics.length, 6);
  assert.deepEqual(
    linted.diagnostics.filter(({ start, end }) => start === 2 && end === 2)
      .map(({ ruleId }) => ruleId),
    ["punctuation.semicolon.nnbsp-before"],
  );
  assert.deepEqual(
    linted.diagnostics.filter(({ start, end }) => start === 5 && end === 5)
      .map(({ ruleId }) => ruleId),
    ["punctuation.semicolon.space-after"],
  );

  const fixed = runPipeline(input, rules, {
    locale: "fr-FR",
    mode: "fix",
  });
  assert.equal(fixed.value, "A\u00a0:\u202f; B\u202f; : C");
  assert.ok(fixed.changes.every(({ ruleIds }) => ruleIds.length === 1));

  const segmented = runPipeline(
    [{ id: "left", value: "A:" }, { id: "right", value: ";B" }],
    rules,
    { locale: "fr-FR", mode: "lint" },
  );
  assert.deepEqual(
    segmented.diagnostics.map(({ ruleId, segmentId, start }) => ({
      ruleId,
      segmentId,
      start,
    })),
    [
      {
        ruleId: "punctuation.colon.nbsp-before",
        segmentId: "left",
        start: 1,
      },
      {
        ruleId: "punctuation.semicolon.nnbsp-before",
        segmentId: "right",
        start: 0,
      },
      {
        ruleId: "punctuation.semicolon.space-after",
        segmentId: "right",
        start: 1,
      },
    ],
  );
});

Deno.test("atomic high-punctuation changes retain source IDs and UTF-16 coordinates", () => {
  const input = [
    { id: "lead", value: "🚀 Mot " },
    { id: "mark", value: ":" },
    { id: "tail", value: " suite" },
  ] as const;
  const rules = [NUMERIC_PROTECTION_RULE, ...HIGH_PUNCTUATION_RULES];
  const fixed = runPipeline(input, rules, {
    locale: "fr-FR",
    mode: "fix",
  });

  assert.deepEqual(fixed.segments.map(({ value }) => value), [
    "🚀 Mot",
    "\u00a0:",
    " suite",
  ]);
  assert.deepEqual(
    fixed.changes.map(({ segmentId, start, end, ruleIds }) => ({
      segmentId,
      start,
      end,
      ruleIds,
    })),
    [
      {
        segmentId: "lead",
        start: 6,
        end: 7,
        ruleIds: ["punctuation.colon.nbsp-before"],
      },
      {
        segmentId: "mark",
        start: 0,
        end: 0,
        ruleIds: ["punctuation.colon.nbsp-before"],
      },
    ],
  );

  const linted = runPipeline(input, rules, {
    locale: "fr-FR",
    mode: "lint",
  });
  assert.deepEqual(
    linted.diagnostics.map(({ ruleId, segmentId, start, end, related }) => ({
      ruleId,
      segmentId,
      start,
      end,
      related: related?.map(({ segmentId, start, end }) => ({
        segmentId,
        start,
        end,
      })),
    })),
    [
      {
        ruleId: "punctuation.colon.nbsp-before",
        segmentId: "mark",
        start: 0,
        end: 0,
        related: [{ segmentId: "lead", start: 6, end: 7 }],
      },
    ],
  );
});

Deno.test("atomic high-punctuation rules preserve protected and technical contexts", () => {
  const technical =
    "À 12:30, ratio 1:2, https://exemple.fr:443/a, localhost:3000, ::before, Quoi?!, Vraiment!!, Déclaration !important";
  const technicalResult = runPipeline(
    technical,
    [NUMERIC_PROTECTION_RULE, ...HIGH_PUNCTUATION_RULES],
    { locale: "fr-FR", mode: "fix" },
  );
  assert.equal(technicalResult.value, technical);
  assert.deepEqual(technicalResult.diagnostics, []);

  const protectedInput = [
    { id: "left", value: "Mot" },
    { id: "code", value: ":suite", protected: true },
    { id: "right", value: "!important" },
  ] as const;
  const protectedResult = runPipeline(
    protectedInput,
    [NUMERIC_PROTECTION_RULE, ...HIGH_PUNCTUATION_RULES],
    { locale: "fr-FR", mode: "fix" },
  );
  assert.deepEqual(protectedResult.segments, protectedInput);
  assert.deepEqual(protectedResult.changes, []);

  const protectedBoundary = [
    { id: "plain", value: "Mot:" },
    { id: "code", value: "suite", protected: true },
  ] as const;
  const boundaryResult = runPipeline(protectedBoundary, [
    NUMERIC_PROTECTION_RULE,
    ...HIGH_PUNCTUATION_RULES,
  ], { locale: "fr-FR", mode: "fix" });
  assert.deepEqual(boundaryResult.segments, [
    { id: "plain", value: "Mot\u00a0: " },
    protectedBoundary[1],
  ]);
  assert.ok(
    boundaryResult.changes.every(({ segmentId }) => segmentId === "plain"),
  );
});

Deno.test("the complete executable preset preserves high-punctuation output", () => {
  const input = "Note:exemple; vraiment? Bravo!";
  const first = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    mode: "fix",
  });
  const second = runPipeline(first.value, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    mode: "fix",
  });

  assert.equal(
    first.value,
    "Note\u00a0: exemple\u202f; vraiment\u202f? Bravo\u202f!",
  );
  assert.equal(second.value, first.value);
  assert.deepEqual(second.diagnostics, []);
  for (const ruleId of afterRuleIds) {
    assert.ok(first.appliedRuleIds.includes(ruleId));
  }
});
