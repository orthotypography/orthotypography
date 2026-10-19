import { classifyEllipsisCandidates } from "../classify/ellipsis.ts";
import type { RuleResult, RunDiagnostic, RuntimeRule } from "../model.ts";
import { catalogueRule } from "./catalogue-rule.ts";
import { diagnosticMessage } from "../messages.ts";
import { RunStretches, stretchParts, unprotectedRegions } from "./run-text.ts";

function result(diagnostics: readonly RunDiagnostic[]): RuleResult {
  return diagnostics.length > 0 ? { diagnostics } : {};
}

// The lookbehind of the original expression is checked separately, as the
// per-fragment rule did, so that the text before a node boundary is read one
// code unit at a time.
const forbiddenEtcEllipsis =
  /etc\.(?:[\t \u00a0\u202f]*…|[\t \u00a0\u202f]+\.{3,}|\.{2,})(?=$|[\t \u00a0\u202f)\]}»"'’!?;,:])/giu;
const wordCharacter = /[\p{L}\p{N}_]/u;

/** Whether a word character precedes `start`, as the fragment scan saw it. */
function wordBefore(stretches: RunStretches, start: number): boolean {
  if (start === 0) return false;
  const { text } = stretches;
  const stretch = stretches.indexAt(start);
  const stretchStart = stretches.starts[stretch];
  if (stretchStart === start) return wordCharacter.test(text[start - 1]);
  const unit = text.charCodeAt(start - 1);
  const first = unit >= 0xdc00 && unit <= 0xdfff ? start - 2 : start - 1;
  return wordCharacter.test(text.slice(Math.max(stretchStart, first), start));
}

/** Removes suspension points forbidden after the standalone abbreviation etc. */
export const ETC_ELLIPSIS_RULE: RuntimeRule = catalogueRule(
  "punctuation.ellipsis.after-etc.forbidden",
  (run) => {
    const stretches = new RunStretches(run);
    const diagnostics: RunDiagnostic[] = [];
    for (const region of unprotectedRegions(stretches)) {
      const value = run.text.slice(region.start, region.end);
      forbiddenEtcEllipsis.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = forbiddenEtcEllipsis.exec(value)) !== null) {
        const start = region.start + match.index;
        if (wordBefore(stretches, start)) {
          forbiddenEtcEllipsis.lastIndex = match.index + 1;
          continue;
        }
        const end = start + match[0].length;
        const stretchEnd = stretches.ends[stretches.indexAt(start)];
        const removals = stretchParts(stretches, start + 4, end);
        diagnostics.push({
          start,
          end: Math.min(start + 4, stretchEnd),
          ...diagnosticMessage("ellipsis.after-etc"),
          related: removals.filter(({ start }) => start >= stretchEnd),
          edits: removals.map((removal) => ({ ...removal, replacement: "" })),
        });
      }
    }
    return result(diagnostics);
  },
);

/** Certain ellipsis candidates of each unprotected region, in text order. */
function* regionCandidates(stretches: RunStretches) {
  for (const region of unprotectedRegions(stretches)) {
    const value = stretches.text.slice(region.start, region.end);
    for (
      const candidate of classifyEllipsisCandidates(value, region.start === 0)
    ) {
      yield {
        ...candidate,
        start: region.start + candidate.start,
        end: region.start + candidate.end,
        /** Code point after the candidate within its region, or 0. */
        next: value.codePointAt(candidate.end) ?? 0,
      };
    }
  }
}

/** Diagnoses certain ASCII ellipses and replaces their glyph in fix mode. */
export const ELLIPSIS_GLYPH_RULE: RuntimeRule = catalogueRule(
  "punctuation.ellipsis.glyph",
  (run) => {
    const stretches = new RunStretches(run);
    const diagnostics: RunDiagnostic[] = [];
    for (const candidate of regionCandidates(stretches)) {
      if (candidate.value !== "..." || !candidate.certain) continue;
      const [primary, ...related] = stretchParts(
        stretches,
        candidate.start,
        candidate.end,
      );
      // The glyph replaces the first part, in the node where the ellipsis
      // starts; the other parts are removed from their nodes.
      diagnostics.push({
        ...primary,
        ...diagnosticMessage("ellipsis.glyph", {
          function: candidate.function,
        }),
        ...(related.length === 0 ? {} : { related }),
        edits: [{
          start: candidate.start,
          end: candidate.end,
          replacement: "…",
          bias: "left",
        }],
      });
    }
    return result(diagnostics);
  },
);

/** Compatibility alias for the original recognition-only export. */
export const ELLIPSIS_RECOGNITION_RULE = ELLIPSIS_GLYPH_RULE;

const letterOrMark = /[\p{L}\p{M}]/u;

/** Inserts a word space after a certain structurally initial ellipsis. */
export const ELLIPSIS_INITIAL_SPACE_AFTER_RULE: RuntimeRule = catalogueRule(
  "punctuation.ellipsis.initial.space-after",
  (run) => {
    const stretches = new RunStretches(run);
    const diagnostics: RunDiagnostic[] = [];
    for (const candidate of regionCandidates(stretches)) {
      if (
        candidate.value !== "…" || candidate.function !== "initial" ||
        !candidate.certain ||
        !letterOrMark.test(String.fromCodePoint(candidate.next))
      ) continue;
      // The space stays in the ellipsis's node.
      diagnostics.push({
        start: candidate.start,
        end: candidate.end,
        ...diagnosticMessage("ellipsis.initial.space-after"),
        edits: [{
          start: candidate.end,
          end: candidate.end,
          replacement: " ",
          bias: "left",
        }],
      });
    }
    return result(diagnostics);
  },
);
