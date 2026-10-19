import { numericValueSource } from "../classify/numeric.ts";
import { NUMERIC_ANNOTATION } from "../classify/runtime.ts";
import type {
  Annotation,
  LogicalRun,
  NumericConstructKind,
  RuleResult,
  RunDiagnostic,
  RunEdit,
  RuntimeRule,
} from "../model.ts";
import { resolveUnitExpression } from "../registry/units.ts";
import { catalogueRule } from "./catalogue-rule.ts";
import {
  type Region,
  RunStretches,
  stretchParts,
  unprotectedRegions,
} from "./run-text.ts";

/*
 * Numeric rules read the `numeric` annotations of the classifier (design §5)
 * instead of reclassifying each fragment.
 *
 * A construct inside one fragment is replaced whole, as before. A construct
 * split across nodes receives the smallest edits instead, so that every node
 * keeps its text: the space before a symbol belongs to the symbol's node, and
 * a leading euro sign moves after the amount into the amount's node. Its
 * diagnostic is reported on the first part, with the other parts as related
 * locations and without a replacement, which cannot describe several parts.
 */

const numericValuePattern = new RegExp(numericValueSource, "u");

/** Target annotations of one numeric kind, in text order. */
function targets(
  run: LogicalRun,
  kind: NumericConstructKind,
): readonly Annotation[] {
  return run.annotations(NUMERIC_ANNOTATION).filter(({ data }) =>
    data?.disposition === "target" && data.kind === kind
  );
}

/**
 * Parsed construct: a number and a symbol with the spacing between them, in
 * run coordinates, and the text expected for the whole construct.
 */
interface SpacedConstruct {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
  /** Range to replace or remove in split constructs. */
  readonly spacing: { readonly start: number; readonly end: number };
  /** Text inserted when the construct is split, and where. */
  readonly insertion: {
    readonly at: number;
    readonly text: string;
    readonly bias: "left" | "right";
  };
  /**
   * Reason to report the construct without a correction, appended to the
   * rule's message.
   */
  readonly unfixable?: string;
}

function spacingRule(
  id: string,
  message: string,
  kind: NumericConstructKind,
  parse: (annotation: Annotation, text: string) => SpacedConstruct | null,
): RuntimeRule {
  return catalogueRule(id, (run) => {
    const diagnostics: RunDiagnostic[] = [];
    let stretches: RunStretches | undefined;
    for (const annotation of targets(run, kind)) {
      const construct = parse(annotation, run.text);
      if (
        construct === null ||
        run.text.slice(construct.start, construct.end) === construct.replacement
      ) continue;
      stretches ??= new RunStretches(run);
      const [primary, ...related] = stretchParts(
        stretches,
        construct.start,
        construct.end,
      );
      if (construct.unfixable !== undefined) {
        diagnostics.push({
          ...primary,
          message: `${message}; ${construct.unfixable}`,
          ...(related.length === 0 ? {} : { related }),
        });
        continue;
      }
      if (related.length === 0) {
        const edit = {
          start: construct.start,
          end: construct.end,
          replacement: construct.replacement,
        };
        diagnostics.push({ ...edit, message, edits: [edit] });
        continue;
      }
      const { spacing, insertion } = construct;
      const edits: RunEdit[] = [];
      if (
        spacing.end > spacing.start && insertion.at === spacing.end &&
        stretches.indexAt(spacing.start) === stretches.indexAt(insertion.at)
      ) {
        // The spacing lies in the symbol's node: replace it there.
        edits.push({ ...spacing, replacement: insertion.text });
      } else {
        for (
          const part of stretchParts(stretches, spacing.start, spacing.end)
        ) {
          edits.push({ ...part, replacement: "" });
        }
        edits.push({
          start: insertion.at,
          end: insertion.at,
          replacement: insertion.text,
          bias: insertion.bias,
        });
      }
      diagnostics.push({ ...primary, message, related, edits });
    }
    return result(diagnostics);
  });
}

function result(diagnostics: readonly RunDiagnostic[]): RuleResult {
  return diagnostics.length > 0 ? { diagnostics } : {};
}

const spacedSymbol = (symbolSource: string) =>
  new RegExp(
    String.raw`^(${numericValueSource})([\t \u00a0\u202f]*)(${symbolSource})$`,
    "u",
  );

/** Number, spacing, then a symbol that takes a no-break space before it. */
function trailingSymbol(pattern: RegExp) {
  return (annotation: Annotation, text: string): SpacedConstruct | null => {
    const parts = pattern.exec(text.slice(annotation.start, annotation.end));
    if (parts === null) return null;
    const numberEnd = annotation.start + parts[1].length;
    const symbolStart = numberEnd + parts[2].length;
    return {
      start: annotation.start,
      end: annotation.end,
      replacement: `${parts[1]}\u00a0${parts[3]}`,
      spacing: { start: numberEnd, end: symbolStart },
      insertion: { at: symbolStart, text: "\u00a0", bias: "right" },
    };
  };
}

/** Adds a no-break space inside classified percentage constructs. */
export const PERCENTAGE_SPACING_RULE: RuntimeRule = spacingRule(
  "number.percent.nbsp-before",
  "Expected a no-break space before the percentage symbol",
  "percentage",
  trailingSymbol(spacedSymbol("[%‰]")),
);

const measurement = spacedSymbol(".+");

