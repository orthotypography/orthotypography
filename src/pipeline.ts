import { RULES } from "./catalogue/rules.ts";
import {
  buildRun,
  type FragmentEdit,
  type FragmentLocation,
  type FragmentRange,
  locateInFragment,
  moveAnnotations,
  projectProtections,
  projectRunEdits,
  type RunChange,
} from "./run.ts";
import {
  type Annotation,
  type DiagnosticLocation,
  type PipelineResult,
  RULE_PHASES,
  type RuleDiagnostic,
  type RuleMode,
  type RunEdit,
  type RuntimeRule,
  type TextChange,
  type TextSegment,
} from "./model.ts";

export interface PipelineOptions {
  readonly locale: string;
  readonly mode?: RuleMode;
}

interface PipelineSegment extends TextSegment {
  readonly sourceIndex: number;
  readonly sourceStart: number;
}

interface LedgerPiece {
  readonly value: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly ruleIds: readonly string[];
}

interface ChangeLedger {
  readonly source: TextSegment;
  pieces: LedgerPiece[];
}

function ledgerValue(ledger: ChangeLedger): string {
  return ledger.pieces.map(({ value }) => value).join("");
}

function addRuleIds(
  pieces: readonly LedgerPiece[],
  ruleId: string,
): readonly string[] {
  const ids = new Set<string>();
  for (const piece of pieces) {
    for (const id of piece.ruleIds) ids.add(id);
  }
  ids.add(ruleId);
  return [...ids];
}

function mergeRuleIds(pieces: readonly LedgerPiece[]): readonly string[] {
  const ids = new Set<string>();
  for (const piece of pieces) {
    for (const id of piece.ruleIds) ids.add(id);
  }
  return [...ids];
}

function coalesceLedgerPieces(pieces: readonly LedgerPiece[]): LedgerPiece[] {
  const result: LedgerPiece[] = [];
  for (const piece of pieces) {
    const previous = result.at(-1);
    const bothUnchanged = previous?.ruleIds.length === 0 &&
      piece.ruleIds.length === 0;
    const bothChanged = (previous?.ruleIds.length ?? 0) > 0 &&
      piece.ruleIds.length > 0;
    if (
      previous !== undefined && previous.sourceEnd === piece.sourceStart &&
      (bothUnchanged || bothChanged)
    ) {
      result[result.length - 1] = {
        value: previous.value + piece.value,
        sourceStart: previous.sourceStart,
        sourceEnd: piece.sourceEnd,
        ruleIds: bothChanged ? mergeRuleIds([previous, piece]) : [],
      };
    } else {
      result.push(piece);
    }
  }
  return result;
}

function expandChangedBoundaries(
  pieces: readonly LedgerPiece[],
  edit: FragmentEdit,
): FragmentEdit {
  let offset = 0;
  let start = edit.start;
  let end = edit.end;
  let prefix = "";
  let suffix = "";

  for (const piece of pieces) {
    const pieceStart = offset;
    const pieceEnd = offset + piece.value.length;
    if (
      piece.ruleIds.length > 0 && start > pieceStart && start < pieceEnd
    ) {
      prefix = piece.value.slice(0, start - pieceStart);
      start = pieceStart;
    }
    if (piece.ruleIds.length > 0 && end > pieceStart && end < pieceEnd) {
      suffix = piece.value.slice(end - pieceStart);
      end = pieceEnd;
    }
    offset = pieceEnd;
  }

  return { start, end, replacement: prefix + edit.replacement + suffix };
}

function splitUnchangedPieceAt(
  pieces: LedgerPiece[],
  target: number,
): void {
  let offset = 0;
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index];
    const end = offset + piece.value.length;
    if (target > offset && target < end) {
      if (piece.ruleIds.length > 0) {
        throw new Error("Cannot split changed ledger piece");
      }
      const local = target - offset;
      const sourceMiddle = piece.sourceStart + local;
      pieces.splice(index, 1, {
        value: piece.value.slice(0, local),
        sourceStart: piece.sourceStart,
        sourceEnd: sourceMiddle,
        ruleIds: [],
      }, {
        value: piece.value.slice(local),
        sourceStart: sourceMiddle,
        sourceEnd: piece.sourceEnd,
        ruleIds: [],
      });
      return;
    }
    offset = end;
  }
}

