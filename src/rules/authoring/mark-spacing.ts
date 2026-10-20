import { OrthotypographyError } from "../../errors.ts";
import { RULES } from "../../catalogue/rules.ts";
import type {
  RuleDefinition,
  RunDiagnostic,
  RunEdit,
  RuntimeRule,
} from "../../model.ts";
import { catalogueRule } from "../catalogue-rule.ts";
import { diagnosticMessage } from "../../messages.ts";
import { RunScan, type Spacing } from "./scan.ts";

/*
 * Declarative form of the rules that set the spacing on one side of a mark
 * (docs/conception-ecriture-regles-v0.1.md, §5).
 */

type DiagnosticMessage = ReturnType<typeof diagnosticMessage>;

/** What a rule sees around one occurrence of its mark. */
export class MarkContext {
  #before?: Spacing;
  #after?: Spacing;

  constructor(
    readonly scan: RunScan,
    readonly mark: string,
    readonly index: number,
    readonly stretch: number,
  ) {}

  /** Spacing before the mark, read on demand. */
  get before(): Spacing {
    return this.#before ??= this.scan.spacing(
      this.index,
      this.stretch,
      "before",
    );
  }

  /** Spacing after the mark, read on demand. */
  get after(): Spacing {
    return this.#after ??= this.scan.spacing(
      this.index + this.mark.length,
      this.stretch,
      "after",
    );
  }
}

/**
 * Exclusion of one catalogue exception, keyed by its `RuleException.id`.
 *
 * - `skip` leaves the occurrence as is; a number resumes the scan there.
 * - `report` reports the occurrence without edit, with its own message.
 * - `expect` sets another expected spacing when it applies.
 * - `ensuredBy` names what ensures the exception before the rule runs:
 *   protected text, or the classification that provides an annotation kind.
 */
export type Exclusion =
  | { readonly skip: (context: MarkContext) => boolean | number }
  | {
    readonly report: (context: MarkContext) => boolean;
    readonly messageId: string;
  }
  | {
    readonly expect: (context: MarkContext) => boolean;
    readonly spacing: string;
  }
  | { readonly ensuredBy: "protection" | `classification:${string}` };

export interface MarkSpacingSpec {
  /** Catalogue entry, the only source of phase, locales, and dependencies. */
  readonly id: string;
  readonly mark: string;
  readonly side: "before" | "after";
  readonly expected: string;
  /**
   * Exclusions keyed by the exception IDs of the catalogue entry, evaluated in
   * declaration order; the first that applies decides.
   */
  readonly exclusions: Readonly<Record<string, Exclusion>>;
  /**
   * Range of the edit: the spacing only (default), or the spacing before the
   * mark and the mark itself, rewritten as the expected spacing and the mark.
   */
  readonly span?: "spacing" | "spacing-and-mark";
  /** Message of a proposal, from the spacing found and the one expected. */
  readonly message: (
    context: MarkContext,
    actual: string,
    expected: string,
  ) => DiagnosticMessage;
}

/**
 * Checks that the exclusions of a rule match the exceptions of its catalogue
 * entry: every key names an exception, every exception that the core detects
 * has a key, and a classification named by `ensuredBy` is a dependency.
 */
export function checkExclusions(
  spec: Pick<MarkSpacingSpec, "id" | "exclusions">,
  definition: RuleDefinition,
  rules: readonly RuleDefinition[] = RULES,
): void {
  const fail = (message: string, details: Record<string, unknown>) => {
    throw new OrthotypographyError(
      "CATALOGUE_INCONSISTENCY",
      `${spec.id}: ${message}`,
      { ruleId: spec.id, ...details },
    );
  };
  const exceptions = new Map(
    definition.exceptions.map((exception) => [exception.id, exception]),
  );
  for (const [id, exclusion] of Object.entries(spec.exclusions)) {
    if (!exceptions.has(id)) {
      fail(`exclusion ${id} is not an exception of the entry`, {
        exceptionId: id,
      });
    }
    if (
      "ensuredBy" in exclusion &&
      exclusion.ensuredBy.startsWith("classification:")
    ) {
      const kind = exclusion.ensuredBy.slice("classification:".length);
      const provided = (definition.requires ?? []).includes(kind) ||
        (definition.dependsOn ?? []).some((dependency) =>
          rules.find(({ id }) => id === dependency)?.provides?.includes(kind)
        );
      if (!provided) {
        fail(`exclusion ${id} relies on ${kind} without depending on it`, {
          exceptionId: id,
          kind,
        });
      }
    }
  }
  for (const exception of definition.exceptions) {
    if (exception.scope !== undefined) continue;
    if (!Object.hasOwn(spec.exclusions, exception.id)) {
      fail(`exception ${exception.id} has no exclusion`, {
        exceptionId: exception.id,
      });
    }
  }
}

/** Builds a rule that sets the spacing on one side of a mark. */
export function markSpacingRule(spec: MarkSpacingSpec): RuntimeRule {
  const definition = RULES.find(({ id }) => id === spec.id);
  if (definition !== undefined) checkExclusions(spec, definition);
  const exclusions = Object.values(spec.exclusions).filter(
    (exclusion) => !("ensuredBy" in exclusion),
  );
  const { mark, side } = spec;
  const span = spec.span ?? "spacing";
  return catalogueRule(spec.id, (run) => {
    const scan = new RunScan(run);
    let resumeAt = 0;
    for (const { index, stretch } of scan.occurrences(mark, () => resumeAt)) {
      const context = new MarkContext(scan, mark, index, stretch);
      const spacing = side === "before" ? context.before : context.after;
      let expected = spec.expected;
      let decided = false;
      for (const exclusion of exclusions) {
        if ("skip" in exclusion) {
          const skip = exclusion.skip(context);
          if (skip === false) continue;
          if (typeof skip === "number") resumeAt = skip;
        } else if ("report" in exclusion) {
          if (!exclusion.report(context)) continue;
          scan.report(stretch, {
            start: spacing.start,
            end: spacing.end,
            ...diagnosticMessage(exclusion.messageId, { mark }),
          });
        } else if ("expect" in exclusion) {
          if (!exclusion.expect(context)) continue;
          expected = exclusion.spacing;
          break;
        }
        decided = true;
        break;
      }
      if (decided) continue;
      // Spacing that continues into protected text cannot be corrected.
      if (spacing.blocked) continue;

      const { removals } = spacing;
      const own = scan.text.slice(spacing.start, spacing.end);
      // A correct space is left in its node, even when it lies in a
      // neighboring node (issue #63).
      const actual = side === "before"
        ? scan.spacingText(removals) + own
        : own + scan.spacingText(removals);
      if (actual === expected) continue;
      // Text inserted next to the mark stays in the mark's node.
      const edit: RunEdit = span === "spacing-and-mark"
        ? {
          start: spacing.start,
          end: index + mark.length,
          replacement: expected + mark,
        }
        : {
          start: spacing.start,
          end: spacing.end,
          replacement: expected,
          bias: side === "before" ? "right" : "left",
        };
      const diagnostic: RunDiagnostic = {
        ...edit,
        ...spec.message(context, actual, expected),
        ...(removals.length === 0 ? {} : { related: removals }),
      };
      scan.propose(stretch, diagnostic, edit, removals);
    }
    return scan.result();
  });
}
