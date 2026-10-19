import { NUMERIC_PROTECTION_RULE } from "../classify/runtime.ts";
import type {
  LogicalRun,
  RuleResult,
  RunDiagnostic,
  RunEdit,
  RunRange,
  RuntimeRule,
} from "../model.ts";
import {
  technicalPatternStarts,
  whitespaceFreeStarts,
} from "../classify/text-index.ts";
import { catalogueRule } from "./catalogue-rule.ts";
import { diagnosticMessage } from "../messages.ts";
import {
  type Adjacent,
  type Boundary,
  RunStretches,
  spacingCharacters,
  spacingText,
} from "./run-text.ts";

/*
 * Punctuation rules executed on the logical run.
 *
 * Scans keep the reach they had when the rules ran once per fragment: spacing
 * next to a mark is read within the mark's stretch, and neighboring stretches
 * are only visited to find the adjacent character or the spacing to remove at
 * a node boundary. Edits stay in the node that reported them, and text
 * inserted next to a mark stays in the mark's node. A space that is already
 * correct is left in its node, even a neighboring one (issue #63).
 */

/**
 * One diagnostic of a mark with its own edit and neighboring removals, or a
 * diagnostic without edits when `own` is absent.
 */
interface Proposal {
  readonly stretch: number;
  readonly diagnostic: RunDiagnostic;
  readonly own?: RunEdit;
  readonly removals: readonly RunRange[];
}

/** Shared state of one rule call on one run. */
class PunctuationScan {
  readonly text: string;
  readonly stretches: RunStretches;
  readonly #proposals: Proposal[] = [];
  #tokenStarts?: Int32Array;
  #technicalStarts?: Int32Array;

  constructor(readonly run: LogicalRun) {
    this.text = run.text;
    this.stretches = new RunStretches(run);
  }

  /** Positions of a mark outside protected text, in text order. */
  *marks(mark: string): Generator<{ index: number; stretch: number }> {
    const { text, stretches } = this;
    let index = text.indexOf(mark);
    while (index !== -1) {
      const stretch = stretches.indexAt(index);
      if (stretches.protectedFlags[stretch]) {
        index = text.indexOf(mark, stretches.ends[stretch]);
        continue;
      }
      yield { index, stretch };
      index = text.indexOf(mark, index + 1);
    }
  }

  start(stretch: number): number {
    return this.stretches.starts[stretch];
  }

  end(stretch: number): number {
    return this.stretches.ends[stretch];
  }

  /** Start of the spacing that ends at `index`, within its stretch. */
  spacingStart(index: number, stretch: number): number {
    const first = this.start(stretch);
    let start = index;
    while (start > first && spacingCharacters.has(this.text[start - 1])) {
      start--;
    }
    return start;
  }

  /** End of the spacing that starts at `index`, within its stretch. */
  spacingEnd(index: number, stretch: number): number {
    const last = this.end(stretch);
    let end = index;
    while (end < last && spacingCharacters.has(this.text[end])) end++;
    return end;
  }

