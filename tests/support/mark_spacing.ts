import assert from "node:assert/strict";
import {
  IMPRIMERIE_NATIONALE_RULES,
  runPipeline,
  runTextNodePipeline,
} from "../../src/mod.ts";

/**
 * One case of a mark-spacing rule (docs/conception-ecriture-regles-v0.1.md,
 * §8): the input, as text or text nodes, and either the message IDs that the
 * rule reports in `lint` mode and the value it gives in `fix` mode, or no
 * diagnostic at all.
 */
export interface MarkSpacingCase {
  readonly input:
    | string
    | readonly { id: string; value: string; protected?: boolean }[];
  /** Message IDs reported by the rule; empty when the rule stays silent. */
  readonly messageIds: readonly string[];
  /** Value of the whole preset in `fix` mode, when checked. */
  readonly fixed?: string;
}

function run(input: MarkSpacingCase["input"], mode: "lint" | "fix") {
  const options = { locale: "fr-FR", mode } as const;
  return typeof input === "string"
    ? runPipeline(input, IMPRIMERIE_NATIONALE_RULES, options)
    : runTextNodePipeline(input, IMPRIMERIE_NATIONALE_RULES, options);
}

/**
 * Checks the cases of one rule within the Imprimerie nationale preset, and the
 * idempotence of its corrections.
 */
export function assertMarkSpacingCases(
  ruleId: string,
  cases: readonly MarkSpacingCase[],
): void {
  for (const { input, messageIds, fixed } of cases) {
    const label = JSON.stringify(input);
    const reported = run(input, "lint").diagnostics
      .filter((diagnostic) => diagnostic.ruleId === ruleId)
      .map(({ messageId }) => messageId);
    assert.deepEqual(reported, messageIds, label);
    const result = run(input, "fix");
    if (fixed !== undefined) assert.equal(result.value, fixed, label);
    assert.deepEqual(run(result.value, "fix").changes, [], `${label} again`);
  }
}
