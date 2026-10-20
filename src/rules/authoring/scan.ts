import type {
  LogicalRun,
  RuleResult,
  RunDiagnostic,
  RunEdit,
  RunRange,
} from "../../model.ts";
import {
  technicalPatternStarts,
  whitespaceFreeStarts,
} from "../../classify/text-index.ts";
import {
  type Adjacent,
  type Boundary,
  RunStretches,
  spacingCharacters,
  spacingText,
} from "../run-text.ts";

/*
 * Scan primitives shared by the built-in rules
 * (docs/conception-ecriture-regles-v0.1.md, §4).
 *
 * Scans keep the reach they had when the rules ran once per fragment: spacing
 * next to a mark is read within the mark's stretch, and neighboring stretches
 * are only visited to find the adjacent character or the spacing to remove at
 * a node boundary. Indexes are built at most once per rule call, on demand,
 * and a primitive called for one occurrence reads only the spacing around it
 * and a bounded number of characters.
 */

/**
 * Spacing on one side of a position: its range in the position's stretch, the
 * spacing to remove in neighboring stretches (nearest first), and the
 * character beyond it, unless protected text blocks the boundary.
 */
export interface Spacing extends Boundary {
  readonly start: number;
  readonly end: number;
}

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
export class RunScan {
  readonly text: string;
  readonly stretches: RunStretches;
  readonly #proposals: Proposal[] = [];
  #tokenStarts?: Int32Array;
  #technicalStarts?: Int32Array;

  constructor(readonly run: LogicalRun) {
    this.text = run.text;
    this.stretches = new RunStretches(run);
  }

  /**
   * Positions of a mark outside protected text, in text order. Scanning
   * resumes at `resume()` when it returns a position after the last one.
   */
  *occurrences(
    mark: string,
    resume: () => number = () => 0,
  ): Generator<{ index: number; stretch: number }> {
    const { text, stretches } = this;
    let index = text.indexOf(mark);
    while (index !== -1) {
      const stretch = stretches.indexAt(index);
      if (stretches.protectedFlags[stretch]) {
        index = text.indexOf(mark, stretches.ends[stretch]);
        continue;
      }
      yield { index, stretch };
      index = text.indexOf(mark, Math.max(index + 1, resume()));
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

  /**
   * Spacing before `index` or from `index`, in the stretch of that position,
   * continued into neighboring stretches when it reaches a stretch edge.
   */
  spacing(index: number, stretch: number, side: "before" | "after"): Spacing {
    if (side === "before") {
      const start = this.spacingStart(index, stretch);
      const boundary: Boundary = start === this.start(stretch)
        ? this.stretches.precedingBoundary(stretch)
        : { blocked: false, character: this.text[start - 1], removals: [] };
      return { ...boundary, start, end: index };
    }
    const end = this.spacingEnd(index, stretch);
    const boundary: Boundary = end === this.end(stretch)
      ? this.stretches.followingBoundary(stretch)
      : { blocked: false, character: this.text[end], index: end, removals: [] };
    return { ...boundary, start: index, end };
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

  /**
   * Whether the whitespace-free token before a position is technical: it
   * starts with `/`, `./`, or `../`, or contains a URL scheme or `www.`. The
   * token extends into earlier unprotected stretches only while it covers them
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

  /** Text of spacing ranges in neighboring stretches, in text order. */
  spacingText(ranges: readonly RunRange[]): string {
    return spacingText(this.text, ranges);
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