  /** Character before a stretch position, not reaching before the stretch. */
  #characterBefore(index: number, stretch: number): string {
    const unit = this.text.charCodeAt(index - 1);
    const start = unit >= 0xdc00 && unit <= 0xdfff ? index - 2 : index - 1;
    return this.text.slice(Math.max(this.start(stretch), start), index);
  }

  /** Code point at a stretch position, not reaching past the stretch. */
  #characterAt(index: number, stretch: number): string {
    const unit = this.text.charCodeAt(index);
    const pair = unit >= 0xd800 && unit <= 0xdbff &&
      index + 1 < this.end(stretch);
    const codePoint = pair ? this.text.codePointAt(index) as number : unit;
    return String.fromCodePoint(codePoint);
  }

  /** Character before a position, looking into the previous stretch. */
  precedingCharacter(index: number, stretch: number): Adjacent {
    if (index > this.start(stretch)) {
      return {
        blocked: false,
        character: this.#characterBefore(index, stretch),
      };
    }
    if (stretch === 0) return { blocked: false };
    const previous = stretch - 1;
    if (this.stretches.protectedFlags[previous]) return { blocked: true };
    return {
      blocked: false,
      character: this.#characterBefore(this.end(previous), previous),
    };
  }

  /** Character at a position, looking into the next stretch. */
  followingCharacter(index: number, stretch: number): Adjacent {
    if (index < this.end(stretch)) {
      return { blocked: false, character: this.#characterAt(index, stretch) };
    }
    const next = stretch + 1;
    if (next >= this.stretches.starts.length) return { blocked: false };
    if (this.stretches.protectedFlags[next]) return { blocked: true };
    return {
      blocked: false,
      character: this.#characterAt(this.start(next), next),
    };
  }

  /** Character before a stretch and the trailing spacing of earlier ones. */
  precedingBoundary(stretch: number): Boundary {
    return this.stretches.precedingBoundary(stretch);
  }

  /** Character after a stretch and the leading spacing of later ones. */
  followingBoundary(stretch: number): Boundary {
    return this.stretches.followingBoundary(stretch);
  }

  /**
   * Whether the whitespace-free token before a comma is technical: it starts
   * with `/`, `./`, or `../`, or contains a URL scheme or `www.`. The token
   * extends into earlier unprotected stretches only while it covers them
   * entirely and is shorter than 256 code units.
   */
  technicalTokenBefore(index: number, stretch: number): boolean {
    const tokenStarts = this.#tokenStarts ??= whitespaceFreeStarts(this.text);
    let start = Math.max(this.start(stretch), tokenStarts[index]);
    if (start === this.start(stretch)) {
      for (
        let previous = stretch - 1;
        previous >= 0 && index - start < 256;
        previous--
      ) {
        if (this.stretches.protectedFlags[previous]) break;
        const first = this.start(previous);
        start = Math.max(first, tokenStarts[this.end(previous)]);
        if (start > first) break;
      }
    }
    const { text } = this;
    const path = (offset: number, value: string): boolean =>
      start + offset < index && text[start + offset] === value;
    if (
      path(0, "/") || (path(0, ".") && path(1, "/")) ||
      (path(0, ".") && path(1, ".") && path(2, "/"))
    ) return true;
    const technical = this.#technicalStarts ??= technicalPatternStarts(text);
    return technical[index] >= start;
  }

  /** Records a diagnostic, its edit in the mark's stretch, and removals. */
  propose(
    stretch: number,
    diagnostic: RunDiagnostic,
    own: RunEdit,
    removals: readonly RunRange[] = [],
  ): void {
    this.#proposals.push({ stretch, diagnostic, own, removals });
  }

  /** Text of spacing ranges in neighboring stretches, in text order. */
  spacingText(ranges: readonly RunRange[]): string {
    return spacingText(this.text, ranges);
  }

  /** Reports a diagnostic without edits, in mark order with the proposals. */
  report(stretch: number, diagnostic: RunDiagnostic): void {
    this.#proposals.push({ stretch, diagnostic, removals: [] });
  }

  /**
   * Returns the diagnostics with their edits. As with per-fragment
   * application, a stretch keeps its own edits only when at least one of them
   * changes its text; removals in neighboring stretches are always kept.
   */
  result(): RuleResult {
    const effective = new Set<number>();
    for (const { stretch, own } of this.#proposals) {
      if (
        own !== undefined &&
        this.text.slice(own.start, own.end) !== own.replacement
      ) {
        effective.add(stretch);
      }
    }
    const diagnostics = this.#proposals.map(
      ({ stretch, diagnostic, own, removals }): RunDiagnostic => {
        const edits: RunEdit[] = own !== undefined && effective.has(stretch)
          ? [own]
          : [];
        for (const removal of removals) {
          edits.push({ ...removal, replacement: "" });
        }
        return edits.length === 0 ? diagnostic : { ...diagnostic, edits };
      },
    );
    return diagnostics.length > 0 ? { diagnostics } : {};
  }
}

