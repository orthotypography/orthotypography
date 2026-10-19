import assert from "node:assert/strict";
import {
  IMPRIMERIE_NATIONALE_RULES,
  runPipeline,
  runTextNodePipeline,
} from "../src/mod.ts";
import type { PipelineResult, RuntimeRule } from "../src/model.ts";
import { testRule } from "./support/rules.ts";

/** Appends `!` once, as a rule whose default mode is `fix`. */
const bang = testRule("x-test.bang", (run) =>
  run.text.endsWith("!") ? {} : {
    edits: [{ start: run.text.length, end: run.text.length, replacement: "!" }],
  });

/** Prepends `>` once, as a rule whose default mode is `lint`. */
const quote = testRule(
  "x-test.quote",
  (run) =>
    run.text.startsWith(">") ? {} : {
      edits: [{ start: 0, end: 0, replacement: ">" }],
    },
  { defaultMode: "lint" },
);

/** Doubles a final `!`, refining the output of `bang`. */
const twice = testRule(
  "x-test.twice",
  (run) =>
    !run.text.endsWith("!") || run.text.endsWith("!!") ? {} : {
      edits: [{
        start: run.text.length - 1,
        end: run.text.length,
        replacement: "!!",
      }],
    },
  { phase: "cleanup" },
);

function summary(result: PipelineResult) {
  return result.diagnostics.map((
    { ruleId, start, end, groupId, changeIds, suggested, dismissed },
  ) => ({ ruleId, start, end, groupId, changeIds, suggested, dismissed }));
}

/** Result without the review-only hints. */
function withoutHints(result: PipelineResult): unknown {
  return JSON.parse(
    JSON.stringify(
      result,
      (key, value) => key === "suggested" ? undefined : value,
    ),
  );
}

Deno.test("review mode applies every rule and reports default modes as hints", () => {
  const rules: RuntimeRule[] = [bang, quote];
  const review = runPipeline("texte", rules, {
    locale: "fr-FR",
    mode: "review",
  });
  assert.equal(review.value, ">texte!");
  assert.deepEqual(summary(review), [
    {
      ruleId: "x-test.bang",
      start: 5,
      end: 5,
      groupId: "g0",
      changeIds: ["c1"],
      suggested: "apply",
      dismissed: undefined,
    },
    {
      ruleId: "x-test.quote",
      start: 0,
      end: 0,
      groupId: "g1",
      changeIds: ["c0"],
      suggested: "review",
      dismissed: undefined,
    },
  ]);
  assert.deepEqual(
    review.groups.map(({ id, suggested }) => [id, suggested]),
    [["g0", true], ["g1", false]],
  );

  // Without the hints, review mode is fix mode.
  const fix = runPipeline("texte", rules, { locale: "fr-FR", mode: "fix" });
  assert.deepEqual(withoutHints(review), fix);
  assert.ok(fix.diagnostics.every(({ suggested }) => suggested === undefined));
  assert.ok(fix.groups.every(({ suggested }) => suggested === undefined));

  // The default mode applies only the rules whose default mode is fix.
  const byDefault = runPipeline("texte", rules, { locale: "fr-FR" });
  assert.equal(byDefault.value, "texte!");
});

Deno.test("a group is suggested only when all its proposals are", () => {
  const lintTwice = { ...twice, defaultMode: "lint" as const };
  const result = runPipeline("texte", [bang, lintTwice], {
    locale: "fr-FR",
    mode: "review",
  });
  assert.equal(result.value, "texte!!");
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].suggested, false);
  assert.deepEqual(
    result.diagnostics.map(({ suggested }) => suggested),
    ["apply", "review"],
  );
});

Deno.test("built-in rules keep their hints in review mode", () => {
  const input = "Il paie 25€ ; merci.";
  const review = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    mode: "review",
  });
  const euro = review.diagnostics.find(({ ruleId }) =>
    ruleId === "number.euro.nbsp-before"
  );
  const semicolon = review.diagnostics.find(({ ruleId }) =>
    ruleId === "punctuation.semicolon.nnbsp-before"
  );
  assert.equal(euro?.suggested, "review");
  assert.equal(semicolon?.suggested, "apply");
  assert.equal(review.value, "Il paie 25 € ; merci.");
});

