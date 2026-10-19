import assert from "node:assert/strict";
import {
  catalogue,
  compilePipeline,
  IMPRIMERIE_NATIONALE_RULES,
  runPipeline,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";
import type { RunEdit } from "../src/model.ts";
import { testRule } from "./support/rules.ts";
import {
  DIGIT_GROUPING_RULE,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
} from "../src/rules/mod.ts";

function applyChanges(
  source: string,
  changes: readonly {
    readonly start: number;
    readonly end: number;
    readonly expected: string;
    readonly replacement: string;
  }[],
): string {
  let result = source;
  for (
    const change of [...changes].sort((left, right) => right.start - left.start)
  ) {
    assert.equal(source.slice(change.start, change.end), change.expected);
    result = result.slice(0, change.start) + change.replacement +
      result.slice(change.end);
  }
  return result;
}

/** Collapses repeated spaces outside protected text. */
const cleanupRule = testRule("x-test.cleanup", (run) => {
  const edits: RunEdit[] = [];
  for (const match of run.text.matchAll(/ {2,}/g)) {
    const start = match.index;
    const end = start + match[0].length;
    if (
      run.protectedRanges.some((range) =>
        range.start < end && start < range.end
      )
    ) {
      continue;
    }
    edits.push({ start, end, replacement: " " });
  }
  return run.mode === "fix" ? { edits } : {};
}, { phase: "cleanup" });

Deno.test("the pipeline preserves protected segments", () => {
  const result = runPipeline(
    [
      { value: "Bonjour  monde" },
      { value: "  code  ", protected: true },
    ],
    [cleanupRule],
    { locale: "fr-FR" },
  );

  assert.equal(result.value, "Bonjour monde  code  ");
  assert.deepEqual(result.appliedRuleIds, ["x-test.cleanup"]);
  assert.deepEqual(result.changes, [{
    id: "c0",
    segmentIndex: 0,
    start: 7,
    end: 9,
    expected: "  ",
    replacement: " ",
    ruleIds: ["x-test.cleanup"],
  }]);
});

Deno.test("changes compose rule provenance in source coordinates", () => {
  const first = testRule(
    "x-test.expand",
    (run) =>
      run.mode === "fix"
        ? { edits: [{ start: 0, end: 1, replacement: "xy" }] }
        : {},
    { phase: "glyphs" },
  );
  const second = testRule(
    "x-test.refine",
    (run) =>
      run.mode === "fix"
        ? { edits: [{ start: 1, end: 2, replacement: "z" }] }
        : {},
    { phase: "cleanup" },
  );

  const result = runPipeline("a", [second, first], {
    locale: "fr-FR",
    mode: "fix",
  });

  assert.equal(result.value, "xz");
  assert.deepEqual(result.changes, [{
    id: "c0",
    segmentIndex: 0,
    start: 0,
    end: 1,
    expected: "a",
    replacement: "xz",
    ruleIds: ["x-test.expand", "x-test.refine"],
  }]);
  assert.equal(applyChanges("a", result.changes), result.value);
});

Deno.test("lint mode reports diagnostics without changes", () => {
  const result = runPipeline("a  b", [cleanupRule], {
    locale: "fr-FR",
    mode: "lint",
  });
  assert.equal(result.value, "a  b");
  assert.deepEqual(result.changes, []);
});

Deno.test("one rule may edit text across a node boundary", () => {
  const rule = testRule(
    "x-test.cross-node",
    () => ({ edits: [{ start: 1, end: 3, replacement: "" }] }),
  );
  const result = runPipeline(
    [{ id: "left", value: "a " }, { id: "right", value: " b" }],
    [rule],
    { locale: "fr-FR", mode: "fix" },
  );

  assert.equal(result.value, "ab");
  assert.deepEqual(
    result.changes.map(({ segmentId, start, end }) => [
      segmentId,
      start,
      end,
    ]),
    [["left", 1, 2], ["right", 0, 1]],
  );
});

Deno.test("rules cannot edit protected text", () => {
  const rule = testRule(
    "x-test.protected",
    () => ({ edits: [{ start: 0, end: 1, replacement: "x" }] }),
  );
  assertCode(() =>
    runPipeline(
      [{ value: "a", protected: true }, { value: "b" }],
      [rule],
      { locale: "fr-FR", mode: "fix" },
    ), "PROTECTED_TEXT_EDIT");
});

Deno.test("compiled pipelines reject duplicate rule IDs", () => {
  assertCode(
    () => compilePipeline([cleanupRule, cleanupRule]),
    "DUPLICATE_RULE",
  );
});

Deno.test("rule IDs are catalogue IDs or use the x- prefix", () => {
  assertCode(
    () => compilePipeline([testRule("custom.rule", () => ({}))]),
    "UNKNOWN_RULE_ID",
  );
  assertCode(() =>
    compilePipeline([
      testRule("x-test.phase", () => ({}), {
        phase: "unknown" as "cleanup",
      }),
    ]), "INVALID_RULE");
  assert.doesNotThrow(() => compilePipeline([cleanupRule]));
});

Deno.test("built-in rules take their metadata from the catalogue", () => {
  const rules = [
    ...IMPRIMERIE_NATIONALE_RULES,
    ELLIPSIS_GLYPH_RULE,
    ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
    DIGIT_GROUPING_RULE,
  ];
  for (const rule of rules) {
    const entry = catalogue.RULES.find(({ id }) => id === rule.id);
    assert.ok(entry, `catalogue entry for ${rule.id}`);
    assert.equal(rule.phase, entry.phase, rule.id);
    assert.deepEqual(rule.locales, entry.locales, rule.id);
    assert.equal(rule.defaultMode, entry.defaultMode, rule.id);
    assert.deepEqual(rule.dependsOn, entry.dependsOn, rule.id);
    assert.ok(Object.isFrozen(rule), rule.id);
  }
});

Deno.test("pipelines honor a rule's default mode", () => {
  const lintByDefault = testRule(
    "x-test.default-lint",
    (run) =>
      run.mode === "fix"
        ? {
          edits: [{
            start: 0,
            end: run.text.length,
            replacement: run.text.toUpperCase(),
          }],
        }
        : {},
    { defaultMode: "lint" },
  );

  assert.equal(
    runPipeline("texte", [lintByDefault], { locale: "fr-FR" }).value,
    "texte",
  );
  assert.equal(
    runPipeline("texte", [lintByDefault], {
      locale: "fr-FR",
      mode: "fix",
    }).value,
    "TEXTE",
  );
});

Deno.test("pipelines reject invalid annotation ranges", () => {
  const invalid = testRule(
    "x-test.invalid-annotation",
    (run) => ({
      annotations: [{
        kind: "x-test",
        start: 2,
        end: run.text.length + 1,
        protect: true,
      }],
    }),
    { phase: "classify" },
  );

  assertCode(
    () => runPipeline("texte", [invalid], { locale: "fr-FR" }),
    "INVALID_ANNOTATION",
  );
});

Deno.test("pipelines reject simultaneous transformation and protection", () => {
  const ambiguous = testRule(
    "x-test.ambiguous-protection",
    () => ({
      edits: [{ start: 0, end: 1, replacement: "x" }],
      annotations: [{ kind: "x-test", start: 1, end: 2, protect: true }],
    }),
    { phase: "classify" },
  );

  assertCode(
    () => runPipeline("text", [ambiguous], { locale: "fr-FR", mode: "fix" }),
    "TRANSFORM_AND_PROTECT",
  );
});

Deno.test("only classify rules may annotate", () => {
  const rule = testRule(
    "x-test.late-annotation",
    () => ({ annotations: [{ kind: "x-test", start: 0, end: 1 }] }),
  );
  assertCode(
    () => runPipeline("text", [rule], { locale: "fr-FR" }),
    "INVALID_ANNOTATION",
  );
});

Deno.test("source segment IDs must be unique and non-empty", () => {
  assertCode(() =>
    runPipeline(
      [{ id: "node", value: "a" }, { id: "node", value: "b" }],
      [],
      { locale: "fr-FR" },
    ), "INVALID_SEGMENT_ID");
  assertCode(
    () => runPipeline([{ id: "", value: "a" }], [], { locale: "fr-FR" }),
    "INVALID_SEGMENT_ID",
  );
});

Deno.test("lint mode reports proposals without applying them", () => {
  const upper = testRule(
    "x-test.upper",
    (run) => ({
      edits: [{
        start: 0,
        end: run.text.length,
        replacement: run.text.toUpperCase(),
      }],
    }),
  );

  const result = runPipeline("texte", [upper], {
    locale: "fr-FR",
    mode: "lint",
  });
  assert.equal(result.value, "texte");
  assert.deepEqual(result.changes, []);
  assert.equal(result.diagnostics.length, 1);
});

/** Reports fixed runtime ranges relative to a marker, without edits. */
function reporter(marker: string, ranges: readonly [number, number][]) {
  return testRule("x-test.report", (run) => {
    const at = run.text.indexOf(marker);
    if (at < 0) return {};
    return {
      diagnostics: ranges.map(([start, end]) => ({
        start: at + start,
        end: at + end,
        message: `${start}-${end}`,
      })),
    };
  }, { phase: "cleanup" });
}

function locations(
  input: string | { id?: string; value: string; protected?: boolean }[],
  rules: Parameters<typeof runPipeline>[1],
) {
  return runPipeline(input, rules, { locale: "fr-FR", mode: "fix" })
    .diagnostics
    .filter(({ ruleId }) => ruleId === "x-test.report")
    .map(({ segmentIndex, segmentValue, start, end }) => ({
      segmentIndex,
      segmentValue,
      start,
      end,
    }));
}

Deno.test("diagnostics on fixed text are widened to the source of the fix", () => {
  const insert = testRule("x-test.insert", (run) => ({
    edits: run.text.includes("XYZ")
      ? []
      : [{ start: 2, end: 2, replacement: "XYZ" }],
  }));
  // Runtime text: "abXYZcd"; ranges are relative to "XYZ" at 2.
  const rules = [
    insert,
    reporter("XYZ", [[1, 2], [-1, 2], [3, 3], [2, 4], [0, 0]]),
  ];
  assert.deepEqual(
    locations("abcd", rules).map(({ start, end }) => [start, end]),
    [
      // Inside the inserted text: the insertion point.
      [2, 2],
      // From unchanged text into the insertion: up to the insertion point.
      [1, 2],
      // Empty, right after the insertion: exact, before "c".
      [2, 2],
      // From the insertion into unchanged text: through "c".
      [2, 3],
      // Empty, right before the insertion: exact, after "b".
      [2, 2],
    ],
  );
});

Deno.test("diagnostics next to replaced or removed text keep exact positions", () => {
  const replace = testRule("x-test.replace", (run) => {
    const at = run.text.indexOf("bc");
    return {
      edits: at < 0 ? [] : [{ start: at, end: at + 2, replacement: "Q" }],
    };
  });
  // Runtime text: "aQd".
  assert.deepEqual(
    locations("abcd", [replace, reporter("Q", [[0, 1], [1, 1], [0, 0]])])
      .map(({ start, end }) => [start, end]),
    [[1, 3], [3, 3], [1, 1]],
  );

  const trim = testRule("x-test.trim", (run) => ({
    edits: run.text.endsWith(" ")
      ? [{ start: run.text.length - 1, end: run.text.length, replacement: "" }]
      : [],
  }));
  // Runtime text: "ab"; the position after "b" precedes the removed space.
  assert.deepEqual(
    locations("ab ", [trim, reporter("b", [[1, 1], [0, 1]])])
      .map(({ start, end }) => [start, end]),
    [[2, 2], [1, 2]],
  );
});

Deno.test("diagnostics name the input segment when protection splits it", () => {
  const protect = testRule(
    "x-test.protect",
    (run) => {
      const at = run.text.indexOf("1.2");
      return at < 0 ? {} : {
        annotations: [{
          kind: "x-test",
          start: at,
          end: at + 3,
          protect: true,
        }],
      };
    },
    { phase: "classify", provides: ["x-test"] },
  );
  const insert = testRule("x-test.insert-after", (run) => {
    const at = run.text.indexOf("1.2 ");
    return {
      edits: at < 0 ? [] : [{ start: at + 3, end: at + 4, replacement: "  " }],
    };
  });
  const input = [
    { id: "lead", value: "a " },
    { id: "mixed", value: "v1.2 b" },
  ];
  // Runtime text: "a v1.2  b", "mixed" split around the protected "1.2".
  assert.deepEqual(
    locations(input, [protect, insert, reporter("  b", [[1, 3]])]),
    [
      { segmentIndex: 1, segmentValue: "v1.2 b", start: 4, end: 6 },
    ],
  );
});