function noSpaceBeforeRule(id: string, mark: "," | "."): RuntimeRule {
  const message = diagnosticMessage("spacing.no-space-before", { mark });
  return catalogueRule(id, (run) => {
    const scan = new PunctuationScan(run);
    const { text } = scan;
    let resumeAt = 0;
    for (const { index, stretch } of scan.marks(mark)) {
      if (index < resumeAt) continue;
      // A run of periods is not a sentence period: suspension points follow
      // their own spacing rules, and a space before them may be correct.
      if (
        mark === "." &&
        scan.followingCharacter(index + 1, stretch).character === "."
      ) {
        let last = index + 1;
        const end = scan.end(stretch);
        if (last < end) {
          while (last + 1 < end && text[last + 1] === ".") last++;
          resumeAt = last + 1;
        }
        continue;
      }
      const start = scan.spacingStart(index, stretch);
      const preceding = start === scan.start(stretch)
        ? scan.precedingBoundary(stretch)
        : { blocked: false, removals: [] };
      if (preceding.blocked) continue;
      const { removals } = preceding;
      if (start === index && removals.length === 0) continue;
      scan.propose(
        stretch,
        {
          start,
          end: index + 1,
          ...message,
          replacement: mark,
          ...(removals.length === 0 ? {} : { related: removals }),
        },
        { start, end: index + 1, replacement: mark },
        removals,
      );
    }
    return scan.result();
  });
}

/** Safe low-punctuation rules available in the first executable lot. */
export const SAFE_PUNCTUATION_RULES: readonly RuntimeRule[] = [
  noSpaceBeforeRule("punctuation.comma.no-space-before", ","),
  noSpaceBeforeRule("punctuation.period.no-space-before", "."),
] as const;

const textOpeningCharacters = new Set([
  "(",
  "[",
  "{",
  '"',
  "'",
  "«",
  "“",
  "‘",
]);

function beginsText(character: string): boolean {
  return /[\p{L}\p{N}]/u.test(character) ||
    textOpeningCharacters.has(character);
}

/** Inserts the documented word space after commas in safe prose contexts. */
export const SPACE_AFTER_COMMA_RULE: RuntimeRule = catalogueRule(
  "punctuation.comma.space-after",
  (run) => {
    const scan = new PunctuationScan(run);
    for (const { index, stretch } of scan.marks(",")) {
      const preceding = scan.precedingCharacter(index, stretch);
      const following = scan.followingCharacter(index + 1, stretch);
      if (preceding.blocked || following.blocked) continue;

      const previous = preceding.character;
      const next = following.character;
      if (next === undefined || /\s/u.test(next) || !beginsText(next)) continue;
      if (/\p{N}/u.test(previous ?? "") && /\p{N}/u.test(next)) continue;
      if (scan.technicalTokenBefore(index, stretch)) continue;

      // An inserted space stays in the comma's node.
      const edit: RunEdit = {
        start: index + 1,
        end: index + 1,
        replacement: " ",
        bias: "left",
      };
      scan.propose(
        stretch,
        { ...edit, ...diagnosticMessage("spacing.comma.space-after") },
        edit,
      );
    }
    return scan.result();
  },
);

type HighPunctuationMark = ":" | ";" | "?" | "!";

interface HighPunctuationContext {
  readonly start: number;
  readonly end: number;
  readonly preceding: Boundary;
  readonly following: Boundary;
  readonly previous?: string;
  readonly next?: string;
}

function inspectHighPunctuation(
  scan: PunctuationScan,
  index: number,
  stretch: number,
): HighPunctuationContext {
  const start = scan.spacingStart(index, stretch);
  const end = scan.spacingEnd(index + 1, stretch);
  const preceding: Boundary = start === scan.start(stretch)
    ? scan.precedingBoundary(stretch)
    : { blocked: false, character: scan.text[start - 1], removals: [] };
  const following: Boundary = end === scan.end(stretch)
    ? scan.followingBoundary(stretch)
    : { blocked: false, character: scan.text[end], index: end, removals: [] };
  return {
    start,
    end,
    preceding,
    following,
    previous: preceding.character,
    next: following.character,
  };
}