function ledgerBoundaryIndex(
  pieces: readonly LedgerPiece[],
  target: number,
  side: "start" | "end",
): number {
  let offset = 0;
  for (let index = 0; index <= pieces.length; index++) {
    if (offset === target) {
      if (side === "start") return index;
      let afterEmpty = index;
      while (
        afterEmpty < pieces.length && pieces[afterEmpty].value.length === 0
      ) afterEmpty++;
      return afterEmpty;
    }
    const piece = pieces[index];
    if (piece !== undefined) offset += piece.value.length;
  }
  throw new Error(`Unlocatable ledger boundary: ${target}`);
}

function sourcePositionAt(
  pieces: readonly LedgerPiece[],
  boundary: number,
): number {
  return pieces[boundary]?.sourceStart ?? pieces[boundary - 1]?.sourceEnd ?? 0;
}

/**
 * Combines the edits of one rule that fall in the same changed piece.
 *
 * An edit with a bound strictly inside a changed piece is widened to the whole
 * piece. Applied one by one, N edits inside one piece of length N would each
 * copy the piece, at a quadratic cost. Edits whose widened ranges overlap are
 * therefore combined first into one edit, from the start of the first to the
 * end of the last, whose replacement keeps the ledger text between them. The
 * combined edit is widened once and gives the same pieces as the sequence of
 * edits, in time linear in the edits and the text they span.
 *
 * Edits use the ledger coordinates that precede the rule and do not overlap.
 */
function combineEditsInChangedPieces(
  pieces: readonly LedgerPiece[],
  offsets: readonly number[],
  edits: readonly FragmentEdit[],
): FragmentEdit[] {
  const ordered = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  // Index of the piece that contains a position strictly, or -1.
  const containing = (position: number): number => {
    let low = 0;
    let high = pieces.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >>> 1;
      if (offsets[middle] < position) low = middle;
      else high = middle - 1;
    }
    return offsets[low] < position && position < offsets[low + 1] ? low : -1;
  };
  const widenedStart = (position: number): number => {
    const index = containing(position);
    return index >= 0 && pieces[index].ruleIds.length > 0
      ? offsets[index]
      : position;
  };
  const widenedEnd = (position: number): number => {
    const index = containing(position);
    return index >= 0 && pieces[index].ruleIds.length > 0
      ? offsets[index + 1]
      : position;
  };

  const combined: FragmentEdit[] = [];
  let text: string | undefined;
  let index = 0;
  while (index < ordered.length) {
    let last = index;
    let reach = widenedEnd(ordered[index].end);
    while (
      last + 1 < ordered.length && widenedStart(ordered[last + 1].start) < reach
    ) {
      last++;
      reach = Math.max(reach, widenedEnd(ordered[last].end));
    }
    if (last === index) {
      combined.push(ordered[index]);
    } else {
      text ??= pieces.map(({ value }) => value).join("");
      const parts: string[] = [ordered[index].replacement];
      for (let next = index + 1; next <= last; next++) {
        parts.push(
          text.slice(ordered[next - 1].end, ordered[next].start),
          ordered[next].replacement,
        );
      }
      combined.push({
        start: ordered[index].start,
        end: ordered[last].end,
        replacement: parts.join(""),
      });
    }
    index = last + 1;
  }
  return combined;
}

/**
 * Applies one rule's edits to a source ledger.
 *
 * Edits use the ledger coordinates that precede the rule. Edits in the same
 * changed piece are combined first (see `combineEditsInChangedPieces`). They
 * are then applied from right to left with the same expansion, splitting, and
 * coalescing as single edits, but each one only rewrites the window of pieces
 * around it. Positions left of the current edit are therefore never
 * recomputed, and the cost stays linear in the number of edits and pieces.
 */
