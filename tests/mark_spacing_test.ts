import { RULES } from "../src/catalogue/rules.ts";
import { checkExclusions } from "../src/rules/authoring/mark-spacing.ts";
import type { RuleDefinition } from "../src/model.ts";
import { assertCode } from "./support/errors.ts";
import { covers } from "./support/coverage.ts";
import { assertMarkSpacingCases } from "./support/mark_spacing.ts";

// Issue #82: rules that set the spacing next to a mark are declared with
// exclusions keyed by the exceptions of their catalogue entry
// (docs/conception-ecriture-regles-v0.1.md).

const colonBefore = RULES.find(({ id }) =>
  id === "punctuation.colon.nbsp-before"
) as RuleDefinition;

Deno.test("exclusions must match the exceptions of the catalogue entry", () => {
  const skip = { skip: () => false };
  const exclusions = Object.fromEntries(
    colonBefore.exceptions.map(({ id }) => [id, skip]),
  );
  const spec = { id: colonBefore.id, exclusions };
  checkExclusions(spec, colonBefore);

  // An exclusion that names no exception of the entry.
  assertCode(
    () =>
      checkExclusions({
        ...spec,
        exclusions: { ...exclusions, "x-unknown": skip },
      }, colonBefore),
    "CATALOGUE_INCONSISTENCY",
  );
  // An exception that the core detects but no exclusion implements.
  const { uri: _uri, ...withoutUri } = exclusions;
  assertCode(
    () => checkExclusions({ ...spec, exclusions: withoutUri }, colonBefore),
    "CATALOGUE_INCONSISTENCY",
  );
  // Exceptions ensured by the integration need no exclusion.
  const semicolonBefore = RULES.find(({ id }) =>
    id === "punctuation.semicolon.nnbsp-before"
  ) as RuleDefinition;
  checkExclusions({
    id: semicolonBefore.id,
    exclusions: Object.fromEntries(
      semicolonBefore.exceptions.filter(({ scope }) => scope === undefined)
        .map(({ id }) => [id, skip]),
    ),
  }, semicolonBefore);
});

Deno.test("a classification named by an exclusion must be a dependency", () => {
  const exclusions = Object.fromEntries(
    colonBefore.exceptions.map(({ id }) => [id, { skip: () => false }]),
  );
  const ensured = {
    ...exclusions,
    time: { ensuredBy: "classification:numeric" as const },
  };
  checkExclusions({ id: colonBefore.id, exclusions: ensured }, colonBefore);
  assertCode(
    () =>
      checkExclusions(
        { id: colonBefore.id, exclusions: ensured },
        { ...colonBefore, dependsOn: [] },
      ),
    "CATALOGUE_INCONSISTENCY",
  );
});

Deno.test("high punctuation at the start of the text keeps its spacing", () => {
  covers("punctuation.colon.nbsp-before", ["start-of-text"]);
  covers("punctuation.semicolon.nnbsp-before", ["start-of-text"]);
  covers("punctuation.question.nnbsp-before", ["start-of-text"]);
  covers("punctuation.exclamation.nnbsp-before", ["start-of-text"]);
  covers("punctuation.colon.space-after", ["start-of-text"]);
  covers("punctuation.semicolon.space-after", ["start-of-text"]);
  covers("punctuation.question.space-after", ["start-of-text"]);
  covers("punctuation.exclamation.space-after", ["start-of-text"]);
  for (const mark of [":", ";", "?", "!"]) {
    for (const input of [`${mark}suite`, `${mark}  suite`, `  ${mark}suite`]) {
      for (
        const ruleId of RULES.filter(({ id }) =>
          id.startsWith("punctuation.") &&
          (id.endsWith("-before") || id.endsWith(".space-after")) &&
          !id.includes("comma") && !id.includes("period") &&
          !id.includes("ellipsis")
        ).map(({ id }) => id)
      ) {
        assertMarkSpacingCases(ruleId, [{ input, messageIds: [] }]);
      }
    }
  }
  // Once a word precedes the mark, both spaces are set.
  assertMarkSpacingCases("punctuation.colon.nbsp-before", [
    { input: "Note: suite", messageIds: ["spacing.missing-before"] },
  ]);
  assertMarkSpacingCases("punctuation.colon.space-after", [
    {
      input: "Note:suite",
      messageIds: ["spacing.missing-after"],
      fixed: "Note : suite",
    },
  ]);
});

Deno.test("technical syntax keeps the spacing before colons and exclamation marks", () => {
  covers("punctuation.colon.nbsp-before", ["technical-syntax"]);
  covers("punctuation.exclamation.nnbsp-before", ["technical-syntax"]);
  assertMarkSpacingCases("punctuation.colon.nbsp-before", [
    { input: "std::vector", messageIds: [], fixed: "std::vector" },
    { input: "a :: b", messageIds: [], fixed: "a :: b" },
  ]);
  assertMarkSpacingCases("punctuation.exclamation.nnbsp-before", [
    {
      input: "color: red !important;",
      messageIds: [],
    },
    { input: "a!important", messageIds: [], fixed: "a!important" },
    // Elsewhere, the exclamation mark takes its space.
    {
      input: "Important!",
      messageIds: ["spacing.missing-before"],
      fixed: "Important !",
    },
  ]);
});

Deno.test("an adjacent mark of higher rank governs the spacing between them", () => {
  covers("punctuation.colon.nbsp-before", ["adjacent-punctuation"]);
  covers("punctuation.semicolon.nnbsp-before", ["adjacent-punctuation"]);
  assertMarkSpacingCases("punctuation.colon.nbsp-before", [
    { input: "Quoi ?: oui", messageIds: [] },
    { input: "Oui ;: non", messageIds: [] },
  ]);
  assertMarkSpacingCases("punctuation.semicolon.nnbsp-before", [
    { input: "Quoi ?; oui", messageIds: [] },
    { input: "Oui ;; non", messageIds: [], fixed: "Oui ;; non" },
  ]);
  // A higher mark that its own exclusions leave as is governs nothing.
  assertMarkSpacingCases("punctuation.colon.nbsp-before", [
    { input: "Vrai ?!: oui", messageIds: ["spacing.missing-before"] },
  ]);
});
