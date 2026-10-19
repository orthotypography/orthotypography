import assert from "node:assert/strict";
import {
  applyTextChanges,
  FRENCH_GUILLEMETS_SPACING_RULE,
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  runPipeline,
} from "../src/mod.ts";
import type { PipelineResult, RuntimeRule } from "../src/model.ts";
import { testRule } from "./support/rules.ts";

const fix = { locale: "fr-FR", mode: "fix" } as const;

/** Groups as lists of `ruleId@start-end` of their diagnostics. */
function groupsOf(result: PipelineResult): string[][] {
  return result.groups.map((group) =>
    group.diagnostics.map((index) => {
      const { ruleId, start, end } = result.diagnostics[index];
      return `${ruleId}@${start}-${end}`;
    })
  );
}

/** Inserts `XYZ` at position 2 once. */
const insert = testRule("x-test.insert", (run) => ({
  edits: run.text.includes("XYZ")
    ? []
    : [{ start: 2, end: 2, replacement: "XYZ" }],
}));

Deno.test("changes have result-unique IDs referenced by their proposals", () => {
  const result = runPipeline(
    "«Oui» et «Non»",
    [FRENCH_GUILLEMETS_SPACING_RULE],
    fix,
  );
  assert.deepEqual(result.changes.map(({ id }) => id), [
    "c0",
    "c1",
    "c2",
    "c3",
  ]);
  // Each guillemet space is an independent proposal in its own group.
  assert.deepEqual(
    result.groups.map(({ id, changeIds, diagnostics }) => ({
      id,
      changeIds,
      diagnostics,
    })),
    [
      { id: "g0", changeIds: ["c0"], diagnostics: [0] },
      { id: "g1", changeIds: ["c1"], diagnostics: [1] },
      { id: "g2", changeIds: ["c2"], diagnostics: [2] },
      { id: "g3", changeIds: ["c3"], diagnostics: [3] },
    ],
  );
  assert.deepEqual(
    result.diagnostics.map(({ groupId, changeIds }) => [groupId, changeIds]),
    [["g0", ["c0"]], ["g1", ["c1"]], ["g2", ["c2"]], ["g3", ["c3"]]],
  );
  // Accepting only the first group fixes only the first opening guillemet.
  assert.equal(
    applyTextChanges("«Oui» et «Non»", [result.changes[0]]),
    "«\u00a0Oui» et «Non»",
  );
});

Deno.test("edits refining earlier output join its group and change", () => {
  const refine = testRule("x-test.refine", (run) => {
    const at = run.text.indexOf("Y");
    return {
      edits: at < 0 ? [] : [{ start: at, end: at + 1, replacement: "y" }],
    };
  });
  const result = runPipeline("abcd", [insert, refine], fix);
  assert.equal(result.value, "abXyZcd");
  assert.equal(result.changes.length, 1);
  assert.deepEqual(result.changes[0].ruleIds, [
    "x-test.insert",
    "x-test.refine",
  ]);
  assert.deepEqual(groupsOf(result), [[
    "x-test.insert@2-2",
    "x-test.refine@2-2",
  ]]);
  assert.deepEqual(
    result.diagnostics.map(({ changeIds }) => changeIds),
    [["c0"], ["c0"]],
  );
});

Deno.test("edits combined inside one changed piece keep their proposals", () => {
  const replaceEach = (id: string, from: string, to: string) =>
    testRule(id, (run) => ({
      edits: [...run.text].flatMap((character, index) =>
        character === from
          ? [{ start: index, end: index + 1, replacement: to }]
          : []
      ),
    }));
  const result = runPipeline(
    "-aaaa-",
    [
      replaceEach("x-test.rewrite", "a", "b"),
      replaceEach("x-test.refine", "b", "c"),
    ],
    fix,
  );
  assert.equal(result.value, "-cccc-");
  assert.equal(result.changes.length, 1);
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].diagnostics, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(result.groups[0].changeIds, ["c0"]);
  assert.ok(
    result.diagnostics.every(({ groupId, changeIds }) =>
      groupId === "g0" && changeIds?.length === 1 && changeIds[0] === "c0"
    ),
  );
});

