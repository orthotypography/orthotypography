import type {
  LogicalRun,
  RuleResult,
  RunDiagnostic,
  RunEdit,
  RuntimeRule,
} from "../model.ts";
import { catalogueRule } from "./catalogue-rule.ts";
import { diagnosticMessage } from "../messages.ts";
import {
  type Boundary,
  RunStretches,
  spacingCharacters,
  spacingText,
} from "./run-text.ts";

const message = diagnosticMessage("quotes.french.inner-space");

/**
 * Pairs French guillemets outside protected text.
 *
 * Guillemets nest; a closing one pairs with the latest unmatched opening one
 * when the text between them, protected text included, is not blank. The
 * result maps each paired guillemet to its partner.
 */
function pairGuillemets(run: LogicalRun): Map<number, number> {
  const { text, protectedRanges } = run;
  const paired = new Map<number, number>();
  const openings: number[] = [];
  let rangeIndex = 0;
  for (let index = 0; index < text.length; index++) {
    while (
      rangeIndex < protectedRanges.length &&
      protectedRanges[rangeIndex].end <= index
    ) rangeIndex++;
    const range = protectedRanges[rangeIndex];
    if (range !== undefined && range.start <= index) {
      index = range.end - 1;
      continue;
    }
    const character = text[index];
    if (character === "«") {
      openings.push(index);
    } else if (character === "»") {
      const opening = openings.pop();
      if (
        opening !== undefined &&
        text.slice(opening + 1, index).trim().length > 0
      ) {
        paired.set(opening, index);
        paired.set(index, opening);
      }
    }
  }
  return paired;
}

function applyGuillemetSpacing(run: LogicalRun): RuleResult {
  const { text } = run;
  const paired = pairGuillemets(run);
  if (paired.size === 0) return {};
  // The inner space is set in the guillemet's stretch (its node and
  // unprotected text), as the per-fragment implementation did. Spacing that
  // continues into neighboring stretches counts too: a correct space in a
  // neighboring node is left there, and wrong spacing there is removed
  // (issue #66). Spacing in protected text cannot be corrected, so the
  // guillemet is left as is.
  const stretches = new RunStretches(run);
  const diagnostics: RunDiagnostic[] = [];

  const positions = [...paired.keys()].sort((left, right) => left - right);
  for (const position of positions) {
    const partner = paired.get(position) as number;
    const stretch = stretches.indexAt(position);
    let own: RunEdit;
    let boundary: Boundary | undefined;
    if (text[position] === "«") {
      let end = position + 1;
      const last = stretches.ends[stretch];
      while (end < last && spacingCharacters.has(text[end])) end++;
      if (end === last) boundary = stretches.followingBoundary(stretch);
      // An inserted space stays in the opening guillemet's node.
      own = { start: position + 1, end, replacement: " ", bias: "left" };
    } else {
      let start = position;
      const first = stretches.starts[stretch];
      while (start > first && spacingCharacters.has(text[start - 1])) start--;
      if (start === first) boundary = stretches.precedingBoundary(stretch);
      // An inserted space stays in the closing guillemet's node.
      own = { start, end: position, replacement: " ", bias: "right" };
    }
    if (boundary?.blocked) continue;
    const removals = boundary?.removals ?? [];
    const ownText = text.slice(own.start, own.end);
    const spacing = text[position] === "«"
      ? ownText + spacingText(text, removals)
      : spacingText(text, removals) + ownText;
    if (spacing === " ") continue;
    const edits: RunEdit[] = ownText === own.replacement ? [] : [own];
    for (const removal of removals) edits.push({ ...removal, replacement: "" });
    diagnostics.push({
      ...own,
      ...message,
      related: [{ start: partner, end: partner + 1 }, ...removals],
      edits,
    });
  }

  return diagnostics.length > 0 ? { diagnostics } : {};
}

/** Spaces paired French guillemets without converting ambiguous quote glyphs. */
export const FRENCH_GUILLEMETS_SPACING_RULE: RuntimeRule = catalogueRule(
  "quotes.french.nbsp-inner",
  applyGuillemetSpacing,
);
