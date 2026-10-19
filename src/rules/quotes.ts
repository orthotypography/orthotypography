import type {
  LogicalRun,
  RuleResult,
  RunDiagnostic,
  RunEdit,
  RuntimeRule,
} from "../model.ts";
import { catalogueRule } from "./catalogue-rule.ts";
import { diagnosticMessage } from "../messages.ts";
import { RunStretches, spacingCharacters } from "./run-text.ts";

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
  // Spacing is normalized only within the guillemet's stretch (its node and
  // unprotected text), as the per-fragment implementation did, so that every
  // edit and diagnostic stays with the guillemet's node.
  const stretches = new RunStretches(run);
  const diagnostics: RunDiagnostic[] = [];

  const positions = [...paired.keys()].sort((left, right) => left - right);
  for (const position of positions) {
    const partner = paired.get(position) as number;
    let edit: RunEdit;
    if (text[position] === "«") {
      let end = position + 1;
      while (!stretches.isEdge(end) && spacingCharacters.has(text[end])) end++;
      if (text.slice(position + 1, end) === " ") continue;
      // An inserted space stays in the opening guillemet's node.
      edit = { start: position + 1, end, replacement: " ", bias: "left" };
    } else {
      let start = position;
      while (
        !stretches.isEdge(start) && spacingCharacters.has(text[start - 1])
      ) {
        start--;
      }
      if (text.slice(start, position) === " ") continue;
      // An inserted space stays in the closing guillemet's node.
      edit = { start, end: position, replacement: " ", bias: "right" };
    }
    diagnostics.push({
      ...edit,
      ...message,
      related: [{ start: partner, end: partner + 1 }],
      edits: [edit],
    });
  }

  return diagnostics.length > 0 ? { diagnostics } : {};
}

/** Spaces paired French guillemets without converting ambiguous quote glyphs. */
export const FRENCH_GUILLEMETS_SPACING_RULE: RuntimeRule = catalogueRule(
  "quotes.french.nbsp-inner",
  applyGuillemetSpacing,
);
