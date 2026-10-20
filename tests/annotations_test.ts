import assert from "node:assert/strict";
import {
  compilePipeline,
  ELLIPSIS_CLASSIFICATION_RULE,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
  runTextNodePipeline,
} from "../src/mod.ts";
import { PRESETS, RULES, validateCatalogue } from "../src/catalogue/mod.ts";
import { SOURCES } from "../src/catalogue/sources.ts";
import type { Annotation } from "../src/model.ts";
import { assertCode } from "./support/errors.ts";
import { testRule } from "./support/rules.ts";

// Issue #22: rules declare the annotation kinds they provide or require
// (docs/conception-annotations-v0.1.md).
const fix = { locale: "fr-FR", mode: "fix" } as const;
const ellipsisRules = [
  NUMERIC_PROTECTION_RULE,
  ELLIPSIS_CLASSIFICATION_RULE,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
] as const;

function errorOf(action: () => unknown): Record<string, unknown> {
  try {
    action();
  } catch (error) {
    return error as Record<string, unknown>;
  }
  throw new Error("expected an error");
}

Deno.test("a required annotation kind needs a provider in the composition", () => {
  const missing = errorOf(() => compilePipeline([ELLIPSIS_GLYPH_RULE]));
  assert.equal(missing.code, "MISSING_ANNOTATION_PROVIDER");
  assert.deepEqual(missing.details, {
    ruleId: "punctuation.ellipsis.glyph",
    kind: "ellipsis",
    provider: "classify.ellipsis-candidates",
  });
  assert.match(String(missing.message), /add classify\.ellipsis-candidates/);

  // The initial spacing rule no longer runs without the classifications.
  assertCode(
    () => compilePipeline([ELLIPSIS_INITIAL_SPACE_AFTER_RULE]),
    "MISSING_ANNOTATION_PROVIDER",
  );
  // The ellipsis classifier itself depends on the numeric classification.
  assertCode(
    () => compilePipeline([ELLIPSIS_CLASSIFICATION_RULE, ELLIPSIS_GLYPH_RULE]),
    "MISSING_DEPENDENCY",
  );

  // A kind that no built-in rule provides names no provider.
  const reader = testRule("x-test.read", () => ({}), {
    requires: ["x-test"],
  });
  const external = errorOf(() => compilePipeline([reader]));
  assert.equal(external.code, "MISSING_ANNOTATION_PROVIDER");
  assert.deepEqual(external.details, { ruleId: "x-test.read", kind: "x-test" });
});

Deno.test("annotation providers are unique and belong to the classify phase", () => {
  const late = testRule("x-test.late", () => ({}), { provides: ["x-test"] });
  assertCode(() => compilePipeline([late]), "INVALID_RULE");

  const first = testRule("x-test.first", () => ({}), {
    phase: "classify",
    provides: ["x-test"],
  });
  const second = testRule("x-test.second", () => ({}), {
    phase: "classify",
    provides: ["x-test"],
  });
  const duplicate = errorOf(() => compilePipeline([first, second]));
  assert.equal(duplicate.code, "DUPLICATE_ANNOTATION_PROVIDER");
  assert.deepEqual(duplicate.details, {
    kind: "x-test",
    ruleId: "x-test.second",
    provider: "x-test.first",
  });

  const self = testRule("x-test.self", () => ({}), {
    phase: "classify",
    provides: ["x-test"],
    requires: ["x-test"],
  });
  assertCode(() => compilePipeline([self]), "DEPENDENCY_CYCLE");
});

Deno.test("providers run before the rules that require their kinds", () => {
  assert.deepEqual(
    compilePipeline([
      ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
      ELLIPSIS_GLYPH_RULE,
      ELLIPSIS_CLASSIFICATION_RULE,
      NUMERIC_PROTECTION_RULE,
    ]).map(({ id }) => id),
    [
      "classify.numeric-constructs",
      "classify.ellipsis-candidates",
      "punctuation.ellipsis.glyph",
      "punctuation.ellipsis.initial.space-after",
    ],
  );
  // Within the classify phase too.
  const reader = testRule("x-test.classify-reader", () => ({}), {
    phase: "classify",
    requires: ["numeric"],
  });
  assert.deepEqual(
    compilePipeline([reader, NUMERIC_PROTECTION_RULE]).map(({ id }) => id),
    ["classify.numeric-constructs", "x-test.classify-reader"],
  );
});

