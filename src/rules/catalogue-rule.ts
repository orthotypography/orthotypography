import { OrthotypographyError } from "../errors.ts";
import { RULES } from "../catalogue/rules.ts";
import type { LogicalRun, RuleResult, RuntimeRule } from "../model.ts";

/**
 * Builds a built-in executable rule from its catalogue entry, which is the only
 * source of its phase, locales, default mode, dependencies, and annotation
 * kinds.
 */
export function catalogueRule(
  id: string,
  apply: (run: LogicalRun) => RuleResult,
): RuntimeRule {
  const definition = RULES.find((rule) => rule.id === id);
  if (definition === undefined) {
    throw new OrthotypographyError(
      "CATALOGUE_INCONSISTENCY",
      `Missing documentary rule: ${id}`,
      { ruleId: id },
    );
  }
  return Object.freeze({
    id,
    phase: definition.phase,
    locales: definition.locales,
    defaultMode: definition.defaultMode,
    ...(definition.dependsOn === undefined
      ? {}
      : { dependsOn: definition.dependsOn }),
    ...(definition.provides === undefined
      ? {}
      : { provides: definition.provides }),
    ...(definition.requires === undefined
      ? {}
      : { requires: definition.requires }),
    apply,
  });
}