Deno.test("a proposal located on earlier output joins its group", () => {
  // The diagnostic designates the inserted text; the edit lies elsewhere.
  const follow = testRule("x-test.follow", (run) => {
    const at = run.text.indexOf("XYZ");
    if (at < 0 || run.text.endsWith("!")) return {};
    return {
      diagnostics: [{
        start: at,
        end: at + 3,
        message: "x-test",
        edits: [{
          start: run.text.length,
          end: run.text.length,
          replacement: "!",
        }],
      }],
    };
  });
  const result = runPipeline("abcd", [insert, follow], fix);
  assert.equal(result.value, "abXYZcd!");
  assert.deepEqual(result.changes.map(({ id, start }) => [id, start]), [
    ["c0", 2],
    ["c1", 4],
  ]);
  assert.deepEqual(groupsOf(result), [[
    "x-test.insert@2-2",
    "x-test.follow@2-2",
  ]]);
  assert.deepEqual(result.groups[0].changeIds, ["c0", "c1"]);
  assert.deepEqual(
    result.diagnostics.map(({ changeIds }) => changeIds),
    [["c0"], ["c1"]],
  );
});

Deno.test("proposals away from earlier output keep separate groups", () => {
  const far = testRule("x-test.far", (run) =>
    run.text.endsWith("!") ? {} : {
      edits: [{
        start: run.text.length,
        end: run.text.length,
        replacement: "!",
      }],
    });
  const result = runPipeline("abcdef", [insert, far], fix);
  assert.equal(result.value, "abXYZcdef!");
  assert.deepEqual(groupsOf(result), [
    ["x-test.insert@2-2"],
    ["x-test.far@6-6"],
  ]);
});

Deno.test("cancelling proposals form one group without changes", () => {
  // The quotes rule inserts a no-break space before the closing guillemet;
  // the space-after rule replaces it with a word space (issue #54). Both
  // proposals touch the same text, and the ordinary space they leave is the
  // source text, so the group has no change.
  const rules: RuntimeRule[] = [
    FRENCH_GUILLEMETS_SPACING_RULE,
    ...IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  ];
  const input = "« Partez ! »";
  const result = runPipeline(input, rules, fix);
  const closing = result.groups.find(({ diagnostics }) =>
    diagnostics.some((index) =>
      result.diagnostics[index].ruleId ===
        "punctuation.exclamation.space-after"
    )
  );
  assert.ok(closing);
  assert.deepEqual(closing.changeIds, []);
  assert.deepEqual(
    closing.diagnostics.map((index) => result.diagnostics[index].ruleId),
    ["quotes.french.nbsp-inner", "punctuation.exclamation.space-after"],
  );
  for (const index of closing.diagnostics) {
    assert.deepEqual(result.diagnostics[index].changeIds, []);
  }
});

Deno.test("only applied proposals belong to groups", () => {
  const lint = runPipeline("«Oui»", [FRENCH_GUILLEMETS_SPACING_RULE], {
    locale: "fr-FR",
    mode: "lint",
  });
  assert.deepEqual(lint.groups, []);
  assert.ok(lint.diagnostics.every(({ groupId }) => groupId === undefined));

  // In the default mode, proposals of a lint-mode rule are not applied.
  const reviewed = testRule(
    "x-test.reviewed",
    (run) =>
      run.text.startsWith("!") ? {} : {
        edits: [{ start: 0, end: 0, replacement: "!" }],
      },
    { defaultMode: "lint" },
  );
  const mixed = runPipeline(
    "«Oui»",
    [FRENCH_GUILLEMETS_SPACING_RULE, reviewed],
    {
      locale: "fr-FR",
    },
  );
  assert.equal(mixed.value, "«\u00a0Oui\u00a0»");
  assert.deepEqual(
    mixed.diagnostics.map(({ ruleId, groupId }) => [ruleId, groupId]),
    [
      ["quotes.french.nbsp-inner", "g0"],
      ["quotes.french.nbsp-inner", "g1"],
      ["x-test.reviewed", undefined],
    ],
  );

  // A diagnostic without edits is not a proposal.
  const note = testRule("x-test.note", () => ({
    diagnostics: [{ start: 0, end: 1, message: "x-test" }],
  }));
  const noted = runPipeline("ab", [note], fix);
  assert.deepEqual(noted.groups, []);
  assert.equal(noted.diagnostics[0].groupId, undefined);
});
