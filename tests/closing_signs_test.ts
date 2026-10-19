import assert from "node:assert/strict";
import {
  IMPRIMERIE_NATIONALE_RULES,
  runPipeline,
  runTextNodePipeline,
} from "../src/mod.ts";

// Regression tests for issue #54: the space after `?`, `!`, `:`, and `;` does
// not apply before a closing sign, which governs the space before it.
const nbsp = " ";
const nnbsp = " ";
const fix = { locale: "fr-FR", mode: "fix" } as const;

const cases: readonly (readonly [string, string])[] = [
  [
    "Il demande «Vraiment?» puis part.",
    `Il demande «${nbsp}Vraiment${nnbsp}?${nbsp}» puis part.`,
  ],
  [
    "Il crie « Partez ! » puis sort.",
    `Il crie «${nbsp}Partez${nnbsp}!${nbsp}» puis sort.`,
  ],
  ["« Oui : »", `«${nbsp}Oui${nbsp}:${nbsp}»`],
  ["(Oui ?)", `(Oui${nnbsp}?)`],
  ["[Oui !]", `[Oui${nnbsp}!]`],
  ["“Oui ;”", `“Oui${nnbsp};”`],
];

const afterRules = new Set([
  "punctuation.colon.space-after",
  "punctuation.semicolon.space-after",
  "punctuation.question.space-after",
  "punctuation.exclamation.space-after",
]);

Deno.test("high punctuation keeps the space set by a closing sign", () => {
  for (const [input, expected] of cases) {
    const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, fix);
    assert.equal(result.value, expected, input);
    assert.ok(
      result.changes.every(({ ruleIds }) =>
        ruleIds.every((ruleId) => !afterRules.has(ruleId))
      ),
      input,
    );
    const lint = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
      locale: "fr-FR",
      mode: "lint",
    });
    assert.ok(
      lint.diagnostics.every(({ ruleId }) => !afterRules.has(ruleId)),
      input,
    );
    // A second pass finds nothing left to correct.
    const again = runPipeline(result.value, IMPRIMERIE_NATIONALE_RULES, fix);
    assert.deepEqual(again.changes, [], input);
    assert.deepEqual(again.diagnostics, [], input);
  }
});

Deno.test("a closing sign in another node is recognized", () => {
  const guillemet = runTextNodePipeline(
    [
      { id: "quote", value: "« Partez !" },
      { id: "close", value: " »" },
      { id: "rest", value: " puis sort." },
    ],
    IMPRIMERIE_NATIONALE_RULES,
    fix,
  );
  assert.deepEqual(guillemet.nodes.map(({ value }) => value), [
    `«${nbsp}Partez${nnbsp}!`,
    `${nbsp}»`,
    " puis sort.",
  ]);
  assert.ok(
    guillemet.diagnostics.every(({ ruleId }) => !afterRules.has(ruleId)),
  );

  const parenthesis = runTextNodePipeline(
    [
      { id: "text", value: "(Oui ?" },
      { id: "close", value: ")" },
    ],
    IMPRIMERIE_NATIONALE_RULES,
    fix,
  );
  assert.equal(parenthesis.value, `(Oui${nnbsp}?)`);
});

Deno.test("the space after high punctuation still applies before text", () => {
  for (
    const [input, expected] of [
      ["Oui ?non", `Oui${nnbsp}? non`],
      ["Oui !«Non»", `Oui${nnbsp}! «${nbsp}Non${nbsp}»`],
      ["Voici :(a)", `Voici${nbsp}: (a)`],
    ] as const
  ) {
    assert.equal(
      runPipeline(input, IMPRIMERIE_NATIONALE_RULES, fix).value,
      expected,
      input,
    );
  }
});

// Issue #59: the space after high punctuation does not apply before a comma
// or a period either, which are « toujours collés au mot précédent ». The
// source does not describe a mark followed by suspension points: that spacing
// is reported, not corrected.
Deno.test("high punctuation leaves no space before a comma or a period", () => {
  for (
    const [input, expected] of [
      ["Oui ?, non", `Oui${nnbsp}?, non`],
      ["Qui ?,dit-il", `Qui${nnbsp}?, dit-il`],
      ["Oui !, dit-il.", `Oui${nnbsp}!, dit-il.`],
      ["Hein :, bon", `Hein${nbsp}:, bon`],
      ["Bon ;, bien", `Bon${nnbsp};, bien`],
      ["Vraiment ?. Non", `Vraiment${nnbsp}?. Non`],
    ] as const
  ) {
    const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, fix);
    assert.equal(result.value, expected, input);
    const lint = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
      locale: "fr-FR",
      mode: "lint",
    });
    assert.ok(
      lint.diagnostics.every(({ ruleId }) => !afterRules.has(ruleId)),
      input,
    );
    const again = runPipeline(result.value, IMPRIMERIE_NATIONALE_RULES, fix);
    assert.deepEqual(again.changes, [], input);
    assert.deepEqual(again.diagnostics, [], input);
  }

  const segmented = runTextNodePipeline(
    [
      { id: "question", value: "Oui ?" },
      { id: "comma", value: " , non" },
    ],
    IMPRIMERIE_NATIONALE_RULES,
    fix,
  );
  assert.equal(segmented.value, `Oui${nnbsp}?, non`);
  assert.ok(
    segmented.diagnostics.every(({ ruleId }) => !afterRules.has(ruleId)),
  );
});

Deno.test("suspension points after high punctuation are reported, not fixed", () => {
  for (
    const [input, start, end] of [
      ["Oui ?…", 5, 5],
      ["Oui ? …", 5, 6],
      ["Oui ? ...", 5, 6],
      ["Il dit :…", 8, 8],
    ] as const
  ) {
    const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, fix);
    const reported = result.diagnostics.filter(({ ruleId }) =>
      afterRules.has(ruleId)
    );
    assert.equal(reported.length, 1, input);
    assert.deepEqual(
      [reported[0].start, reported[0].end, reported[0].changeIds],
      [start, end, undefined],
      input,
    );
    assert.ok(
      result.changes.every(({ ruleIds }) =>
        ruleIds.every((ruleId) => !afterRules.has(ruleId))
      ),
      input,
    );
  }
});