function applyLedgerEdits(
  ledger: ChangeLedger,
  edits: readonly FragmentEdit[],
  ruleId: string,
): void {
  if (edits.length === 0) return;
  const left = ledger.pieces;
  const offsets = new Array<number>(left.length + 1);
  offsets[0] = 0;
  for (let index = 0; index < left.length; index++) {
    offsets[index + 1] = offsets[index] + left[index].value.length;
  }
  let leftCount = left.length;
  // Pieces right of the current edit, leftmost last.
  const right: LedgerPiece[] = [];
  let length = offsets[leftCount];

  for (const edit of edits) validateRange(edit.start, edit.end, length, "edit");
  const combined = combineEditsInChangedPieces(left, offsets, edits);
  for (let editIndex = combined.length - 1; editIndex >= 0; editIndex--) {
    const edit = combined[editIndex];

    // Pieces that contain or follow the edit start, then the left neighbour.
    const window: LedgerPiece[] = [];
    while (
      leftCount > 0 &&
      (offsets[leftCount - 1] >= edit.start || offsets[leftCount] > edit.start)
    ) window.push(left[--leftCount]);
    if (leftCount > 0) window.push(left[--leftCount]);
    window.reverse();
    const base = offsets[leftCount];

    // Pieces before the edit end, empty pieces at the end, then one neighbour.
    let position = base;
    for (const piece of window) position += piece.value.length;
    while (right.length > 0) {
      const piece = right[right.length - 1];
      if (
        position < edit.end ||
        (position === edit.end && piece.value.length === 0)
      ) {
        window.push(piece);
        right.pop();
        position += piece.value.length;
      } else {
        break;
      }
    }
    const neighbour = right.pop();
    if (neighbour !== undefined) window.push(neighbour);

    const local = expandChangedBoundaries(window, {
      start: edit.start - base,
      end: edit.end - base,
      replacement: edit.replacement,
    });
    splitUnchangedPieceAt(window, local.start);
    splitUnchangedPieceAt(window, local.end);
    const startIndex = ledgerBoundaryIndex(window, local.start, "start");
    const endIndex = ledgerBoundaryIndex(window, local.end, "end");
    const removed = window.slice(startIndex, endIndex);
    let sourceStart = sourcePositionAt(window, startIndex);
    let sourceEnd = sourceStart;
    if (removed.length > 0) {
      sourceStart = Infinity;
      sourceEnd = -Infinity;
      for (const piece of removed) {
        sourceStart = Math.min(sourceStart, piece.sourceStart);
        sourceEnd = Math.max(sourceEnd, piece.sourceEnd);
      }
    }
    window.splice(startIndex, endIndex - startIndex, {
      value: local.replacement,
      sourceStart,
      sourceEnd,
      ruleIds: addRuleIds(removed, ruleId),
    });
    length += local.replacement.length - (local.end - local.start);

    const merged = coalesceLedgerPieces(window);
    for (let index = merged.length - 1; index >= 0; index--) {
      right.push(merged[index]);
    }
  }

  right.reverse();
  ledger.pieces = left.slice(0, leftCount).concat(right);
}

function applyEdits(
  value: string,
  edits: readonly FragmentEdit[],
): string {
  // Edits are validated from right to left, in the order they would be
  // applied one by one, then assembled in a single left-to-right pass so that
  // the cost stays linear in the value length and the number of edits.
  const ordered = [...edits].sort((left, right) => right.start - left.start);
  let previousStart = value.length + 1;
  for (const edit of ordered) {
    validateRange(edit.start, edit.end, value.length, "edit");
    if (edit.end > previousStart) throw new Error("Overlapping rule edits");
    previousStart = edit.start;
  }
  const parts: string[] = [];
  let cursor = 0;
  for (let index = ordered.length - 1; index >= 0; index--) {
    const edit = ordered[index];
    parts.push(value.slice(cursor, edit.start), edit.replacement);
    cursor = edit.end;
  }
  parts.push(value.slice(cursor));
  return parts.join("");
}

function ledgerChanges(ledgers: readonly ChangeLedger[]): TextChange[] {
  const changes: TextChange[] = [];
  for (let segmentIndex = 0; segmentIndex < ledgers.length; segmentIndex++) {
    const ledger = ledgers[segmentIndex];
    const segmentChanges: TextChange[] = [];
    for (const piece of ledger.pieces) {
      if (piece.ruleIds.length === 0) continue;
      const expected = ledger.source.value.slice(
        piece.sourceStart,
        piece.sourceEnd,
      );
      if (expected === piece.value) continue;
      segmentChanges.push({
        segmentIndex,
        ...(ledger.source.id === undefined
          ? {}
          : { segmentId: ledger.source.id }),
        start: piece.sourceStart,
        end: piece.sourceEnd,
        expected,
        replacement: piece.value,
        ruleIds: piece.ruleIds,
      });
    }
    for (let index = 1; index < segmentChanges.length; index++) {
      if (segmentChanges[index].start < segmentChanges[index - 1].end) {
        throw new Error(
          `Overlapping source changes in segment ${segmentIndex}`,
        );
      }
    }
    const parts: string[] = [];
    let cursor = 0;
    for (const change of segmentChanges) {
      if (
        ledger.source.value.slice(change.start, change.end) !== change.expected
      ) {
        throw new Error(`Invalid expected value in segment ${segmentIndex}`);
      }
      parts.push(
        ledger.source.value.slice(cursor, change.start),
        change.replacement,
      );
      cursor = change.end;
    }
    parts.push(ledger.source.value.slice(cursor));
    if (parts.join("") !== ledgerValue(ledger)) {
      throw new Error(`Source changes diverged for segment ${segmentIndex}`);
    }
    for (const change of segmentChanges) changes.push(change);
  }
  return changes;
}

