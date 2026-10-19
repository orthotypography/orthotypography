import assert from "node:assert/strict";
import {
  applyTextChanges,
  ELLIPSIS_CLASSIFICATION_RULE,
  ELLIPSIS_GLYPH_RULE,
  ETC_ELLIPSIS_RULE,
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
} from "../src/mod.ts";

const rules = [
  NUMERIC_PROTECTION_RULE,
  ELLIPSIS_CLASSIFICATION_RULE,
  ELLIPSIS_GLYPH_RULE,
] as const;
const options = { locale: "fr-FR", mode: "fix" } as const;

Deno.test("glyph fix converts only certain final and structural initial ellipses", () => {
  for (
    const [input, expected] of [
      ["Il hésite...", "Il hésite…"],
      ["Il hésite... puis répond.", "Il hésite… puis répond."],
      ["... Suite du texte", "… Suite du texte"],
      ["  ... Suite", "  … Suite"],
      ["Il hésite...! Puis...", "Il hésite…! Puis…"],
    ]
  ) {
    const result = runPipeline(input, rules, options);
    assert.equal(result.value, expected, input);
    assert.equal(applyTextChanges(input, result.changes), expected, input);
    assert.ok(
      result.changes.every(({ ruleIds }) =>
        ruleIds.includes("punctuation.ellipsis.glyph")
      ),
    );
  }
});

Deno.test("glyph fix preserves ambiguous and excluded sequences", () => {
  for (
    const input of [
      "mot ... mot",
      "Alors ...",
      "Quoi ?...",
      "mot…",
      "...args",
      "etc...",
      "etc. ...",
      "[...]",
      "[ … ]",
      "..",
      "....",
      ".....",
      "../dossier/.../fichier",
      "https://example.test/.../page",
      "version...beta",
      "192.168.0.1/...",
      "const copie = {...objet}",
    ]
  ) {
    const result = runPipeline(input, rules, options);
    assert.equal(result.value, input);
    assert.deepEqual(result.changes, [], input);
  }
});

Deno.test("glyph fix retains all segment identities and emits guarded UTF-16 changes", () => {
  const input = [
    { id: "lead", value: "🚀 hésite." },
    { id: "middle", value: "." },
    { id: "tail", value: ". Suite." },
  ] as const;
  const result = runPipeline(input, rules, options);
  assert.equal(result.value, "🚀 hésite… Suite.");
  assert.deepEqual(result.segments, [
    { id: "lead", value: "🚀 hésite…" },
    { id: "middle", value: "" },
    { id: "tail", value: " Suite." },
  ]);
  assert.deepEqual(result.changes, [
    {
      id: "c0",
      segmentIndex: 0,
      segmentId: "lead",
      start: 9,
      end: 10,
      expected: ".",
      replacement: "…",
      ruleIds: ["punctuation.ellipsis.glyph"],
    },
    {
      id: "c1",
      segmentIndex: 1,
      segmentId: "middle",
      start: 0,
      end: 1,
      expected: ".",
      replacement: "",
      ruleIds: ["punctuation.ellipsis.glyph"],
    },
    {
      id: "c2",
      segmentIndex: 2,
      segmentId: "tail",
      start: 0,
      end: 1,
      expected: ".",
      replacement: "",
      ruleIds: ["punctuation.ellipsis.glyph"],
    },
  ]);
  assert.deepEqual(applyTextChanges(input, result.changes), result.segments);
  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(
    result.diagnostics[0].related?.map(({ segmentId }) => segmentId),
    ["middle", "tail"],
  );
});

Deno.test("glyph fix handles an initial ellipse split after two dots", () => {
  const input = [{ id: "first", value: ".." }, {
    id: "second",
    value: ". Suite",
  }];
  const result = runPipeline(input, rules, options);
  assert.equal(result.value, "… Suite");
  assert.deepEqual(
    result.changes.map(({ expected, replacement }) => ({
      expected,
      replacement,
    })),
    [
      { expected: "..", replacement: "…" },
      { expected: ".", replacement: "" },
    ],
  );
  assert.deepEqual(applyTextChanges(input, result.changes), result.segments);
});

Deno.test("glyph fix never crosses protected boundaries or changes protected text", () => {
  const input = [
    { id: "left", value: "Il hésite." },
    { id: "barrier", value: ".", protected: true },
    { id: "right", value: ". Suite" },
    { id: "literal", value: "...", protected: true },
  ];
  const result = runPipeline(input, rules, options);
  assert.deepEqual(result.segments, input);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.diagnostics, []);
});

Deno.test("glyph rule defaults to lint and fix is idempotent", () => {
  const input = "🚀 hésite...";
  const lint = runPipeline(input, rules, { locale: "fr-FR" });
  assert.equal(lint.value, input);
  assert.deepEqual(lint.changes, []);
  assert.equal(lint.diagnostics.length, 1);
  const fixed = runPipeline(input, rules, options);
  const again = runPipeline(fixed.value, rules, options);
  assert.equal(fixed.value, "🚀 hésite…");
  assert.equal(again.value, fixed.value);
  assert.deepEqual(again.changes, []);
  assert.deepEqual(again.diagnostics, []);
});

Deno.test("glyph and etc. rules do not emit competing diagnostics", () => {
  const result = runPipeline("etc... Il hésite...", [
    NUMERIC_PROTECTION_RULE,
    ELLIPSIS_CLASSIFICATION_RULE,
    ELLIPSIS_GLYPH_RULE,
    ETC_ELLIPSIS_RULE,
  ], options);
  assert.equal(result.value, "etc. Il hésite…");
  assert.deepEqual(result.diagnostics.map(({ ruleId }) => ruleId), [
    "punctuation.ellipsis.glyph",
    "punctuation.ellipsis.after-etc.forbidden",
  ]);
});

Deno.test("glyph rule is not active in the executable preset", () => {
  const result = runPipeline(
    "Il hésite...",
    IMPRIMERIE_NATIONALE_RULES,
    options,
  );
  assert.equal(result.value, "Il hésite...");
  assert.ok(!result.appliedRuleIds.includes("punctuation.ellipsis.glyph"));
});

Deno.test("spaced ellipses stay unchanged and stable with the full composition", () => {
  const rules = [...IMPRIMERIE_NATIONALE_RULES, ELLIPSIS_GLYPH_RULE];
  for (
    const input of [
      "Alors ...",
      "Alors … fin",
      "Il m’a traité de ... devant tout le monde.",
    ]
  ) {
    const result = runPipeline(input, rules, { locale: "fr-FR", mode: "fix" });
    assert.equal(result.value, input);
    assert.deepEqual(result.changes, []);
  }
  const attached = runPipeline("Alors...", rules, {
    locale: "fr-FR",
    mode: "fix",
  });
  assert.equal(attached.value, "Alors…");
});
