import { OrthotypographyError } from "./errors.ts";
import type {
  Annotation,
  LogicalRun,
  RuleMode,
  RunBias,
  RunEdit,
  RunLocation,
  RunRange,
} from "./model.ts";

/**
 * Execution of rules on the logical run: the view given to rules, and the
 * projection of their results onto pipeline fragments.
 *
 * See docs/conception-suite-logique-v0.1.md.
 */

/** Range local to one pipeline fragment. */
export interface FragmentRange {
  readonly start: number;
  readonly end: number;
}

/** Edit local to one pipeline fragment. */
export interface FragmentEdit extends FragmentRange {
  readonly replacement: string;
  /** Pipeline key of the proposal of this edit, or -1. */
  readonly proposal: number;
  /**
   * Key of a second proposal, or -1: an insertion followed by an edit at the
   * same position of one fragment becomes one fragment edit, which therefore
   * carries at most two proposals.
   */
  readonly mergedProposal: number;
}

/** Location local to one pipeline fragment. */
export interface FragmentLocation extends FragmentRange {
  readonly segmentIndex: number;
}

/** Current pipeline fragment as seen by the run machinery. */
export interface RunFragment {
  readonly value: string;
  readonly protected?: boolean;
  readonly sourceIndex: number;
}

/** A run view with the fragment layout needed to project results. */
export interface RunLayout {
  readonly run: LogicalRun;
  /** Start offset of each fragment, followed by the text length. */
  readonly starts: readonly number[];
}

/** Builds the view of the current fragments for one rule. */
export function buildRun(
  fragments: readonly RunFragment[],
  locale: string,
  mode: RuleMode,
  annotations: readonly Annotation[] = [],
): RunLayout {
  const starts = new Array<number>(fragments.length + 1);
  starts[0] = 0;
  for (let index = 0; index < fragments.length; index++) {
    starts[index + 1] = starts[index] + fragments[index].value.length;
  }
  const protectedRanges: RunRange[] = [];
  const nodeBoundaries: number[] = [];
  for (const [index, fragment] of fragments.entries()) {
    if (
      index === 0 || fragments[index - 1].sourceIndex !== fragment.sourceIndex
    ) {
      nodeBoundaries.push(starts[index]);
    }
    if (!fragment.protected || fragment.value.length === 0) continue;
    const previous = protectedRanges.at(-1);
    if (previous !== undefined && previous.end === starts[index]) {
      protectedRanges[protectedRanges.length - 1] = {
        start: previous.start,
        end: starts[index + 1],
      };
    } else {
      protectedRanges.push({ start: starts[index], end: starts[index + 1] });
    }
  }
  nodeBoundaries.push(starts[fragments.length]);
  const text = fragments.map(({ value }) => value).join("");
  return {
    starts,
    run: {
      text,
      locale,
      mode,
      protectedRanges,
      nodeBoundaries,
      annotations: annotationsByKind(annotations),
    },
  };
}

/** Lists annotations of one kind, computed once per kind and view. */
function annotationsByKind(
  annotations: readonly Annotation[],
): (kind: string) => readonly Annotation[] {
  const byKind = new Map<string, readonly Annotation[]>();
  return (kind) => {
    let list = byKind.get(kind);
    if (list === undefined) {
      list = annotations.filter((annotation) => annotation.kind === kind);
      byKind.set(kind, list);
    }
    return list;
  };
}

/** A committed replacement in run coordinates, before the rule applied it. */
export interface RunChange extends RunRange {
  readonly replacementLength: number;
}

/**
 * Moves annotations through the changes of one rule (design §5).
 *
 * Changes are sorted and do not overlap. A change before an annotation, or an
 * insertion at its start, shifts it; a change inside it, other than an
 * insertion at either end, resizes it; a change that straddles one of its ends
 * removes it. Changes after it, including an insertion at its end, leave it
 * unchanged. Each annotation costs a binary search, so the update is linear up
 * to a logarithmic factor.
 */
export function moveAnnotations(
  annotations: readonly Annotation[],
  changes: readonly RunChange[],
): Annotation[] {
  if (changes.length === 0) return [...annotations];
  const shifts = new Array<number>(changes.length + 1);
  shifts[0] = 0;
  for (let index = 0; index < changes.length; index++) {
    const { start, end, replacementLength } = changes[index];
    shifts[index + 1] = shifts[index] + replacementLength - (end - start);
  }
  // First change that is not before a position: it starts after it, or it
  // starts there and removes text.
  const firstNotBefore = (position: number): number => {
    let low = 0;
    let high = changes.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      const change = changes[middle];
      const before = change.start < position ||
        (change.start === position && change.end === position);
      if (before) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  // First change starting at or after a position.
  const firstFrom = (position: number): number => {
    let low = 0;
    let high = changes.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (changes[middle].start < position) low = middle + 1;
      else high = middle;
    }
    return low;
  };

  const moved: Annotation[] = [];
  for (const annotation of annotations) {
    const inside = firstNotBefore(annotation.start);
    if (inside > 0 && changes[inside - 1].end > annotation.start) continue;
    const after = Math.max(inside, firstFrom(annotation.end));
    if (after > inside && changes[after - 1].end > annotation.end) continue;
    const start = annotation.start + shifts[inside];
    const end = annotation.end + shifts[after];
    if (end < start) continue;
    moved.push({ ...annotation, start, end });
  }
  return moved;
}

