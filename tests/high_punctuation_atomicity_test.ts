import assert from "node:assert/strict";
import {
  HIGH_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
} from "../src/mod.ts";
import { covers } from "./support/coverage.ts";

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
  covers("punctuation.colon.nbsp-before");
  covers("punctuation.semicolon.nnbsp-before");
  covers("punctuation.question.nnbsp-before");
  covers("punctuation.exclamation.nnbsp-before");
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
  covers("punctuation.colon.space-after");
  covers("punctuation.semicolon.space-after");
  covers("punctuation.question.space-after");
  covers("punctuation.exclamation.space-after");
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
  covers("punctuation.colon.space-after", ["adjacent-punctuation"]);
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
  covers("punctuation.colon.nbsp-before", [
    "time",
    "ratio",
    "uri",
    "port",
    "protected-content",
  ]);
  covers("punctuation.colon.space-after", [
    "technical-syntax",
    "protected-content",
  ]);
  covers("punctuation.question.nnbsp-before", ["expressive-sequence"]);
  covers("punctuation.question.space-after", ["expressive-sequence"]);
  covers("punctuation.exclamation.nnbsp-before", ["expressive-sequence"]);
  covers("punctuation.exclamation.space-after", [
    "expressive-sequence",
    "technical-syntax",
  ]);
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

Deno.test("no space is required after a mark that ends the text", () => {
  covers("punctuation.colon.space-after", ["end-of-text"]);
  covers("punctuation.semicolon.space-after", ["end-of-text"]);
  covers("punctuation.question.space-after", ["end-of-text"]);
  covers("punctuation.exclamation.space-after", ["end-of-text"]);
  const rules = [NUMERIC_PROTECTION_RULE, ...HIGH_PUNCTUATION_RULES];
  for (
    const [input, expected] of [
      ["Fin:", "Fin\u00a0:"],
      ["Fin;", "Fin\u202f;"],
      ["Fin?", "Fin\u202f?"],
      ["Fin!", "Fin\u202f!"],
    ] as const
  ) {
    const result = runPipeline(input, rules, { locale: "fr-FR", mode: "fix" });
    assert.equal(result.value, expected, input);
    assert.deepEqual(
      result.diagnostics.filter(({ ruleId }) =>
        (afterRuleIds as readonly string[]).includes(ruleId)
      ),
      [],
      input,
    );
  }
});

Deno.test("high punctuation leaves protected marks and spacing alone", () => {
  covers("punctuation.semicolon.nnbsp-before", ["protected-content"]);
  covers("punctuation.semicolon.space-after", ["protected-content"]);
  covers("punctuation.question.nnbsp-before", ["protected-content"]);
  covers("punctuation.question.space-after", ["protected-content"]);
  covers("punctuation.exclamation.nnbsp-before", ["protected-content"]);
  covers("punctuation.exclamation.space-after", ["protected-content"]);
  const rules = [NUMERIC_PROTECTION_RULE, ...HIGH_PUNCTUATION_RULES];
  for (
    const input of [
      [{ id: "code", value: "a ; b ? c ! d", protected: true }],
      [{ id: "text", value: "Mot " }, {
        id: "code",
        value: ";x",
        protected: true,
      }],
      [{ id: "text", value: "a ;" }, {
        id: "code",
        value: " b",
        protected: true,
      }],
      [{ id: "code", value: "x ", protected: true }, {
        id: "text",
        value: "?suite",
      }],
      [{ id: "text", value: "a ?" }, {
        id: "code",
        value: "  b",
        protected: true,
      }],
      [{ id: "text", value: "Oui" }, {
        id: "code",
        value: " ! code",
        protected: true,
      }],
    ]
  ) {
    const result = runPipeline(input, rules, { locale: "fr-FR", mode: "fix" });
    assert.deepEqual(result.segments, input);
    assert.deepEqual(result.changes, []);
    assert.deepEqual(result.diagnostics, []);
  }
});

Deno.test("technical syntax keeps its semicolons and question marks", () => {
  covers("punctuation.semicolon.space-after", [
    "technical-syntax",
    "adjacent-punctuation",
  ]);
  covers("punctuation.question.space-after", ["technical-syntax"]);
  const rules = [NUMERIC_PROTECTION_RULE, ...HIGH_PUNCTUATION_RULES];
  for (
    const input of [
      "Voir https://exemple.fr/a?b=1;c=2 et la suite",
      "Voir https://exemple.fr/page?q=1 ensuite",
      "a;;b",
      "for(;;)",
    ]
  ) {
    const result = runPipeline(input, rules, { locale: "fr-FR", mode: "fix" });
    assert.equal(result.value, input);
    assert.deepEqual(result.diagnostics, [], input);
  }
});
