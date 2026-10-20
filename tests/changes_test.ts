import assert from "node:assert/strict";
import {
  applyTextChanges,
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  runPipeline,
  runTextNodePipeline,
  type TextChange,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";

Deno.test("text changes reconstruct a string pipeline result", () => {
  const source = "Bonjour , monde !";
  const result = runPipeline(
    source,
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR", mode: "fix" },
  );

  assert.equal(applyTextChanges(source, result.changes), result.value);
});

Deno.test("text changes reconstruct multiple source segments", () => {
  const source = [
    { id: "plain", value: "Bonjour " },
    { id: "emphasis", value: ", monde " },
    { id: "plain-end", value: "!" },
  ];
  const result = runTextNodePipeline(
    source,
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR", mode: "fix" },
  );

  const applied = applyTextChanges(source, result.changes);
  assert.deepEqual(
    applied.map(({ value }) => value),
    result.nodes.map(({ value }) => value),
  );
});

Deno.test("text changes reject stale, mismatched, and protected sources", () => {
  const change: TextChange = {
    id: "c0",
    segmentIndex: 0,
    segmentId: "node",
    start: 1,
    end: 2,
    expected: "b",
    replacement: "B",
    ruleIds: ["test"],
  };

  assertCode(
    () => applyTextChanges([{ id: "node", value: "axc" }], [change]),
    "STALE_CHANGE",
  );
  assertCode(
    () => applyTextChanges([{ id: "other", value: "abc" }], [change]),
    "INVALID_CHANGE",
  );
  assertCode(() =>
    applyTextChanges(
      [{ id: "node", value: "abc", protected: true }],
      [change],
    ), "INVALID_CHANGE");
});

Deno.test("text changes reject invalid ranges and overlaps", () => {
  const base = {
    id: "c0",
    segmentIndex: 0,
    start: 0,
    end: 1,
    expected: "a",
    replacement: "A",
    ruleIds: ["test"],
  } satisfies TextChange;

  assertCode(
    () => applyTextChanges("abc", [{ ...base, end: 4 }]),
    "INVALID_CHANGE",
  );
  assertCode(() =>
    applyTextChanges("abc", [
      { ...base, end: 2, expected: "ab" },
      { ...base, start: 1, end: 2, expected: "b" },
    ]), "INVALID_CHANGE");
});

Deno.test("many changes in one segment apply in order", () => {
  // Issue #80: changes are assembled in one pass, in any input order.
  const count = 20_000;
  const source = "abcdef".repeat(count);
  const changes = Array.from({ length: count }, (_, index) => ({
    segmentIndex: 0,
    start: 6 * index + 1,
    end: 6 * index + 3,
    expected: "bc",
    replacement: index % 2 === 0 ? "" : "BCX",
    ruleIds: ["test"],
  })).reverse();
  const expected = Array.from(
    { length: count },
    (_, index) => `a${index % 2 === 0 ? "" : "BCX"}def`,
  ).join("");
  assert.equal(applyTextChanges(source, changes), expected);

  // An insertion and a replacement next to it keep their order.
  assert.equal(
    applyTextChanges("abc", [
      {
        segmentIndex: 0,
        start: 1,
        end: 2,
        expected: "b",
        replacement: "B",
        ruleIds: ["test"],
      },
      {
        segmentIndex: 0,
        start: 0,
        end: 0,
        expected: "",
        replacement: "<",
        ruleIds: ["test"],
      },
      {
        segmentIndex: 0,
        start: 3,
        end: 3,
        expected: "",
        replacement: ">",
        ruleIds: ["test"],
      },
    ]),
    "<aBc>",
  );
});
