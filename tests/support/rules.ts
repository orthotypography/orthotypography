import type {
  LogicalRun,
  RuleResult,
  RunEdit,
  RuntimeRule,
} from "../../src/model.ts";

/**
 * Result of a test rule. For brevity, tests may return bare `edits`; each one
 * becomes a diagnostic that carries it, located at its start.
 */
export type TestRuleResult = RuleResult & {
  readonly edits?: readonly RunEdit[];
};

/** Builds a test rule; its ID must use the `x-` prefix of external rules. */
export function testRule(
  id: string,
  apply: (run: LogicalRun) => TestRuleResult,
  options: Partial<
    Pick<
      RuntimeRule,
      | "phase"
      | "locales"
      | "defaultMode"
      | "dependsOn"
      | "provides"
      | "requires"
    >
  > = {},
): RuntimeRule {
  return {
    id,
    phase: "punctuation-spacing",
    locales: ["fr-FR"],
    defaultMode: "fix",
    ...options,
    apply(run) {
      const { edits, ...result } = apply(run);
      if (edits === undefined || edits.length === 0) return result;
      return {
        ...result,
        diagnostics: [
          ...(result.diagnostics ?? []),
          ...edits.map((edit) => ({
            start: edit.start,
            end: edit.start,
            ...(edit.bias === undefined ? {} : { bias: edit.bias }),
            message: "x-test",
            edits: [edit],
          })),
        ],
      };
    },
  };
}