/** Index of the first fragment whose end is at or after a position. */
function firstFragmentEndingAtOrAfter(
  starts: readonly number[],
  position: number,
): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (starts[middle + 1] < position) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * Fragment receiving an empty range at a position.
 *
 * A fragment strictly containing the position receives it. At a boundary, the
 * last non-empty fragment ending there (`left`) or the first non-empty one
 * starting there (`right`) receives it, so that text inserted next to a
 * character stays in that character's node. When `edit` is set, a protected
 * fragment on the chosen side makes the position unusable. At the start or end
 * of the run, the other side is used. Empty unprotected fragments receive the
 * range only when no non-empty fragment touches the position, which happens
 * when the run text is empty.
 */
function fragmentAtPosition(
  fragments: readonly RunFragment[],
  starts: readonly number[],
  position: number,
  bias: RunBias,
  edit: boolean,
): number | undefined {
  const first = firstFragmentEndingAtOrAfter(starts, position);
  if (starts[first] < position && position < starts[first + 1]) {
    return edit && fragments[first].protected ? undefined : first;
  }
  const side = (
    direction: RunBias,
    allowEmpty: boolean,
  ): number | undefined | null => {
    let chosen: number | undefined;
    for (
      let index = first;
      index < fragments.length && starts[index] <= position;
      index++
    ) {
      const fragment = fragments[index];
      if (
        fragment.value.length === 0 && (fragment.protected || !allowEmpty)
      ) continue;
      const touches = direction === "left"
        ? starts[index + 1] === position
        : starts[index] === position;
      if (!touches) continue;
      chosen = index;
      if (direction === "right") break;
    }
    if (chosen === undefined) return undefined;
    return edit && fragments[chosen].protected ? null : chosen;
  };
  const other = bias === "left" ? "right" : "left";
  for (const allowEmpty of [false, true]) {
    const preferred = side(bias, allowEmpty);
    if (preferred !== undefined) return preferred ?? undefined;
    const fallback = side(other, allowEmpty);
    if (fallback !== undefined) return fallback ?? undefined;
  }
  return undefined;
}

/**
 * Whether a range touches protected text: a non-empty range overlaps a
 * protected range, or an empty one lies strictly inside it. Protected ranges
 * are sorted and disjoint, so only the first one ending after `start` can
 * match.
 */
function isInsideProtected(
  ranges: readonly RunRange[],
  start: number,
  end: number,
): boolean {
  let low = 0;
  let high = ranges.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (ranges[middle].end <= start) low = middle + 1;
    else high = middle;
  }
  const range = ranges[low];
  if (range === undefined) return false;
  return start === end ? range.start < start : range.start < end;
}

/**
 * Validates a rule's edits and projects them onto fragments.
 *
 * Edits may not overlap, and two edits may share a start only when the first
 * one is an insertion and the second one is not.
 *
 * An edit inside one fragment maps to it. An edit crossing fragments deletes
 * each overlapping part and places the whole replacement in the first
 * (`left`, default) or last (`right`) fragment. An empty edit at a boundary
 * goes to the unprotected fragment on the `bias` side.
 */
