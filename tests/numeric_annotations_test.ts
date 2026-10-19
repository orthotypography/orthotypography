import assert from "node:assert/strict";
import {
  applyTextChanges,
  DIGIT_GROUPING_RULE,
  EURO_SPACING_RULE,
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  NUMERIC_PROTECTION_RULE,
  PERCENTAGE_SPACING_RULE,
  runTextNodePipeline,
  SAFE_PUNCTUATION_RULES,
  UNIT_SPACING_RULE,
} from "../src/mod.ts";
import type { TextSegment } from "../src/model.ts";
import type { Annotation, LogicalRun } from "../src/model.ts";
import { testRule } from "./support/rules.ts";
import { covers } from "./support/coverage.ts";

function fixNodes(values: readonly (string | TextSegment)[]): string[] {
  const nodes = values.map((value, index) => ({
    id: `n${index}`,
    ...(typeof value === "string" ? { value } : value),
  }));
  return runTextNodePipeline(nodes, IMPRIMERIE_NATIONALE_PUNCTUATION_RULES, {
    locale: "fr-FR",
    mode: "fix",
  }).nodes.map(({ value }) => value);
}

Deno.test("numeric contexts split across text nodes are protected", () => {
  // Before the logical run, each node was classified alone: `10` and `:30`
  // were not a time, and colon spacing turned them into `10 : 30`.
  assert.deepEqual(fixNodes(["Rendez-vous à 10", ":30 demain"]), [
    "Rendez-vous à 10",
    ":30 demain",
  ]);
  assert.deepEqual(fixNodes(["Ratio 3 ", ": 4"]), ["Ratio 3 ", ": 4"]);
});

Deno.test("protected nodes still separate numeric contexts", () => {
  assert.deepEqual(fixNodes(["10", { value: "x", protected: true }, ":30"]), [
    "10",
    "x",
    " : 30",
  ]);
});

/** Records the numeric annotations a later rule sees. */
function observer(seen: Annotation[][]) {
  return testRule(
    "x-test.observe-numeric",
    (run: LogicalRun) => {
      seen.push([...run.annotations("numeric")]);
      return {};
    },
    {
      phase: "numeric-spacing",
      requires: ["numeric"],
    },
  );
}

Deno.test("numeric annotations carry kind and disposition", () => {
  covers("classify.numeric-constructs");
  const seen: Annotation[][] = [];
  runTextNodePipeline(
    [{ id: "a", value: "À 10" }, { id: "b", value: ":30, 25 % en plus" }],
    [NUMERIC_PROTECTION_RULE, observer(seen)],
    { locale: "fr-FR", mode: "lint" },
  );
  assert.deepEqual(
    seen[0].map(({ start, end, protect, data }) => ({
      start,
      end,
      protect,
      data,
    })),
    [
      {
        start: 2,
        end: 7,
        protect: true,
        data: { kind: "time", disposition: "protect" },
      },
      {
        start: 9,
        end: 13,
        protect: undefined,
        data: { kind: "percentage", disposition: "target" },
      },
    ],
  );
});

Deno.test("numeric annotations follow earlier edits", () => {
  const seen: Annotation[][] = [];
  const result = runTextNodePipeline(
    [{ id: "a", value: "Oui , à 10" }, { id: "b", value: ":30 , 25 %" }],
    [NUMERIC_PROTECTION_RULE, ...SAFE_PUNCTUATION_RULES, observer(seen)],
    { locale: "fr-FR", mode: "fix" },
  );
  const text = result.nodes.map(({ value }) => value).join("");
  assert.equal(text, "Oui, à 10:30, 25 %");
  assert.deepEqual(
    seen[0].map(({ start, end }) => text.slice(start, end)),
    ["10:30", "25 %"],
  );
});

function numericNodes(values: readonly string[], mode: "fix" | "lint") {
  const nodes = values.map((value, index) => ({ id: `n${index}`, value }));
  const result = runTextNodePipeline(nodes, [
    NUMERIC_PROTECTION_RULE,
    PERCENTAGE_SPACING_RULE,
    UNIT_SPACING_RULE,
    EURO_SPACING_RULE,
    DIGIT_GROUPING_RULE,
  ], { locale: "fr-FR", mode });
  assert.deepEqual(
    applyTextChanges(nodes, result.changes).map(({ value }) => value),
    result.nodes.map(({ value }) => value),
  );
  return result;
}

const valuesOf = (values: readonly string[]) =>
  numericNodes(values, "fix").nodes.map(({ value }) => value);

Deno.test("split numeric constructs keep the space in the symbol's node", () => {
  assert.deepEqual(valuesOf(["de 3,5", "% en un an"]), [
    "de 3,5",
    " % en un an",
  ]);
  assert.deepEqual(valuesOf(["environ 465 ", "km"]), [
    "environ 465",
    " km",
  ]);
  assert.deepEqual(valuesOf(["10 ", " %"]), ["10", " %"]);
  assert.deepEqual(valuesOf(["vaut 1 ", "200 € par an"]), [
    "vaut 1 ",
    "200 € par an",
  ]);
});

Deno.test("a split leading euro sign moves into the amount's node", () => {
  assert.deepEqual(valuesOf(["prix ", "€", " 10"]), [
    "prix ",
    "",
    "10 €",
  ]);
});

Deno.test("split numeric diagnostics report every part", () => {
  const { diagnostics } = numericNodes(["12", "3", "4 €"], "lint");
  assert.deepEqual(
    diagnostics.map((
      { ruleId, segmentId, start, end, related, replacement },
    ) => ({
      ruleId,
      at: [segmentId, start, end],
      related: related?.map(({ segmentId, start, end }) => [
        segmentId,
        start,
        end,
      ]),
      replacement,
    })),
    [
      {
        ruleId: "number.euro.nbsp-before",
        at: ["n0", 0, 2],
        related: [["n1", 0, 1], ["n2", 0, 3]],
        replacement: undefined,
      },
      {
        ruleId: "number.digits.grouping",
        at: ["n0", 0, 2],
        related: [["n1", 0, 1], ["n2", 0, 1]],
        replacement: undefined,
      },
    ],
  );
});

Deno.test("numeric rules give the same text for split and joined input", () => {
  for (
    const values of [
      ["Il mesure 4,5", " m et coûte ", "€", "12 000."],
      ["Hausse de 3", ",5", " %", " sur 1 2", "00 km"],
    ]
  ) {
    assert.equal(
      valuesOf(values).join(""),
      numericNodes([values.join("")], "fix").nodes[0].value,
    );
  }
});
