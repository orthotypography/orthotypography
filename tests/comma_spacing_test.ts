import assert from "node:assert/strict";
import {
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
  runTextNodePipeline,
  SPACE_AFTER_COMMA_RULE,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";
import { covers } from "./support/coverage.ts";

Deno.test("missing spaces after commas are inserted in prose", () => {
  covers("punctuation.comma.space-after");
  const result = runPipeline(
    "Bonjour,monde; puis,« citation »; enfin,(une précision).",
    [SPACE_AFTER_COMMA_RULE],
    { locale: "fr-FR" },
  );

  assert.equal(
    result.value,
    "Bonjour, monde; puis, « citation »; enfin, (une précision).",
  );
  assert.equal(result.diagnostics.length, 3);
});

Deno.test("comma spacing preserves valid whitespace and adjacent punctuation", () => {
  covers("punctuation.comma.space-after", [
    "end-of-text",
    "adjacent-punctuation",
  ]);
  const input = "Fin, autre,\tencore,\nligne,, suite,. suite,; suite,!? suite,";
  const result = runPipeline(input, [SPACE_AFTER_COMMA_RULE], {
    locale: "fr-FR",
  });

  assert.equal(result.value, input);
  assert.deepEqual(result.diagnostics, []);
});

Deno.test("comma spacing preserves numeric and technical constructions", () => {
  covers("punctuation.comma.space-after", [
    "decimal-separator",
    "technical-syntax",
  ]);
  const input =
    "Décimale 1,5; URI https://example.test/a,b; chemin /tmp/a,b; version 1.2.3.";
  const result = runPipeline(
    input,
    [NUMERIC_PROTECTION_RULE, SPACE_AFTER_COMMA_RULE],
    { locale: "fr-FR" },
  );

  assert.equal(result.value, input);
  assert.deepEqual(result.diagnostics, []);
});

Deno.test("comma spacing does not cross protected segments", () => {
  covers("punctuation.comma.space-after", ["protected-content"]);
  const source = [
    { id: "plain", value: "Bonjour," },
    { id: "code", value: "monde", protected: true },
  ] as const;
  const result = runPipeline(source, [SPACE_AFTER_COMMA_RULE], {
    locale: "fr-FR",
  });

  assert.deepEqual(result.segments, source);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.diagnostics, []);
});

Deno.test("comma spacing supports lint mode in source UTF-16 coordinates", () => {
  const input = "🚀 1.2.3 Bonjour,monde";
  const result = runPipeline(
    input,
    [NUMERIC_PROTECTION_RULE, SPACE_AFTER_COMMA_RULE],
    {
      locale: "fr-FR",
      mode: "lint",
    },
  );

  assert.equal(result.value, input);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => ({
      start: diagnostic.start,
      end: diagnostic.end,
      replacement: diagnostic.replacement,
    })),
    [{ start: 17, end: 17, replacement: " " }],
  );
});

Deno.test("comma spacing emits a guarded cross-segment insertion", () => {
  const result = runTextNodePipeline(
    [
      { id: "left", value: "🚀 Bonjour," },
      { id: "empty", value: "" },
      { id: "right", value: "monde" },
    ],
    [SPACE_AFTER_COMMA_RULE],
    { locale: "fr-FR", mode: "fix" },
  );

  assert.deepEqual(
    result.nodes.map(({ value }) => value),
    ["🚀 Bonjour, ", "", "monde"],
  );
  assert.deepEqual(result.changes, [{
    id: "c0",
    segmentIndex: 0,
    segmentId: "left",
    start: 11,
    end: 11,
    expected: "",
    replacement: " ",
    ruleIds: ["punctuation.comma.space-after"],
  }]);
});

Deno.test("cross-segment comma spacing preserves decimals and URIs", () => {
  for (
    const nodes of [
      [{ id: "left", value: "1," }, { id: "right", value: "5" }],
      [
        { id: "left", value: "https://example.test/a," },
        { id: "right", value: "b" },
      ],
      [{ id: "left", value: "/tmp/a," }, { id: "right", value: "b" }],
    ] as const
  ) {
    const result = runTextNodePipeline(
      nodes,
      IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
      { locale: "fr-FR", mode: "fix" },
    );
    assert.deepEqual(result.nodes, nodes);
    assert.deepEqual(result.changes, []);
  }
});

Deno.test("the Imprimerie nationale comma rule is idempotent", () => {
  const first = runPipeline("Bonjour,monde.", IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
  });
  const second = runPipeline(first.value, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
  });

  assert.equal(first.value, "Bonjour, monde.");
  assert.equal(second.value, first.value);
  assert.deepEqual(second.diagnostics, []);
});

Deno.test("the comma spacing rule is scoped to metropolitan French", () => {
  assertCode(() =>
    runPipeline("Bonjour,monde.", [SPACE_AFTER_COMMA_RULE], {
      locale: "fr-CA",
    }), "UNSUPPORTED_LOCALE");
});
