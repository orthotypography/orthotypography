import assert from "node:assert/strict";
import {
  DIGIT_GROUPING_RULE,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";

const groupingRules = [NUMERIC_PROTECTION_RULE, DIGIT_GROUPING_RULE] as const;

Deno.test("digit grouping diagnoses classified quantities only", () => {
  const input = "1234 kg; 12 345 kg; 12345%; 12345 CAD; €12345; 12345,6789 km";
  const result = runPipeline(input, groupingRules, {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(result.value, input);
  assert.equal(result.diagnostics.length, 6);
  assert.ok(
    result.diagnostics.every(({ replacement }) => replacement === undefined),
  );
});

Deno.test("digit grouping accepts both non-breaking separators", () => {
  const input =
    "1\u202f234 kg; 12\u00a0345 %; 74\u202f835,140\u00a071 km; 999 CAD; 12,345 kg";
  const result = runPipeline(input, groupingRules, {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(result.value, input);
  assert.deepEqual(result.diagnostics, []);
});

Deno.test("digit grouping preserves numbering and technical contexts", () => {
  const inputs = [
    "1961",
    "2026-09-12",
    "page 12345 kg",
    "article 12345 %",
    "matricule 12345 EUR",
    "version v1.2345",
    "version 1.2.3",
    "192.168.0.1",
    "ISBN 978-2743304829",
    "ABC-12345",
    "ref_12345",
    "https://example.test/items/12345",
    "12345",
  ];

  for (const input of inputs) {
    const result = runPipeline(input, groupingRules, {
      locale: "fr-FR",
      mode: "lint",
    });
    assert.deepEqual(result.diagnostics, [], input);
  }
});

Deno.test("digit grouping does not cross protected segments", () => {
  const input = [
    { id: "left", value: "12" },
    { id: "code", value: "345", protected: true },
    { id: "right", value: " kg" },
  ] as const;
  const result = runPipeline(input, groupingRules, {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(result.value, "12345 kg");
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.diagnostics, []);
});

Deno.test("digit grouping reports cross-segment UTF-16 locations", () => {
  const input = [
    { id: "left", value: "🚀 12" },
    { id: "digits", value: "345" },
    { id: "unit", value: " kg" },
  ] as const;
  const result = runPipeline(input, groupingRules, {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(result.value, "🚀 12345 kg");
  assert.deepEqual(result.changes, []);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => ({
      segmentId: diagnostic.segmentId,
      start: diagnostic.start,
      end: diagnostic.end,
      replacement: diagnostic.replacement,
      related: diagnostic.related?.map((location) => ({
        segmentId: location.segmentId,
        start: location.start,
        end: location.end,
      })),
    })),
    [{
      segmentId: "left",
      start: 3,
      end: 5,
      replacement: undefined,
      related: [{
        segmentId: "digits",
        start: 0,
        end: 3,
      }],
    }],
  );
});

Deno.test("digit grouping remains diagnostic in fix mode", () => {
  const input = "12345 kg";
  const result = runPipeline(input, groupingRules, {
    locale: "fr-FR",
    mode: "fix",
  });

  assert.equal(result.value, input);
  assert.deepEqual(result.changes, []);
  assert.equal(result.diagnostics.length, 1);
});

Deno.test("digit grouping requires numeric classification", () => {
  assertCode(() =>
    runPipeline("12345 kg", [DIGIT_GROUPING_RULE], {
      locale: "fr-FR",
      mode: "lint",
    }), "MISSING_DEPENDENCY");
});
