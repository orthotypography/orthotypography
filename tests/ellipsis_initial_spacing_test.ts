import assert from "node:assert/strict";
import {
  applyTextChanges,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";

const rules = [
  NUMERIC_PROTECTION_RULE,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
] as const;
const fix = { locale: "fr-FR", mode: "fix" } as const;

Deno.test("initial spacing fixes only a certain structural beginning", () => {
  for (
    const [input, expected] of [
      ["…Suite", "… Suite"],
      ["…𐐀près 🚀", "… 𐐀près 🚀"],
      ["  …Suite", "  … Suite"],
      ["🚀 …Suite", "🚀 …Suite"],
    ]
  ) {
    const result = runPipeline(input, rules, fix);
    assert.equal(result.value, expected, input);
    assert.equal(applyTextChanges(input, result.changes), expected);
  }
  const result = runPipeline("🚀…Suite", rules, fix);
  assert.deepEqual(result.changes, []);
  const offset = runPipeline("  …Suite", rules, fix);
  assert.deepEqual(offset.changes, [{
    id: "c0",
    segmentIndex: 0,
    start: 3,
    end: 3,
    expected: "",
    replacement: " ",
    ruleIds: ["punctuation.ellipsis.initial.space-after"],
  }]);
});

Deno.test("initial spacing preserves excluded functions and syntax", () => {
  for (
    const input of [
      "… Suite",
      "…\u00a0Suite",
      "…\nSuite",
      "…",
      "…!Suite",
      "...Suite",
      "...args",
      "etc...",
      "Il hésite…Suite",
      "Alors …Suite",
      "mot … mot",
      "Quoi ?…Suite",
      '"…Suite"',
      "«…Suite»",
      "(…Suite)",
      "[…Suite]",
      "[…]",
      "[ … ]",
      "../dossier/…Suite",
      "https://example.test/…Suite",
      "....Suite",
      ".…Suite",
      "…",
      "…🚀Suite",
    ]
  ) {
    const result = runPipeline(input, rules, fix);
    assert.equal(result.value, input, input);
    assert.deepEqual(result.changes, [], input);
  }
});

Deno.test("initial spacing keeps source segments and guarded UTF-16 offsets", () => {
  const input = [
    { id: "ellipsis", value: "  …" },
    { id: "word", value: "Suite 🚀" },
  ];
  const result = runPipeline(input, rules, fix);
  assert.deepEqual(result.segments, [
    { id: "ellipsis", value: "  … " },
    { id: "word", value: "Suite 🚀" },
  ]);
  assert.deepEqual(result.changes, [{
    id: "c0",
    segmentIndex: 0,
    segmentId: "ellipsis",
    start: 3,
    end: 3,
    expected: "",
    replacement: " ",
    ruleIds: ["punctuation.ellipsis.initial.space-after"],
  }]);
  assert.deepEqual(applyTextChanges(input, result.changes), result.segments);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].segmentId, "ellipsis");
  assert.equal(result.diagnostics[0].start, 2);
  assert.equal(result.diagnostics[0].end, 3);
  assertCode(() =>
    applyTextChanges([
      { id: "ellipsis", value: "  …", protected: true },
      input[1],
    ], result.changes), "INVALID_CHANGE");
});

Deno.test("initial spacing does not cross protected boundaries", () => {
  const inputs = [
    [{ id: "mark", value: "…" }, {
      id: "word",
      value: "Suite",
      protected: true,
    }],
    [{ id: "mark", value: "…", protected: true }, {
      id: "word",
      value: "Suite",
    }],
    [{ id: "prefix", value: "A", protected: true }, {
      id: "mark",
      value: "…Suite",
    }],
  ];
  for (const input of inputs) {
    const result = runPipeline(input, rules, fix);
    assert.deepEqual(result.changes, []);
    assert.deepEqual(result.segments, input);
  }
});

Deno.test("initial spacing defaults to lint and explicit fix is idempotent", () => {
  const input = "…Suite";
  const lint = runPipeline(input, rules, { locale: "fr-FR" });
  assert.equal(lint.value, input);
  assert.deepEqual(lint.changes, []);
  assert.deepEqual(lint.diagnostics.map(({ ruleId }) => ruleId), [
    "punctuation.ellipsis.initial.space-after",
  ]);
  const fixed = runPipeline(input, rules, fix);
  assert.equal(fixed.value, "… Suite");
  const again = runPipeline(fixed.value, rules, fix);
  assert.deepEqual(again.changes, []);
  assert.deepEqual(again.diagnostics, []);
});

Deno.test("glyph and initial spacing produce disjoint source changes", () => {
  const input = [
    { id: "ellipsis", value: "…" },
    { id: "word", value: "Suite 🚀 hésite..." },
  ];
  const result = runPipeline(input, rules, fix);
  assert.equal(result.value, "… Suite 🚀 hésite…");
  assert.deepEqual(
    result.changes.map(({ segmentId, start, end, expected, replacement }) => ({
      segmentId,
      start,
      end,
      expected,
      replacement,
    })),
    [
      {
        segmentId: "ellipsis",
        start: 1,
        end: 1,
        expected: "",
        replacement: " ",
      },
      {
        segmentId: "word",
        start: 15,
        end: 18,
        expected: "...",
        replacement: "…",
      },
    ],
  );
  assert.deepEqual(
    result.diagnostics.map(({ segmentId }) => ({
      segmentId,
    })),
    [
      { segmentId: "word" },
      { segmentId: "ellipsis" },
    ],
  );
  assert.deepEqual(applyTextChanges(input, result.changes), result.segments);
  const sameSegment = runPipeline("…Suite puis hésite...", rules, fix);
  assert.equal(sameSegment.value, "… Suite puis hésite…");
  assert.deepEqual(
    sameSegment.diagnostics.map(({ start }) => ({
      start,
    })),
    [
      { start: 18 },
      { start: 0 },
    ],
  );
  assert.equal(
    applyTextChanges("…Suite puis hésite...", sameSegment.changes),
    sameSegment.value,
  );
  const separated = runPipeline(
    [
      { id: "ellipsis", value: "…" },
      { id: "word", value: "Suite" },
    ],
    rules,
    fix,
  );
  assert.deepEqual(separated.changes.map(({ ruleIds }) => ruleIds), [[
    "punctuation.ellipsis.initial.space-after",
  ]]);
});

Deno.test("initial spacing stays outside the executable preset", () => {
  const result = runPipeline("…Suite", IMPRIMERIE_NATIONALE_RULES, fix);
  assert.equal(result.value, "…Suite");
  assert.ok(
    !result.appliedRuleIds.includes(
      "punctuation.ellipsis.initial.space-after",
    ),
  );
});
