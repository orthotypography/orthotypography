import assert from "node:assert/strict";
import {
  applyTextChanges,
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  runPipeline,
  runTextNodePipeline,
  type TextChange,
} from "../src/mod.ts";

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

  assert.throws(
    () => applyTextChanges([{ id: "node", value: "axc" }], [change]),
    Error,
    "Stale change",
  );
  assert.throws(
    () => applyTextChanges([{ id: "other", value: "abc" }], [change]),
    Error,
    "does not match",
  );
  assert.throws(
    () =>
      applyTextChanges(
        [{ id: "node", value: "abc", protected: true }],
        [change],
      ),
    Error,
    "protected segment",
  );
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

  assert.throws(
    () => applyTextChanges("abc", [{ ...base, end: 4 }]),
    Error,
    "Invalid change range",
  );
  assert.throws(
    () =>
      applyTextChanges("abc", [
        { ...base, end: 2, expected: "ab" },
        { ...base, start: 1, end: 2, expected: "b" },
      ]),
    Error,
    "Overlapping changes",
  );
});