function excludesHighPunctuation(
  scan: PunctuationScan,
  index: number,
  mark: HighPunctuationMark,
  inspected: HighPunctuationContext,
): boolean {
  const { preceding, following, previous, next } = inspected;
  if (preceding.blocked || following.blocked || previous === undefined) {
    return true;
  }
  if (
    mark === "!" && /^!important\b/iu.test(scan.text.slice(index, index + 11))
  ) return true;
  if (previous === mark || next === mark) return true;
  if (mark === ":" && (previous === ":" || next === ":" || next === "/")) {
    return true;
  }
  return (mark === "?" || mark === "!") &&
    ((previous !== undefined && "?!".includes(previous)) ||
      (next !== undefined && "?!".includes(next)));
}

const highPunctuationOrder = new Map<HighPunctuationMark, number>([
  [":", 0],
  [";", 1],
  ["?", 2],
  ["!", 3],
]);

function isHighPunctuationMark(value?: string): value is HighPunctuationMark {
  return value !== undefined && highPunctuationOrder.has(
    value as HighPunctuationMark,
  );
}

function highPunctuationRank(mark: HighPunctuationMark): number {
  return highPunctuationOrder.get(mark) ?? -1;
}

interface PunctuationLocation {
  readonly index: number;
  readonly stretch: number;
}

/** Nearest character before `start`, stopping at protected text. */
function precedingPunctuationLocation(
  scan: PunctuationScan,
  start: number,
  stretch: number,
): PunctuationLocation | undefined {
  if (start > scan.start(stretch)) return { index: start - 1, stretch };
  for (let index = stretch - 1; index >= 0; index--) {
    if (scan.stretches.protectedFlags[index]) return undefined;
    const spacing = scan.spacingStart(scan.end(index), index);
    if (spacing > scan.start(index)) {
      return { index: spacing - 1, stretch: index };
    }
  }
  return undefined;
}

/** Nearest character from `end`, stopping at protected text. */
function followingPunctuationLocation(
  scan: PunctuationScan,
  end: number,
  stretch: number,
): PunctuationLocation | undefined {
  if (end < scan.end(stretch)) return { index: end, stretch };
  const count = scan.stretches.starts.length;
  for (let index = stretch + 1; index < count; index++) {
    if (scan.stretches.protectedFlags[index]) return undefined;
    const spacing = scan.spacingEnd(scan.start(index), index);
    if (spacing < scan.end(index)) return { index: spacing, stretch: index };
  }
  return undefined;
}

function punctuationLocationIsExcluded(
  scan: PunctuationScan,
  location: PunctuationLocation,
  mark: HighPunctuationMark,
): boolean {
  const inspected = inspectHighPunctuation(
    scan,
    location.index,
    location.stretch,
  );
  return excludesHighPunctuation(scan, location.index, mark, inspected);
}

function highPunctuationBeforeRule(
  id: string,
  mark: HighPunctuationMark,
  before: " " | " ",
): RuntimeRule {
  const message = diagnosticMessage("spacing.space-before", { mark });
  return catalogueRule(id, (run) => {
    const scan = new PunctuationScan(run);
    for (const { index, stretch } of scan.marks(mark)) {
      const inspected = inspectHighPunctuation(scan, index, stretch);
      if (excludesHighPunctuation(scan, index, mark, inspected)) continue;
      if (isHighPunctuationMark(inspected.previous)) {
        const previous = precedingPunctuationLocation(
          scan,
          inspected.start,
          stretch,
        );
        if (
          previous !== undefined &&
          highPunctuationRank(inspected.previous) > highPunctuationRank(mark) &&
          !punctuationLocationIsExcluded(scan, previous, inspected.previous)
        ) continue;
      }

      const { removals } = inspected.preceding;
      // A correct space is left in its node, even when it lies in a node
      // before the sign's node (issue #63).
      if (
        scan.spacingText(removals) + scan.text.slice(inspected.start, index) ===
          before
      ) continue;
      // The space before the mark stays in the mark's node.
      const edit: RunEdit = {
        start: inspected.start,
        end: index,
        replacement: before,
        bias: "right",
      };
      scan.propose(
        stretch,
        {
          ...edit,
          ...message,
          ...(removals.length === 0 ? {} : { related: removals }),
        },
        edit,
        removals,
      );
    }
    return scan.result();
  });
}