Deno.test("dismissed proposals are reported but not applied", () => {
  const rules: RuntimeRule[] = [bang, quote, twice];
  const first = runPipeline("texte", rules, {
    locale: "fr-FR",
    mode: "review",
  });
  assert.equal(first.value, ">texte!!");

  // Dismissing the `!` proposal also removes the refinement that needed it.
  const bangDiagnostic = first.diagnostics[0];
  assert.equal(bangDiagnostic.ruleId, "x-test.bang");
  const second = runPipeline("texte", rules, {
    locale: "fr-FR",
    mode: "review",
    dismissed: [{
      ruleId: bangDiagnostic.ruleId,
      segmentIndex: bangDiagnostic.segmentIndex,
      start: bangDiagnostic.start,
      end: bangDiagnostic.end,
    }],
  });
  assert.equal(second.value, ">texte");
  assert.deepEqual(summary(second), [
    {
      ruleId: "x-test.bang",
      start: 5,
      end: 5,
      groupId: undefined,
      changeIds: undefined,
      suggested: undefined,
      dismissed: true,
    },
    {
      ruleId: "x-test.quote",
      start: 0,
      end: 0,
      groupId: "g0",
      changeIds: ["c0"],
      suggested: "review",
      dismissed: undefined,
    },
  ]);
  assert.equal(second.changes.length, 1);
  assert.deepEqual(second.groups.map(({ diagnostics }) => diagnostics), [[1]]);
});

Deno.test("dismissal matches the rule, the segment, and the source range", () => {
  const nodes = [
    { id: "a", value: "un" },
    { id: "b", value: "deux" },
  ];
  const run = (
    dismissed: Parameters<typeof runTextNodePipeline>[2]["dismissed"],
  ) =>
    runTextNodePipeline(nodes, [bang], {
      locale: "fr-FR",
      mode: "fix",
      ...(dismissed === undefined ? {} : { dismissed }),
    }).value;
  assert.equal(run(undefined), "undeux!");
  assert.equal(
    run([{ ruleId: "x-test.bang", segmentId: "b", start: 4, end: 4 }]),
    "undeux",
  );
  assert.equal(
    run([{ ruleId: "x-test.bang", segmentIndex: 1, start: 4, end: 4 }]),
    "undeux",
  );
  // Another rule, segment, or range does not match.
  assert.equal(
    run([{ ruleId: "x-test.quote", segmentId: "b", start: 4, end: 4 }]),
    "undeux!",
  );
  assert.equal(
    run([{ ruleId: "x-test.bang", segmentId: "a", start: 4, end: 4 }]),
    "undeux!",
  );
  assert.equal(
    run([{ ruleId: "x-test.bang", segmentId: "b", start: 3, end: 4 }]),
    "undeux!",
  );
});

Deno.test("dismissal applies in every mode and rejects incomplete entries", () => {
  const dismissed = [{
    ruleId: "x-test.bang",
    segmentIndex: 0,
    start: 5,
    end: 5,
  }];
  for (const mode of [undefined, "fix", "lint", "review"] as const) {
    const result = runPipeline("texte", [bang], {
      locale: "fr-FR",
      ...(mode === undefined ? {} : { mode }),
      dismissed,
    });
    assert.equal(result.value, "texte");
    assert.equal(result.diagnostics[0].dismissed, true);
    assert.deepEqual(result.groups, []);
  }
  assert.throws(
    () =>
      runPipeline("texte", [bang], {
        locale: "fr-FR",
        dismissed: [{ ruleId: "x-test.bang", start: 5, end: 5 }],
      }),
    /without segmentId or segmentIndex/,
  );
  assert.throws(
    () =>
      runPipeline("texte", [bang], {
        locale: "fr-FR",
        dismissed: [{
          ruleId: "x-test.bang",
          segmentIndex: 0,
          start: 5,
          end: 4,
        }],
      }),
    /Invalid dismissed proposal/,
  );
});

Deno.test("dismissed proposals are still validated", () => {
  const overlapping = testRule("x-test.overlap", () => ({
    diagnostics: [
      {
        start: 0,
        end: 2,
        message: "x-test",
        edits: [{ start: 0, end: 2, replacement: "" }],
      },
      {
        start: 1,
        end: 3,
        message: "x-test",
        edits: [{ start: 1, end: 3, replacement: "" }],
      },
    ],
  }));
  assert.throws(
    () =>
      runPipeline("texte", [overlapping], {
        locale: "fr-FR",
        mode: "fix",
        dismissed: [{
          ruleId: "x-test.overlap",
          segmentIndex: 0,
          start: 0,
          end: 2,
        }],
      }),
    /overlapping edits/,
  );
});
