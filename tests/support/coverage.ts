import { RULES } from "../../src/catalogue/rules.ts";

/**
 * Declares that the calling test covers a rule, or some of its documented
 * exceptions. Call it with literal arguments: `scripts/coverage_matrix.ts` and
 * `tests/coverage_test.ts` read these calls from the test sources. Unknown
 * rules or exceptions throw, so that a typo fails the test.
 */
export function covers(
  ruleId: string,
  exceptionIds: readonly string[] = [],
): void {
  const rule = RULES.find(({ id }) => id === ruleId);
  if (rule === undefined) throw new Error(`covers: unknown rule ${ruleId}`);
  for (const exceptionId of exceptionIds) {
    if (!rule.exceptions.some(({ id }) => id === exceptionId)) {
      throw new Error(`covers: rule ${ruleId} has no exception ${exceptionId}`);
    }
  }
}