/**
 * Signs that govern the space before them (Imprimerie nationale 2002, table of
 * spaces around punctuation): a no-break word space before the closing
 * guillemet, set by the guillemet rule, and no space before the closing
 * parenthesis and bracket, the comma, and the period, which are « toujours
 * collés au mot précédent ». A closing English quotation mark is closed the
 * same way. The space after high punctuation does not apply before them.
 */
const signsGoverningSpaceBefore: ReadonlySet<string> = new Set([
  "»",
  ")",
  "]",
  "”",
  ",",
  ".",
]);

function highPunctuationAfterRule(
  id: string,
  mark: HighPunctuationMark,
): RuntimeRule {
  const message = diagnosticMessage("spacing.space-after", { mark });
  const ellipsisMessage = diagnosticMessage("spacing.space-after.ellipsis", {
    mark,
  });
  return catalogueRule(id, (run) => {
    const scan = new PunctuationScan(run);
    for (const { index, stretch } of scan.marks(mark)) {
      const inspected = inspectHighPunctuation(scan, index, stretch);
      if (excludesHighPunctuation(scan, index, mark, inspected)) continue;
      const { next } = inspected;
      const nextIndex = inspected.following.index;
      // The source does not describe a mark followed by suspension points:
      // the spacing is reported for review and left as is.
      if (
        next === "…" ||
        (next === "." && nextIndex !== undefined &&
          scan.text.startsWith("...", nextIndex))
      ) {
        scan.report(stretch, {
          start: index + 1,
          end: inspected.end,
          ...ellipsisMessage,
        });
        continue;
      }
      // The next sign governs the space before it, which is left as is.
      if (next !== undefined && signsGoverningSpaceBefore.has(next)) continue;
      if (isHighPunctuationMark(inspected.next)) {
        const next = followingPunctuationLocation(
          scan,
          inspected.end,
          stretch,
        );
        if (
          next !== undefined &&
          highPunctuationRank(inspected.next) > highPunctuationRank(mark) &&
          !punctuationLocationIsExcluded(scan, next, inspected.next)
        ) continue;
      }

      const replacement = inspected.next === undefined ? "" : " ";
      const { removals } = inspected.following;
      // A correct space is left in its node, even when it lies in a node
      // after the sign's node (issue #63).
      if (
        scan.text.slice(index + 1, inspected.end) +
            scan.spacingText(removals) ===
          replacement
      ) continue;
      // The space after the mark stays in the mark's node.
      const edit: RunEdit = {
        start: index + 1,
        end: inspected.end,
        replacement,
        bias: "left",
      };
      scan.propose(
        stretch,
        {
          ...edit,
          ...message,
          ...(removals.length === 0 ? {} : { related: removals }),
        },
        edit,
        removals,
      );
    }
    return scan.result();
  });
}

/** Context-sensitive French high-punctuation rules. */
export const HIGH_PUNCTUATION_RULES: readonly RuntimeRule[] = [
  highPunctuationBeforeRule("punctuation.colon.nbsp-before", ":", " "),
  highPunctuationAfterRule("punctuation.colon.space-after", ":"),
  highPunctuationBeforeRule(
    "punctuation.semicolon.nnbsp-before",
    ";",
    " ",
  ),
  highPunctuationAfterRule("punctuation.semicolon.space-after", ";"),
  highPunctuationBeforeRule(
    "punctuation.question.nnbsp-before",
    "?",
    " ",
  ),
  highPunctuationAfterRule("punctuation.question.space-after", "?"),
  highPunctuationBeforeRule(
    "punctuation.exclamation.nnbsp-before",
    "!",
    " ",
  ),
  highPunctuationAfterRule("punctuation.exclamation.space-after", "!"),
] as const;

/** Imprimerie nationale punctuation composition with numeric protections. */
export const IMPRIMERIE_NATIONALE_PUNCTUATION_RULES: readonly RuntimeRule[] = [
  NUMERIC_PROTECTION_RULE,
  ...SAFE_PUNCTUATION_RULES,
  SPACE_AFTER_COMMA_RULE,
  ...HIGH_PUNCTUATION_RULES,
] as const;