export function projectRunEdits(
  ruleId: string,
  fragments: readonly RunFragment[],
  layout: RunLayout,
  edits: readonly RunEdit[],
  /** Proposal key of each edit, by index; -1 or absent for none. */
  proposalOf: readonly number[] = [],
): Map<number, FragmentEdit[]> {
  const { starts, run } = layout;
  const order = edits.map((_, index) => index).sort((left, right) =>
    edits[left].start - edits[right].start || edits[left].end - edits[right].end
  );
  const projected = new Map<number, FragmentEdit[]>();
  const add = (index: number, edit: FragmentEdit): void => {
    const list = projected.get(index) ?? [];
    const last = list.at(-1);
    if (
      last !== undefined && last.start === last.end && last.start === edit.start
    ) {
      // An insertion followed by an edit at the same position of one fragment
      // becomes a single edit, so the fragment never holds two edits sharing a
      // start.
      list[list.length - 1] = {
        start: edit.start,
        end: edit.end,
        replacement: last.replacement + edit.replacement,
        proposal: last.proposal,
        mergedProposal: edit.proposal,
      };
    } else {
      list.push(edit);
    }
    projected.set(index, list);
  };

  for (let position = 0; position < order.length; position++) {
    const edit = edits[order[position]];
    const proposal = proposalOf[order[position]] ?? -1;
    if (
      !Number.isInteger(edit.start) || !Number.isInteger(edit.end) ||
      edit.start < 0 || edit.end < edit.start || edit.end > run.text.length
    ) {
      throw new OrthotypographyError(
        "INVALID_EDIT_RANGE",
        `Rule ${ruleId} returned an invalid edit range: ${edit.start}:${edit.end}`,
        { ruleId },
      );
    }
    const previous = position > 0 ? edits[order[position - 1]] : undefined;
    if (
      previous !== undefined &&
      (edit.start < previous.end ||
        (edit.start === previous.start && edit.start === edit.end))
    ) {
      throw new OrthotypographyError(
        "OVERLAPPING_EDITS",
        `Rule ${ruleId} returned overlapping edits`,
        { ruleId },
      );
    }
    if (isInsideProtected(run.protectedRanges, edit.start, edit.end)) {
      throw new OrthotypographyError(
        "PROTECTED_TEXT_EDIT",
        `Rule ${ruleId} edits protected text`,
        { ruleId },
      );
    }
    const bias = edit.bias ?? "left";

    if (edit.start === edit.end) {
      const index = fragmentAtPosition(
        fragments,
        starts,
        edit.start,
        bias,
        true,
      );
      if (index === undefined) {
        throw new OrthotypographyError(
          "PROTECTED_TEXT_EDIT",
          `Rule ${ruleId} inserts next to protected text`,
          { ruleId },
        );
      }
      const local = edit.start - starts[index];
      add(index, {
        start: local,
        end: local,
        replacement: edit.replacement,
        proposal,
        mergedProposal: -1,
      });
      continue;
    }

    const touched: number[] = [];
    for (
      let index = firstFragmentEndingAtOrAfter(starts, edit.start + 1);
      index < fragments.length && starts[index] < edit.end;
      index++
    ) {
      if (starts[index + 1] > edit.start && starts[index] < starts[index + 1]) {
        touched.push(index);
      }
    }
    const receiver = bias === "left" ? touched[0] : touched.at(-1);
    for (const index of touched) {
      const start = Math.max(edit.start, starts[index]) - starts[index];
      const end = Math.min(edit.end, starts[index + 1]) - starts[index];
      add(index, {
        start,
        end,
        replacement: index === receiver ? edit.replacement : "",
        proposal,
        mergedProposal: -1,
      });
    }
  }
  return projected;
}

/** Projects protected annotations onto fragment-local protection ranges. */
export function projectProtections(
  layout: RunLayout,
  fragments: readonly RunFragment[],
  annotations: readonly Annotation[],
): Map<number, FragmentRange[]> {
  const { starts } = layout;
  const byFragment = new Map<number, FragmentRange[]>();
  const ranges = annotations.filter(({ protect }) => protect === true)
    .sort((left, right) => left.start - right.start);
  for (const range of ranges) {
    for (
      let index = firstFragmentEndingAtOrAfter(starts, range.start + 1);
      index < fragments.length && starts[index] < range.end;
      index++
    ) {
      if (fragments[index].protected) continue;
      const start = Math.max(range.start, starts[index]) - starts[index];
      const end = Math.min(range.end, starts[index + 1]) - starts[index];
      if (end <= start) continue;
      const list: FragmentRange[] = byFragment.get(index) ?? [];
      const previous = list.at(-1);
      if (previous !== undefined && start < previous.end) {
        throw new OrthotypographyError(
          "INVALID_ANNOTATION",
          "Overlapping protected annotations",
        );
      }
      list.push({ start, end });
      byFragment.set(index, list);
    }
  }
  return byFragment;
}

/** Maps a run location onto the fragment that reports it. */
export function locateInFragment(
  ruleId: string,
  fragments: readonly RunFragment[],
  layout: RunLayout,
  location: RunLocation,
): FragmentLocation {
  const { starts, run } = layout;
  if (
    !Number.isInteger(location.start) || !Number.isInteger(location.end) ||
    location.start < 0 || location.end < location.start ||
    location.end > run.text.length
  ) {
    throw new OrthotypographyError(
      "INVALID_DIAGNOSTIC",
      `Rule ${ruleId} returned an invalid diagnostic range: ${location.start}:${location.end}`,
      { ruleId },
    );
  }
  let index: number | undefined;
  if (location.start === location.end) {
    index = fragmentAtPosition(
      fragments,
      starts,
      location.start,
      location.bias ?? "left",
      false,
    );
  } else {
    index = firstFragmentEndingAtOrAfter(starts, location.start + 1);
    while (index < fragments.length && starts[index + 1] <= location.start) {
      index++;
    }
    if (index >= fragments.length || location.end > starts[index + 1]) {
      throw new OrthotypographyError(
        "INVALID_DIAGNOSTIC",
        `Rule ${ruleId} returned a diagnostic crossing fragments`,
        { ruleId },
      );
    }
  }
  if (index === undefined) {
    throw new OrthotypographyError(
      "INVALID_DIAGNOSTIC",
      `Rule ${ruleId} returned an unlocatable diagnostic`,
      { ruleId },
    );
  }
  return {
    segmentIndex: index,
    start: location.start - starts[index],
    end: location.end - starts[index],
  };
}
