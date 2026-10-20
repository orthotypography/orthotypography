import type {
  Annotation,
  LogicalRun,
  NumericConstruct,
  RuntimeRule,
} from "../model.ts";
import { catalogueRule } from "../rules/catalogue-rule.ts";
import { RunStretches, unprotectedRegions } from "../rules/run-text.ts";
import { classifyNumericConstructs } from "./numeric.ts";
import { classifyEllipsisCandidates } from "./ellipsis.ts";

/** Annotation kind of numeric constructs. */
export const NUMERIC_ANNOTATION = "numeric";

function annotation(
  construct: NumericConstruct,
  offset: number,
): Annotation {
  return {
    kind: NUMERIC_ANNOTATION,
    start: offset + construct.start,
    end: offset + construct.end,
    ...(construct.disposition === "protect" ? { protect: true } : {}),
    data: { kind: construct.kind, disposition: construct.disposition },
  };
}

/**
 * Classifies numeric constructs once per unprotected region of the run.
 *
 * Syntactic contexts (`protect`) are found on the whole region, so that a time
 * or a version split across text nodes is protected. Targets are found in the
 * text between those contexts, as the rules that consume them saw it when
 * each rule reclassified its own fragment.
 */
function classifyRun(run: LogicalRun): readonly Annotation[] {
  const stretches = new RunStretches(run);
  const annotations: Annotation[] = [];
  for (const region of unprotectedRegions(stretches)) {
    const text = run.text.slice(region.start, region.end);
    let cursor = 0;
    const classifyPiece = (end: number): void => {
      if (end <= cursor) return;
      for (
        const construct of classifyNumericConstructs(text.slice(cursor, end))
      ) {
        if (construct.disposition === "target") {
          annotations.push(annotation(construct, region.start + cursor));
        }
      }
    };
    for (const construct of classifyNumericConstructs(text)) {
      if (construct.disposition !== "protect") continue;
      classifyPiece(construct.start);
      annotations.push(annotation(construct, region.start));
      cursor = construct.end;
    }
    classifyPiece(text.length);
  }
  return annotations;
}

/**
 * Pipeline rule that annotates numeric constructs; syntactic contexts become
 * protected for every later rule.
 */
export const NUMERIC_PROTECTION_RULE: RuntimeRule = catalogueRule(
  "classify.numeric-constructs",
  (run) => {
    const annotations = classifyRun(run);
    return annotations.length === 0 ? {} : { annotations };
  },
);

/** Annotation kind of ellipsis candidates. */
export const ELLIPSIS_ANNOTATION = "ellipsis";

/**
 * Pipeline rule that classifies ellipsis candidates once per unprotected region
 * of the run, after the numeric protections. Each candidate becomes an
 * `ellipsis` annotation whose data gives its function and whether that
 * function is certain; its representation is read from the current text.
 * Excluded candidates get no annotation.
 */
export const ELLIPSIS_CLASSIFICATION_RULE: RuntimeRule = catalogueRule(
  "classify.ellipsis-candidates",
  (run) => {
    const stretches = new RunStretches(run);
    const annotations: Annotation[] = [];
    for (const region of unprotectedRegions(stretches)) {
      const text = run.text.slice(region.start, region.end);
      for (
        const candidate of classifyEllipsisCandidates(text, region.start === 0)
      ) {
        annotations.push({
          kind: ELLIPSIS_ANNOTATION,
          start: region.start + candidate.start,
          end: region.start + candidate.end,
          data: {
            function: candidate.function,
            certain: String(candidate.certain),
          },
        });
      }
    }
    return annotations.length === 0 ? {} : { annotations };
  },
);