/** Diagnoses recognized unit spacing, or fixes it when explicitly requested. */
export const UNIT_SPACING_RULE: RuntimeRule = spacingRule(
  "number.unit.nbsp-before",
  "Expected a no-break space before the unit symbol",
  "measurement",
  (annotation, text) => {
    const parts = measurement.exec(
      text.slice(annotation.start, annotation.end),
    );
    if (parts === null || resolveUnitExpression(parts[3]) === null) return null;
    return trailingSymbol(measurement)(annotation, text);
  },
);

const trailingEuro = trailingSymbol(spacedSymbol("€"));
const leadingEuro = new RegExp(
  String.raw`^€([\t \u00a0\u202f]*)(${numericValueSource})$`,
  "u",
);

/**
 * Characters after which a leading euro sign may move behind the amount: the
 * amount then takes the sign's place without touching the preceding text.
 */
const leadingEuroBoundary = /[\s(\[«“‘]/u;

/** Diagnoses French euro-symbol placement, or fixes it when requested. */
export const EURO_SPACING_RULE: RuntimeRule = spacingRule(
  "number.euro.nbsp-before",
  "Expected the euro symbol after the amount with a no-break space",
  "currency",
  (annotation, text) => {
    const construct = text.slice(annotation.start, annotation.end);
    if (!construct.includes("€")) return null;
    const trailing = trailingEuro(annotation, text);
    if (trailing !== null) return trailing;
    const parts = leadingEuro.exec(construct);
    if (parts === null) return null;
    const amountStart = annotation.start + 1 + parts[1].length;
    const before = text[annotation.start - 1];
    return {
      // A sign attached to the preceding text would leave that text glued to
      // the amount (issue #36); inserting a space is not prescribed.
      ...(before === undefined || leadingEuroBoundary.test(before) ? {} : {
        unfixable:
          "not corrected because the symbol is attached to the preceding text",
      }),
      start: annotation.start,
      end: annotation.end,
      replacement: `${parts[2]}\u00a0€`,
      // The sign and its spacing leave their place and follow the amount,
      // in the amount's node.
      spacing: { start: annotation.start, end: amountStart },
      insertion: { at: annotation.end, text: "\u00a0€", bias: "left" },
    };
  },
);

function groupFromRight(digits: string): string {
  const firstGroupLength = digits.length % 3 || 3;
  const groups = [digits.slice(0, firstGroupLength)];
  for (let index = firstGroupLength; index < digits.length; index += 3) {
    groups.push(digits.slice(index, index + 3));
  }
  return groups.join("\u202f");
}

function groupFromLeft(digits: string): string {
  const groups: string[] = [];
  for (let index = 0; index < digits.length; index += 3) {
    groups.push(digits.slice(index, index + 3));
  }
  return groups.join("\u202f");
}

function expectedGrouping(value: string): string | null {
  if (value.includes(".")) return null;
  const [rawInteger, rawFraction] = value.split(",");
  const integer = rawInteger.replaceAll(/[\t \u00a0\u202f]/gu, "");
  const fraction = rawFraction?.replaceAll(/[\t \u00a0\u202f]/gu, "");
  if (integer.length > 1 && integer.startsWith("0")) return null;
  if (integer.length < 4 && (fraction?.length ?? 0) < 4) return null;

  const groupedInteger = integer.length >= 4
    ? groupFromRight(integer)
    : integer;
  const groupedFraction = fraction === undefined
    ? ""
    : `,${fraction.length >= 4 ? groupFromLeft(fraction) : fraction}`;
  return groupedInteger + groupedFraction;
}

function hasExcludedPrefix(
  value: string,
  regionStart: number,
  start: number,
): boolean {
  const prefix = value.slice(Math.max(regionStart, start - 64), start);
  return /(?:\b(?:article|build|code|folio|id|isbn|issn|matricule|n(?:o|uméro)|page|réf(?:érence)?|ticket|version)\s*(?:[:#]\s*)?|n[°º]\s*)$/iu
    .test(prefix) || /[-_/#]$/u.test(prefix);
}

/** Diagnoses missing digit grouping in already classified quantities. */
export const DIGIT_GROUPING_RULE: RuntimeRule = catalogueRule(
  "number.digits.grouping",
  (run) => {
    const diagnostics: RunDiagnostic[] = [];
    let stretches: RunStretches | undefined;
    let regions: Region[] = [];
    let region = 0;
    for (const annotation of run.annotations(NUMERIC_ANNOTATION)) {
      const kind = annotation.data?.kind;
      if (
        annotation.data?.disposition !== "target" ||
        (kind !== "measurement" && kind !== "percentage" && kind !== "currency")
      ) continue;
      const construct = run.text.slice(annotation.start, annotation.end);
      const numericMatch = numericValuePattern.exec(construct);
      if (numericMatch === null) continue;
      const numericStart = annotation.start + numericMatch.index;
      const numericEnd = numericStart + numericMatch[0].length;
      if (stretches === undefined) {
        stretches = new RunStretches(run);
        regions = unprotectedRegions(stretches);
      }
      while (region < regions.length && regions[region].end <= numericStart) {
        region++;
      }
      const regionStart = regions[region]?.start ?? 0;
      if (hasExcludedPrefix(run.text, regionStart, numericStart)) continue;

      const expected = expectedGrouping(numericMatch[0]);
      const functionalInput = numericMatch[0].replaceAll("\u00a0", "\u202f");
      if (expected === null || functionalInput === expected) continue;

      const [primary, ...related] = stretchParts(
        stretches,
        numericStart,
        numericEnd,
      );
      diagnostics.push({
        ...primary,
        message: "Expected digit grouping in this classified quantity",
        ...(related.length > 0 ? { related } : {}),
      });
    }
    return result(diagnostics);
  },
);
