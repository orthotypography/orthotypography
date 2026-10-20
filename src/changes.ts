import { OrthotypographyError } from "./errors.ts";
import type { TextChange, TextSegment } from "./model.ts";

/** Change accepted by `applyTextChanges`; its identifier is not required. */
type GuardedChange = Omit<TextChange, "id">;

function validateChange(
  segments: readonly TextSegment[],
  change: GuardedChange,
): void {
  if (!Number.isInteger(change.segmentIndex)) {
    throw new OrthotypographyError(
      "INVALID_CHANGE",
      `Invalid change segment index: ${change.segmentIndex}`,
    );
  }
  const segment = segments[change.segmentIndex];
  if (segment === undefined) {
    throw new OrthotypographyError(
      "INVALID_CHANGE",
      `Missing source segment ${change.segmentIndex}`,
    );
  }
  if (change.segmentId !== undefined && change.segmentId !== segment.id) {
    throw new OrthotypographyError(
      "INVALID_CHANGE",
      `Change segment ID ${change.segmentId} does not match source segment ${change.segmentIndex}`,
    );
  }
  if (segment.protected) {
    throw new OrthotypographyError(
      "INVALID_CHANGE",
      `Change targets protected segment ${change.segmentIndex}`,
      { segmentIndex: change.segmentIndex },
    );
  }
  if (
    !Number.isInteger(change.start) || !Number.isInteger(change.end) ||
    change.start < 0 || change.end < change.start ||
    change.end > segment.value.length
  ) {
    throw new OrthotypographyError(
      "INVALID_CHANGE",
      `Invalid change range in segment ${change.segmentIndex}`,
      { segmentIndex: change.segmentIndex },
    );
  }
  if (segment.value.slice(change.start, change.end) !== change.expected) {
    throw new OrthotypographyError(
      "STALE_CHANGE",
      `Stale change in segment ${change.segmentIndex}`,
      { segmentIndex: change.segmentIndex },
    );
  }
}

function applySegmentChanges(
  value: string,
  changes: readonly GuardedChange[],
  segmentIndex: number,
): string {
  const ordered = [...changes].sort((left, right) =>
    left.start - right.start || left.end - right.end
  );
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (current.start < previous.end || current.start === previous.start) {
      throw new OrthotypographyError(
        "INVALID_CHANGE",
        `Overlapping changes in segment ${segmentIndex}`,
        { segmentIndex },
      );
    }
  }

  // The result is assembled in one pass, so that many changes in one segment
  // stay linear (issue #80).
  const parts: string[] = [];
  let cursor = 0;
  for (const change of ordered) {
    parts.push(value.slice(cursor, change.start), change.replacement);
    cursor = change.end;
  }
  parts.push(value.slice(cursor));
  return parts.join("");
}

/** Applies guarded source-coordinate changes to one string. */
export function applyTextChanges(
  source: string,
  changes: readonly GuardedChange[],
): string;

/** Applies guarded source-coordinate changes to their source segments. */
export function applyTextChanges(
  source: readonly TextSegment[],
  changes: readonly GuardedChange[],
): readonly TextSegment[];

export function applyTextChanges(
  source: string | readonly TextSegment[],
  changes: readonly GuardedChange[],
): string | readonly TextSegment[] {
  const stringInput = typeof source === "string";
  const segments: readonly TextSegment[] = stringInput
    ? [{ value: source }]
    : source;
  const bySegment = new Map<number, GuardedChange[]>();

  for (const change of changes) {
    validateChange(segments, change);
    const existing = bySegment.get(change.segmentIndex) ?? [];
    existing.push(change);
    bySegment.set(change.segmentIndex, existing);
  }

  const output = segments.map((segment, segmentIndex): TextSegment => {
    const segmentChanges = bySegment.get(segmentIndex);
    if (segmentChanges === undefined) return segment;
    return {
      ...segment,
      value: applySegmentChanges(segment.value, segmentChanges, segmentIndex),
    };
  });
  return stringInput ? output[0].value : output;
}
