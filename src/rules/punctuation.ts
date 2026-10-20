import { NUMERIC_PROTECTION_RULE } from "../classify/runtime.ts";
import type { RunEdit, RuntimeRule } from "../model.ts";
import { catalogueRule } from "./catalogue-rule.ts";
import { diagnosticMessage } from "../messages.ts";
import { RunScan } from "./authoring/scan.ts";
import {
  type Exclusion,
  MarkContext,
  markSpacingRule,
} from "./authoring/mark-spacing.ts";

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

function noSpaceBeforeRule(id: string, mark: "," | "."): RuntimeRule {
  const message = diagnosticMessage("spacing.no-space-before", { mark });
  const exclusions: Record<string, Exclusion> = {
    "protected-content": { ensuredBy: "protection" },
  };
  if (mark === ".") {
    // A run of periods is not a sentence period: suspension points follow
    // their own spacing rules, and a space before them may be correct. The
    // scan resumes after the run within the stretch.
    exclusions["period-run"] = {
      skip: ({ scan, index, stretch }) => {
        if (scan.followingCharacter(index + 1, stretch).character !== ".") {
          return false;
        }
        const end = scan.end(stretch);
        let last = index + 1;
        if (last >= end) return true;
        while (last + 1 < end && scan.text[last + 1] === ".") last++;
        return last + 1;
      },
    };
  }
  return markSpacingRule({
    id,
    mark,
    side: "before",
    expected: "",
    span: "spacing-and-mark",
    exclusions,
    message: () => message,
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
    const scan = new RunScan(run);
    for (const { index, stretch } of scan.occurrences(",")) {
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

/*
 * Exclusions of the high-punctuation rules, shared by the spacing before and
 * after each mark. They are checked on both sides of the mark.
 */

/** Protected text on either side of the mark. */
const touchesProtection = ({ before, after }: MarkContext): boolean =>
  before.blocked || after.blocked;

/** No character precedes the mark: it punctuates no preceding word. */
const atStartOfText = ({ before }: MarkContext): boolean =>
  before.character === undefined;

/** The same mark on either side, as in `::` or `;;`. */
const doubledMark = ({ mark, before, after }: MarkContext): boolean =>
  before.character === mark || after.character === mark;

/** A colon followed by a slash, as in a URI scheme. */
const colonSlash = ({ after }: MarkContext): boolean => after.character === "/";

/** The CSS declaration `!important`. */
const importantDeclaration = ({ scan, index }: MarkContext): boolean =>
  /^!important\b/iu.test(scan.text.slice(index, index + 11));

/** A question or exclamation mark next to another one, as in `?!`. */
const expressiveSequence = (context: MarkContext): boolean => {
  const { before, after } = context;
  return doubledMark(context) ||
    (before.character !== undefined && "?!".includes(before.character)) ||
    (after.character !== undefined && "?!".includes(after.character));
};

/** Whether the shared exclusions leave a high-punctuation mark as is. */
function excludedHighPunctuation(context: MarkContext): boolean {
  const mark = context.mark as HighPunctuationMark;
  if (touchesProtection(context) || atStartOfText(context)) return true;
  if (mark === "!" && importantDeclaration(context)) return true;
  if (doubledMark(context)) return true;
  if (mark === ":" && colonSlash(context)) return true;
  return (mark === "?" || mark === "!") && expressiveSequence(context);
}

interface PunctuationLocation {
  readonly index: number;
  readonly stretch: number;
}

/** Nearest character before `start`, stopping at protected text. */
function precedingPunctuationLocation(
  scan: RunScan,
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
  scan: RunScan,
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

/**
 * A neighboring high-punctuation mark of higher rank governs the spacing
 * between both marks, unless its own exclusions leave it as is.
 */
function yieldsToHigherMark(side: "before" | "after") {
  return (context: MarkContext): boolean => {
    const { scan, stretch } = context;
    const mark = context.mark as HighPunctuationMark;
    const neighbor = side === "before"
      ? context.before.character
      : context.after.character;
    if (
      !isHighPunctuationMark(neighbor) ||
      highPunctuationRank(neighbor) <= highPunctuationRank(mark)
    ) return false;
    const location = side === "before"
      ? precedingPunctuationLocation(scan, context.before.start, stretch)
      : followingPunctuationLocation(scan, context.after.end, stretch);
    return location !== undefined &&
      !excludedHighPunctuation(
        new MarkContext(scan, neighbor, location.index, location.stretch),
      );
  };
}

/**
 * Message of a high-punctuation spacing proposal: the space is missing, of
 * the wrong kind, or in excess (issue #79). The expected space is named by its
 * code point, which hosts can translate.
 */
function spacingMessage(side: "before" | "after") {
  return (
    { mark }: MarkContext,
    actual: string,
    expected: string,
  ): ReturnType<typeof diagnosticMessage> => {
    // After a sign at the end of the text, no space is expected.
    if (expected.length === 0) {
      return diagnosticMessage(`spacing.trailing-${side}`, { mark });
    }
    const kind = actual.length === 0
      ? "missing"
      : actual.length > expected.length
      ? "excess"
      : "wrong";
    const space = `U+${
      expected.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")
    }`;
    return diagnosticMessage(`spacing.${kind}-${side}`, { mark, space });
  };
}

/**
 * Exclusions of the shared checks, keyed by the exception that each one
 * implements for a mark.
 */
function sharedExclusions(
  mark: HighPunctuationMark,
  side: "before" | "after",
): Record<string, Exclusion> {
  const exclusions: Record<string, Exclusion> = {
    "protected-content": { skip: touchesProtection },
    "start-of-text": { skip: atStartOfText },
  };
  if (mark === ":") {
    exclusions["technical-syntax"] = {
      skip: (context) =>
        doubledMark(context) || (side === "after" && colonSlash(context)),
    };
    if (side === "before") exclusions.uri = { skip: colonSlash };
  } else if (mark === ";") {
    exclusions["adjacent-punctuation"] = {
      skip: (context) =>
        doubledMark(context) || yieldsToHigherMark(side)(context),
    };
  } else {
    exclusions["expressive-sequence"] = { skip: expressiveSequence };
    if (mark === "!") {
      exclusions["technical-syntax"] = { skip: importantDeclaration };
    }
  }
  if (mark === ":") {
    exclusions["adjacent-punctuation"] = { skip: yieldsToHigherMark(side) };
  }
  // After the mark, URIs and paths are also protected by the numeric
  // classification, on which these rules depend.
  if (side === "after" && (mark === ";" || mark === "?")) {
    exclusions["technical-syntax"] = { ensuredBy: "classification:numeric" };
  }
  return exclusions;
}

function highPunctuationBeforeRule(
  id: string,
  mark: HighPunctuationMark,
  before: " " | " ",
): RuntimeRule {
  const exclusions = sharedExclusions(mark, "before");
  if (mark === ":") {
    // Times, ratios, and ports are protected by the numeric classification.
    exclusions.time = { ensuredBy: "classification:numeric" };
    exclusions.ratio = { ensuredBy: "classification:numeric" };
    exclusions.port = { ensuredBy: "classification:numeric" };
  }
  return markSpacingRule({
    id,
    mark,
    side: "before",
    expected: before,
    exclusions,
    message: spacingMessage("before"),
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
const closingSigns: ReadonlySet<string> = new Set(["»", ")", "]", "”"]);

function highPunctuationAfterRule(
  id: string,
  mark: HighPunctuationMark,
): RuntimeRule {
  return markSpacingRule({
    id,
    mark,
    side: "after",
    expected: " ",
    exclusions: {
      ...sharedExclusions(mark, "after"),
      // The source does not describe a mark followed by suspension points:
      // the spacing is reported for review and left as is.
      "suspension-points": {
        report: ({ scan, after }) =>
          after.character === "…" ||
          (after.character === "." && after.index !== undefined &&
            scan.text.startsWith("...", after.index)),
        messageId: "spacing.space-after.ellipsis",
      },
      "closing-sign": {
        skip: ({ after }) =>
          after.character !== undefined && closingSigns.has(after.character),
      },
      "comma-or-period": {
        skip: ({ after }) => after.character === "," || after.character === ".",
      },
      "end-of-text": {
        expect: ({ after }) => after.character === undefined,
        spacing: "",
      },
    },
    message: spacingMessage("after"),
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