function phaseIndex(rule: RuntimeRule): number {
  return RULE_PHASES.indexOf(rule.phase);
}

function splitProtectedRanges(
  segment: PipelineSegment,
  protections: readonly FragmentRange[],
): readonly PipelineSegment[] {
  if (protections.length === 0) return [segment];

  const ordered = [...protections].sort((left, right) =>
    left.start - right.start
  );
  const result: PipelineSegment[] = [];
  let cursor = 0;

  for (const protection of ordered) {
    if (
      !Number.isInteger(protection.start) ||
      !Number.isInteger(protection.end) ||
      protection.start < cursor ||
      protection.start < 0 ||
      protection.end <= protection.start ||
      protection.end > segment.value.length
    ) {
      throw new Error(
        `Invalid protection range: ${protection.start}:${protection.end}`,
      );
    }
    if (cursor < protection.start) {
      result.push({
        ...segment,
        value: segment.value.slice(cursor, protection.start),
        sourceStart: segment.sourceStart + cursor,
      });
    }
    result.push({
      ...segment,
      value: segment.value.slice(protection.start, protection.end),
      protected: true,
      sourceStart: segment.sourceStart + protection.start,
    });
    cursor = protection.end;
  }

  if (cursor < segment.value.length) {
    result.push({
      ...segment,
      value: segment.value.slice(cursor),
      sourceStart: segment.sourceStart + cursor,
    });
  }
  return result;
}

function validateRange(
  start: number,
  end: number,
  length: number,
  label: string,
): void {
  if (
    !Number.isInteger(start) || !Number.isInteger(end) || start < 0 ||
    end < start || end > length
  ) {
    throw new Error(`Invalid ${label} range: ${start}:${end}`);
  }
}

/** Offset of each runtime fragment inside its source segment. */
function fragmentOffsets(segments: readonly PipelineSegment[]): number[] {
  const running = new Map<number, number>();
  return segments.map((segment) => {
    const offset = running.get(segment.sourceIndex) ?? 0;
    running.set(segment.sourceIndex, offset + segment.value.length);
    return offset;
  });
}

const pieceOffsetCache = new WeakMap<readonly LedgerPiece[], number[]>();

/** Cumulative piece offsets of a ledger snapshot, computed once. */
function pieceOffsets(pieces: readonly LedgerPiece[]): number[] {
  let offsets = pieceOffsetCache.get(pieces);
  if (offsets === undefined) {
    offsets = new Array<number>(pieces.length + 1);
    offsets[0] = 0;
    for (let index = 0; index < pieces.length; index++) {
      offsets[index + 1] = offsets[index] + pieces[index].value.length;
    }
    pieceOffsetCache.set(pieces, offsets);
  }
  return offsets;
}

/**
 * Index of the non-empty piece that contains a ledger position or starts at
 * it, or the piece count at the end of the text.
 */
function pieceStartingAt(offsets: readonly number[], position: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle + 1] > position) high = middle;
    else low = middle + 1;
  }
  return low;
}

/**
 * Index of the non-empty piece that contains a ledger position or ends at it,
 * or -1 at the start of the text.
 */
function pieceEndingAt(offsets: readonly number[], position: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle] >= position) high = middle;
    else low = middle + 1;
  }
  return low - 1;
}

/**
 * Source range of a ledger range.
 *
 * In an unchanged piece a position maps exactly. In a piece produced by a
 * rule, a start maps to the piece's source start and an end to its source end,
 * so that a range always covers its subject in the source (design of #26,
 * § 6). An empty range at the edge of an unchanged piece maps through that
 * piece, the earlier one first, so that a position next to a change keeps its
 * exact source position.
 */