Deno.test("rules may only return and read the kinds they declare", () => {
  const undeclared = testRule(
    "x-test.undeclared",
    () => ({ annotations: [{ kind: "x-other", start: 0, end: 1 }] }),
    { phase: "classify", provides: ["x-test"] },
  );
  const returned = errorOf(() => runPipeline("texte", [undeclared], fix));
  assert.equal(returned.code, "INVALID_ANNOTATION");
  assert.deepEqual(returned.details, {
    ruleId: "x-test.undeclared",
    kind: "x-other",
  });

  const reader = testRule("x-test.reader", (run) => {
    run.annotations("numeric");
    return {};
  });
  const read = errorOf(() =>
    runPipeline("25 %", [NUMERIC_PROTECTION_RULE, reader], fix)
  );
  assert.equal(read.code, "UNDECLARED_ANNOTATION");
  assert.equal(read.category, "rule-contract");
  assert.deepEqual(read.details, { ruleId: "x-test.reader", kind: "numeric" });
});

Deno.test("ellipsis annotations follow the glyph correction", () => {
  const seen: Annotation[][] = [];
  const observer = testRule("x-test.observe-ellipsis", (run) => {
    seen.push([...run.annotations("ellipsis")]);
    return {};
  }, { phase: "cleanup", requires: ["ellipsis"] });
  const result = runPipeline("Il hésite... puis Oui", [
    ...ellipsisRules,
    observer,
  ], fix);
  assert.equal(result.value, "Il hésite… puis Oui");
  assert.deepEqual(seen, [[{
    kind: "ellipsis",
    start: 9,
    end: 10,
    data: { function: "final", certain: "true" },
  }]]);
});

Deno.test("the initial spacing rule reads the classified source text", () => {
  // In the source, `…Bon!Oui/non` is one token with a slash: the initial
  // ellipsis is not certain, although high-punctuation spacing then splits the
  // token. The rule used to classify after that spacing.
  const rules = [
    ...IMPRIMERIE_NATIONALE_RULES,
    ELLIPSIS_GLYPH_RULE,
    ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
  ];
  assert.equal(
    runPipeline("…Bon!Oui/non", rules, fix).value,
    "…Bon ! Oui/non",
  );
  assert.equal(
    runPipeline("…Bon ! Oui", rules, fix).value,
    "… Bon\u202f! Oui",
  );
  assert.equal(runPipeline("…Bon!Oui", rules, fix).value, "… Bon ! Oui");
});

Deno.test("the character after an ellipsis stops at protected text", () => {
  // A surrogate pair split by a protected node is not read as one letter.
  const split = runTextNodePipeline(
    [
      { id: "a", value: "...\ud835" },
      { id: "b", value: "\udc00 ", protected: true },
      { id: "c", value: "€...b" },
    ],
    ellipsisRules,
    fix,
  );
  assert.equal(split.value, "…𝐀 €...b");

  const guarded = runTextNodePipeline(
    [
      { id: "a", value: "…" },
      { id: "b", value: "Suite", protected: true },
    ],
    ellipsisRules,
    fix,
  );
  assert.deepEqual(guarded.changes, []);
});

Deno.test("the Imprimerie nationale preset provides the ellipsis classification", () => {
  assert.ok(
    IMPRIMERIE_NATIONALE_RULES.some(({ id }) =>
      id === "classify.ellipsis-candidates"
    ),
  );
  const result = runPipeline("…Suite et fin...", [
    ...IMPRIMERIE_NATIONALE_RULES,
    ELLIPSIS_GLYPH_RULE,
    ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
  ], fix);
  assert.equal(result.value, "… Suite et fin…");
});

Deno.test("the catalogue declares consistent annotation kinds", () => {
  assert.deepEqual(validateCatalogue(SOURCES, RULES, PRESETS), []);
  const numeric = RULES.find(({ id }) => id === "classify.numeric-constructs");
  const glyph = RULES.find(({ id }) => id === "punctuation.ellipsis.glyph");
  assert.ok(numeric !== undefined && glyph !== undefined);
  const messages = (rules: typeof RULES, presets = PRESETS) =>
    validateCatalogue(SOURCES, rules, presets).map(({ message }) => message);

  assert.ok(
    messages([...RULES, { ...glyph, id: "x", provides: ["x-kind"] }]).some((
      message,
    ) => message.includes("outside the classify phase")),
  );
  assert.ok(
    messages([...RULES, { ...numeric, id: "y" }]).some((message) =>
      message.includes("already provided by classify.numeric-constructs")
    ),
  );
  assert.ok(
    messages([...RULES, { ...glyph, id: "z", requires: ["x-kind"] }]).some((
      message,
    ) => message.includes("no rule provides annotation kind x-kind")),
  );
  const withoutClassifier = PRESETS.map((preset) => ({
    ...preset,
    rules: [
      ...preset.rules.filter(({ ruleId }) =>
        ruleId !== "classify.ellipsis-candidates"
      ),
      { ruleId: "punctuation.ellipsis.glyph" },
    ],
  }));
  assert.ok(
    messages(RULES, withoutClassifier).some((message) =>
      message.includes("which the preset does not select")
    ),
  );
});