function sourceRange(
  pieces: readonly LedgerPiece[],
  start: number,
  end: number,
): { readonly start: number; readonly end: number } {
  const offsets = pieceOffsets(pieces);
  const exact = (index: number, position: number): number =>
    pieces[index].sourceStart + position - offsets[index];
  const unchanged = (index: number): boolean =>
    pieces[index] !== undefined && pieces[index].ruleIds.length === 0;
  const first = pieceStartingAt(offsets, start);
  const last = pieceEndingAt(offsets, end);
  if (start === end) {
    if (unchanged(last)) {
      return { start: exact(last, start), end: exact(last, start) };
    }
    if (unchanged(first)) {
      return { start: exact(first, start), end: exact(first, start) };
    }
  }
  const sourceStart = first >= pieces.length
    ? pieces.at(-1)?.sourceEnd ?? 0
    : unchanged(first)
    ? exact(first, start)
    : pieces[first].sourceStart;
  const sourceEnd = last < 0
    ? pieces[0]?.sourceStart ?? 0
    : unchanged(last)
    ? exact(last, end)
    : pieces[last].sourceEnd;
  return { start: sourceStart, end: Math.max(sourceStart, sourceEnd) };
}

function diagnosticLocation(
  location: FragmentLocation,
  segments: readonly PipelineSegment[],
  runtimeOffsets: readonly number[],
  sourceSegments: readonly TextSegment[],
  ledgers: readonly ChangeLedger[],
): DiagnosticLocation {
  const segment = segments[location.segmentIndex];
  if (segment === undefined) {
    throw new Error(`Invalid diagnostic segment: ${location.segmentIndex}`);
  }
  validateRange(
    location.start,
    location.end,
    segment.value.length,
    "diagnostic",
  );

  const { pieces } = ledgers[segment.sourceIndex];
  const runtimeOffset = runtimeOffsets[location.segmentIndex];
  const source = sourceSegments[segment.sourceIndex];
  const { start, end } = sourceRange(
    pieces,
    runtimeOffset + location.start,
    runtimeOffset + location.end,
  );
  return {
    segmentIndex: segment.sourceIndex,
    ...(source.id === undefined ? {} : { segmentId: source.id }),
    segmentValue: source.value,
    start,
    end,
  };
}

/** Fragment outcome of one rule, before it is committed. */
interface FragmentPlan {
  readonly edits: readonly FragmentEdit[];
  readonly protections: readonly FragmentRange[];
}

/** Diagnostic located on runtime fragments, before source projection. */
interface LocatedDiagnostic {
  readonly location: FragmentLocation;
  readonly message: string;
  readonly replacement?: string;
  readonly related?: readonly FragmentLocation[];
}

/** Applies a rule once to the logical run and projects its result. */
function planRule(
  rule: RuntimeRule,
  segments: readonly PipelineSegment[],
  locale: string,
  mode: RuleMode,
  stored: readonly Annotation[],
  plans: (FragmentPlan | undefined)[],
  diagnostics: LocatedDiagnostic[],
): readonly Annotation[] {
  const id = rule.id;
  const layout = buildRun(segments, locale, mode, stored);
  const result = rule.apply(layout.run);
  // Edits belong to the diagnostics they correct. They are validated in every
  // mode, so that a proposal is checked whether or not it is applied, and
  // applied only in fix mode.
  const proposed: RunEdit[] = [];
  for (const diagnostic of result.diagnostics ?? []) {
    for (const edit of diagnostic.edits ?? []) proposed.push(edit);
  }
  const annotations = result.annotations ?? [];
  if (annotations.length > 0) {
    if (rule.phase !== "classify") {
      throw new Error(`Rule ${id} annotates outside the classify phase`);
    }
    if (proposed.length > 0) {
      throw new Error(`Rule ${id} cannot transform and protect in one pass`);
    }
    for (const annotation of annotations) {
      validateRange(
        annotation.start,
        annotation.end,
        layout.run.text.length,
        "annotation",
      );
      if (
        typeof annotation.kind !== "string" || annotation.kind.length === 0 ||
        Object.values(annotation.data ?? {}).some((value) =>
          typeof value !== "string"
        )
      ) {
        throw new Error(`Rule ${id} returned an invalid annotation`);
      }
    }
  }
  const projected = projectRunEdits(id, segments, layout, proposed);
  const edited = mode === "fix" ? projected : new Map<number, FragmentEdit[]>();
  const protections = projectProtections(layout, segments, annotations);
  for (const [segmentIndex, segment] of segments.entries()) {
    plans.push(
      segment.protected ? undefined : {
        edits: edited.get(segmentIndex) ?? [],
        protections: protections.get(segmentIndex) ?? [],
      },
    );
  }
  for (const diagnostic of result.diagnostics ?? []) {
    diagnostics.push({
      location: locateInFragment(id, segments, layout, diagnostic),
      message: diagnostic.message,
      ...(diagnostic.replacement === undefined
        ? {}
        : { replacement: diagnostic.replacement }),
      ...(diagnostic.related === undefined ? {} : {
        related: diagnostic.related.map((related) =>
          locateInFragment(id, segments, layout, related)
        ),
      }),
    });
  }
  return annotations;
}

const catalogueIds: ReadonlySet<string> = new Set(RULES.map(({ id }) => id));

/**
 * Orders executable rules by phase and dependencies.
 *
 * The function rejects IDs that are neither in the catalogue nor prefixed with
 * `x-`, unknown phases, duplicate IDs, missing dependencies, backward phase
 * dependencies, and dependency cycles before any text is touched.
 */
export function compilePipeline(
  runtimeRules: readonly RuntimeRule[],
): readonly RuntimeRule[] {
  const byId = new Map<string, RuntimeRule>();
  for (const rule of runtimeRules) {
    if (typeof rule.id !== "string" || rule.id.length === 0) {
      throw new Error("Runtime rule without an ID");
    }
    if (!rule.id.startsWith("x-") && !catalogueIds.has(rule.id)) {
      throw new Error(
        `Rule ${rule.id} is not in the catalogue; use an ID prefixed with x-`,
      );
    }
    if (!RULE_PHASES.includes(rule.phase)) {
      throw new Error(`Rule ${rule.id} has an unknown phase: ${rule.phase}`);
    }
  }
  for (const rule of runtimeRules) {
    if (byId.has(rule.id)) {
      throw new Error(`Duplicate runtime rule: ${rule.id}`);
    }
    byId.set(rule.id, rule);
  }

  for (const rule of runtimeRules) {
    for (const dependency of rule.dependsOn ?? []) {
      const dependencyRule = byId.get(dependency);
      if (dependencyRule === undefined) {
        throw new Error(
          `Missing dependency ${dependency} for ${rule.id}`,
        );
      }
      if (phaseIndex(dependencyRule) > phaseIndex(rule)) {
        throw new Error(
          `Backward phase dependency ${dependency} for ${rule.id}`,
        );
      }
    }
  }

  const ordered: RuntimeRule[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (rule: RuntimeRule): void => {
    const id = rule.id;
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Rule dependency cycle at ${id}`);

    visiting.add(id);
    for (const dependency of rule.dependsOn ?? []) {
      const dependencyRule = byId.get(dependency);
      if (dependencyRule === undefined) {
        throw new Error(`Missing dependency ${dependency} for ${id}`);
      }
      visit(dependencyRule);
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(rule);
  };

  const byPhase = [...runtimeRules].sort((left, right) =>
    phaseIndex(left) - phaseIndex(right)
  );
  for (const rule of byPhase) visit(rule);
  return ordered;
}

/** Runs pure atomic rules on text segments while preserving protected nodes. */
export function runPipeline(
  input: string | readonly TextSegment[],
  runtimeRules: readonly RuntimeRule[],
  options: PipelineOptions,
): PipelineResult {
  const sourceSegments: readonly TextSegment[] = typeof input === "string"
    ? [{ value: input }]
    : input.map((segment) => ({ ...segment }));
  const ids = new Set<string>();
  for (const segment of sourceSegments) {
    if (segment.id === undefined) continue;
    if (segment.id.length === 0 || ids.has(segment.id)) {
      throw new Error(`Invalid or duplicate source segment ID: ${segment.id}`);
    }
    ids.add(segment.id);
  }
  const segments: PipelineSegment[] = sourceSegments.map((segment, index) => ({
    ...segment,
    sourceIndex: index,
    sourceStart: 0,
  }));
  const ledgers: ChangeLedger[] = sourceSegments.map((source) => ({
    source,
    pieces: [{
      value: source.value,
      sourceStart: 0,
      sourceEnd: source.value.length,
      ruleIds: [],
    }],
  }));
  const diagnostics: RuleDiagnostic[] = [];
  const appliedRuleIds: string[] = [];
  const orderedRules = compilePipeline(runtimeRules);
  // Annotations of classify rules, kept in current run coordinates.
  let annotations: Annotation[] = [];

  for (const rule of orderedRules) {
    if (!rule.locales.includes(options.locale)) continue;
    const mode = options.mode ?? rule.defaultMode;
    const diagnosticLedgers = ledgers.map(({ source, pieces }) => ({
      source,
      pieces: [...pieces],
    }));
    appliedRuleIds.push(rule.id);
    const plans: (FragmentPlan | undefined)[] = [];
    const ruleDiagnostics: LocatedDiagnostic[] = [];
    const added = planRule(
      rule,
      segments,
      options.locale,
      mode,
      annotations,
      plans,
      ruleDiagnostics,
    );

    const nextSegments: PipelineSegment[] = [];
    const runtimeOffsets = fragmentOffsets(segments);
    const ledgerEdits = new Map<number, FragmentEdit[]>();
    const locate = (location: FragmentLocation) =>
      diagnosticLocation(
        location,
        segments,
        runtimeOffsets,
        sourceSegments,
        diagnosticLedgers,
      );
    const report = (diagnostic: LocatedDiagnostic): void => {
      diagnostics.push({
        ...locate(diagnostic.location),
        ruleId: rule.id,
        message: diagnostic.message,
        ...(diagnostic.replacement === undefined
          ? {}
          : { replacement: diagnostic.replacement }),
        ...(diagnostic.related === undefined ? {} : {
          related: diagnostic.related.map(locate),
        }),
      });
    };
    const runChanges: RunChange[] = [];
    let fragmentStart = 0;
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      const plan = plans[segmentIndex];
      const start = fragmentStart;
      fragmentStart += segment.value.length;
      if (plan === undefined) {
        nextSegments.push(segment);
        continue;
      }

      const edits = plan.edits;
      if (annotations.length > 0) {
        for (const edit of edits) {
          runChanges.push({
            start: start + edit.start,
            end: start + edit.end,
            replacementLength: edit.replacement.length,
          });
        }
      }
      const value = edits.length === 0
        ? segment.value
        : applyEdits(segment.value, edits);
      if (edits.length > 0) {
        const sourceEdits = ledgerEdits.get(segment.sourceIndex) ?? [];
        const nodeOffset = runtimeOffsets[segmentIndex];
        for (const edit of edits) {
          sourceEdits.push({
            start: nodeOffset + edit.start,
            end: nodeOffset + edit.end,
            replacement: edit.replacement,
          });
        }
        ledgerEdits.set(segment.sourceIndex, sourceEdits);
      }
      const appliedSegment: PipelineSegment = { ...segment, value };
      for (
        const fragment of splitProtectedRanges(appliedSegment, plan.protections)
      ) nextSegments.push(fragment);
    }
    for (const diagnostic of ruleDiagnostics) report(diagnostic);
    for (const [sourceIndex, edits] of ledgerEdits) {
      applyLedgerEdits(ledgers[sourceIndex], edits, rule.id);
    }
    const reconstructed = sourceSegments.map(() => [] as string[]);
    for (const segment of nextSegments) {
      reconstructed[segment.sourceIndex].push(segment.value);
    }
    for (
      let sourceIndex = 0;
      sourceIndex < sourceSegments.length;
      sourceIndex++
    ) {
      if (
        ledgerValue(ledgers[sourceIndex]) !==
          reconstructed[sourceIndex].join("")
      ) {
        throw new Error(`Change ledger diverged for segment ${sourceIndex}`);
      }
    }
    segments.length = 0;
    for (const segment of nextSegments) segments.push(segment);
    if (runChanges.length > 0) {
      runChanges.sort((left, right) =>
        left.start - right.start || left.end - right.end
      );
      annotations = moveAnnotations(annotations, runChanges);
    }
    if (added.length > 0) {
      annotations = [...annotations, ...added].sort((left, right) =>
        left.start - right.start || left.end - right.end
      );
    }
  }

  return {
    value: segments.map((segment) => segment.value).join(""),
    segments: segments.map(({ id, value, protected: isProtected }) => ({
      ...(id === undefined ? {} : { id }),
      value,
      ...(isProtected === undefined ? {} : { protected: isProtected }),
    })),
    changes: ledgerChanges(ledgers),
    diagnostics,
    appliedRuleIds,
  };
}
