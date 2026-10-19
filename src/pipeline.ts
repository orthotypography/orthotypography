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
  type ProposalGroup,
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
  /**
   * Provenance token of a changed piece (see `Provenance`), or -1 for an
   * unchanged piece. Always present, so that every piece has the same shape.
   */
  readonly token: number;
}

/** Disjoint sets over dense integer keys, with path halving and union by size. */
class DisjointSets {
  readonly #parent: number[] = [];
  readonly #size: number[] = [];

  add(): number {
    const key = this.#parent.length;
    this.#parent.push(key);
    this.#size.push(1);
    return key;
  }

  find(key: number): number {
    const parent = this.#parent;
    while (parent[key] !== key) {
      parent[key] = parent[parent[key]];
      key = parent[key];
    }
    return key;
  }

  union(left: number, right: number): void {
    let a = this.find(left);
    let b = this.find(right);
    if (a === b) return;
    if (this.#size[a] < this.#size[b]) [a, b] = [b, a];
    this.#parent[b] = a;
    this.#size[a] += this.#size[b];
  }
}

/**
 * Links between applied proposals, changed ledger pieces, and diagnostics.
 *
 * Each changed piece carries a token. Changed pieces are never split, only
 * merged, so the token sets of `pieces` map one to one to the changed pieces of
 * the final ledger. `proposals` holds the proposal groups. Both structures
 * grow with each applied edit and merge in near-constant time, so tracking
 * provenance keeps the pass linear.
 */
class Provenance {
  readonly pieces = new DisjointSets();
  readonly proposals = new DisjointSets();
  /** Proposal that created each token. */
  readonly tokenProposal: number[] = [];
  /** Index of each proposal's diagnostic in the result. */
  readonly proposalDiagnostic: number[] = [];
  /**
   * Tokens created by the edits of each proposal, as linked lists in flat
   * arrays: the head entry of each proposal, then each entry's token and next
   * entry (-1 ends a list). Most proposals have one token, so this avoids one
   * array per proposal.
   */
  readonly #head: number[] = [];
  readonly #entryToken: number[] = [];
  readonly #entryNext: number[] = [];

  addProposal(diagnosticIndex: number): number {
    const key = this.proposals.add();
    this.proposalDiagnostic.push(diagnosticIndex);
    this.#head.push(-1);
    return key;
  }

  /** Token of a piece produced by one edit of one or two proposals. */
  addToken(proposal: number, mergedProposal: number): number {
    if (proposal < 0) throw new Error("Edit without a proposal");
    const token = this.pieces.add();
    this.tokenProposal.push(proposal);
    this.#addEntry(proposal, token);
    if (mergedProposal >= 0) {
      this.#addEntry(mergedProposal, token);
      this.proposals.union(proposal, mergedProposal);
    }
    return token;
  }

  /** Records that the edit of a proposal also produced a piece. */
  attach(token: number, proposal: number, mergedProposal: number): void {
    for (const key of [proposal, mergedProposal]) {
      if (key < 0) continue;
      this.#addEntry(key, token);
      this.proposals.union(key, this.tokenProposal[token]);
    }
  }

  #addEntry(proposal: number, token: number): void {
    this.#entryToken.push(token);
    this.#entryNext.push(this.#head[proposal]);
    this.#head[proposal] = this.#entryToken.length - 1;
  }

  /** Calls `visit` with each token created by a proposal. */
  forEachToken(proposal: number, visit: (token: number) => void): void {
    for (
      let entry = this.#head[proposal];
      entry >= 0;
      entry = this.#entryNext[entry]
    ) visit(this.#entryToken[entry]);
  }

  /** Records that two changed pieces became one. */
  merge(left: number, right: number): void {
    this.pieces.union(left, right);
    this.proposals.union(this.tokenProposal[left], this.tokenProposal[right]);
  }

  /** Records that a proposal touches a changed piece. */
  link(proposal: number, token: number): void {
    this.proposals.union(proposal, this.tokenProposal[token]);
  }
}

/** Edit applied to a source ledger, in ledger coordinates. */
interface LedgerEdit extends FragmentEdit {
  /**
   * For an edit combining several edits of one rule: the edits after the
   * first, whose proposals the combined edit also carries.
   */
  readonly parts?: readonly FragmentEdit[];
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

function coalesceLedgerPieces(
  pieces: readonly LedgerPiece[],
  provenance: Provenance,
): LedgerPiece[] {
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
      if (bothChanged) provenance.merge(previous.token, piece.token);
      result[result.length - 1] = {
        value: previous.value + piece.value,
        sourceStart: previous.sourceStart,
        sourceEnd: piece.sourceEnd,
        ruleIds: bothChanged ? mergeRuleIds([previous, piece]) : [],
        token: bothChanged ? previous.token : -1,
      };
    } else {
      result.push(piece);
    }
  }
  return result;
}

/** Replacement of a range, without provenance. */
type RangeEdit = Omit<FragmentEdit, "proposal" | "mergedProposal">;

function expandChangedBoundaries(
  pieces: readonly LedgerPiece[],
  edit: RangeEdit,
): RangeEdit {
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
        token: -1,
      }, {
        value: piece.value.slice(local),
        sourceStart: sourceMiddle,
        sourceEnd: piece.sourceEnd,
        ruleIds: [],
        token: -1,
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
): LedgerEdit[] {
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

  const combined: LedgerEdit[] = [];
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
        proposal: ordered[index].proposal,
        mergedProposal: ordered[index].mergedProposal,
        parts: ordered.slice(index + 1, last + 1),
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
  edits: readonly LedgerEdit[],
  ruleId: string,
  provenance: Provenance,
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
    const token = provenance.addToken(edit.proposal, edit.mergedProposal);
    for (const part of edit.parts ?? []) {
      provenance.attach(token, part.proposal, part.mergedProposal);
    }
    for (const piece of removed) {
      if (piece.token >= 0) provenance.merge(token, piece.token);
    }
    window.splice(startIndex, endIndex - startIndex, {
      value: local.replacement,
      sourceStart,
      sourceEnd,
      ruleIds: addRuleIds(removed, ruleId),
      token,
    });
    length += local.replacement.length - (local.end - local.start);

    const merged = coalesceLedgerPieces(window, provenance);
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

/** Final source changes, each with the provenance token of its piece. */
function ledgerChanges(
  ledgers: readonly ChangeLedger[],
): { readonly changes: TextChange[]; readonly tokens: number[] } {
  const changes: TextChange[] = [];
  const tokens: number[] = [];
  for (let segmentIndex = 0; segmentIndex < ledgers.length; segmentIndex++) {
    const ledger = ledgers[segmentIndex];
    const segmentChanges: TextChange[] = [];
    const segmentTokens: number[] = [];
    for (const piece of ledger.pieces) {
      if (piece.ruleIds.length === 0) continue;
      const expected = ledger.source.value.slice(
        piece.sourceStart,
        piece.sourceEnd,
      );
      if (expected === piece.value) continue;
      if (piece.token < 0) {
        throw new Error(`Changed piece without provenance in ${segmentIndex}`);
      }
      segmentTokens.push(piece.token);
      segmentChanges.push({
        id: `c${changes.length + segmentChanges.length}`,
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
    for (const token of segmentTokens) tokens.push(token);
  }
  return { changes, tokens };
}

/**
 * Proposal groups of a pass, and the group and changes of each applied
 * proposal's diagnostic.
 *
 * Groups are numbered in the order of their first proposal, which is the order
 * of their first diagnostic. Every change belongs to the group of the proposals
 * that produced its piece, so iterating changes in order lists each group's
 * changes in result order without deduplication.
 */
function proposalGroups(
  provenance: Provenance,
  changes: readonly TextChange[],
  tokens: readonly number[],
  diagnostics: RuleDiagnostic[],
): ProposalGroup[] {
  const proposalCount = provenance.proposalDiagnostic.length;
  const groupOfRoot = new Int32Array(proposalCount).fill(-1);
  const groupOf = new Int32Array(proposalCount);
  const groupDiagnostics: number[][] = [];
  for (let proposal = 0; proposal < proposalCount; proposal++) {
    const root = provenance.proposals.find(proposal);
    let group = groupOfRoot[root];
    if (group < 0) {
      group = groupDiagnostics.length;
      groupOfRoot[root] = group;
      groupDiagnostics.push([]);
    }
    groupOf[proposal] = group;
    groupDiagnostics[group].push(provenance.proposalDiagnostic[proposal]);
  }

  const groupChanges: string[][] = groupDiagnostics.map(() => []);
  const changeOfPiece = new Int32Array(provenance.tokenProposal.length).fill(
    -1,
  );
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    changeOfPiece[provenance.pieces.find(token)] = index;
    groupChanges[groupOf[provenance.tokenProposal[token]]].push(
      changes[index].id,
    );
  }

  // A proposal whose edit crosses many segments has one change per segment;
  // the last proposal that listed each change keeps the collection linear.
  const own: number[] = [];
  const listedBy = new Int32Array(changes.length).fill(-1);
  let current = -1;
  const collect = (token: number): void => {
    const change = changeOfPiece[provenance.pieces.find(token)];
    if (change >= 0 && listedBy[change] !== current) {
      listedBy[change] = current;
      own.push(change);
    }
  };
  for (let proposal = 0; proposal < proposalCount; proposal++) {
    own.length = 0;
    current = proposal;
    provenance.forEachToken(proposal, collect);
    if (own.length > 1) own.sort((left, right) => left - right);
    const index = provenance.proposalDiagnostic[proposal];
    const diagnostic = diagnostics[index] as {
      -readonly [Key in keyof RuleDiagnostic]: RuleDiagnostic[Key];
    };
    diagnostic.groupId = `g${groupOf[proposal]}`;
    diagnostic.changeIds = own.map((change) => changes[change].id);
  }

  return groupDiagnostics.map((members, group) => ({
    id: `g${group}`,
    changeIds: groupChanges[group],
    diagnostics: members,
  }));
}

/**
 * Links a proposal to every changed piece that overlaps or touches a ledger
 * range, before its rule's edits are applied.
 */
function linkTouchingPieces(
  pieces: readonly LedgerPiece[],
  start: number,
  end: number,
  proposal: number,
  provenance: Provenance,
): void {
  const offsets = pieceOffsets(pieces);
  // First piece that ends at or after the range start.
  let low = 0;
  let high = pieces.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle + 1] >= start) high = middle;
    else low = middle + 1;
  }
  for (
    let index = low;
    index < pieces.length && offsets[index] <= end;
    index++
  ) {
    const token = pieces[index].token;
    if (token >= 0) provenance.link(proposal, token);
  }
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
  /** Provenance key of an applied proposal, or -1. */
  readonly proposal: number;
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
  provenance: Provenance,
  diagnosticBase: number,
): readonly Annotation[] {
  const id = rule.id;
  const layout = buildRun(segments, locale, mode, stored);
  const result = rule.apply(layout.run);
  // Edits belong to the diagnostics they correct. They are validated in every
  // mode, so that a proposal is checked whether or not it is applied, and
  // applied only in fix mode, where each proposal receives a provenance key.
  const proposed: RunEdit[] = [];
  const proposalOf: number[] = [];
  const keys: (number | undefined)[] = [];
  for (const [index, diagnostic] of (result.diagnostics ?? []).entries()) {
    const edits = diagnostic.edits ?? [];
    const key = mode === "fix" && edits.length > 0
      ? provenance.addProposal(diagnosticBase + index)
      : undefined;
    keys.push(key);
    for (const edit of edits) {
      proposed.push(edit);
      proposalOf.push(key ?? -1);
    }
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
  const projected = projectRunEdits(
    id,
    segments,
    layout,
    proposed,
    proposalOf,
  );
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
  for (const [index, diagnostic] of (result.diagnostics ?? []).entries()) {
    const key = keys[index];
    diagnostics.push({
      location: locateInFragment(id, segments, layout, diagnostic),
      proposal: key ?? -1,
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
      token: -1,
    }],
  }));
  const diagnostics: RuleDiagnostic[] = [];
  const appliedRuleIds: string[] = [];
  const provenance = new Provenance();
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
      provenance,
      diagnostics.length,
    );

    const nextSegments: PipelineSegment[] = [];
    const runtimeOffsets = fragmentOffsets(segments);
    const ledgerEdits = new Map<number, LedgerEdit[]>();
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
        // Filled in once the pass is complete; created here so that the
        // object keeps its shape.
        ...(diagnostic.proposal < 0 ? {} : { groupId: "", changeIds: [] }),
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
            proposal: edit.proposal,
            mergedProposal: edit.mergedProposal,
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
    // A proposal joins the group of every earlier change that its location or
    // its edits overlap or touch.
    for (const { location, proposal } of ruleDiagnostics) {
      if (proposal < 0) continue;
      const segment = segments[location.segmentIndex];
      const offset = runtimeOffsets[location.segmentIndex];
      linkTouchingPieces(
        ledgers[segment.sourceIndex].pieces,
        offset + location.start,
        offset + location.end,
        proposal,
        provenance,
      );
    }
    for (const [sourceIndex, edits] of ledgerEdits) {
      // The proposals of one edit are already in one group.
      for (const edit of edits) {
        linkTouchingPieces(
          ledgers[sourceIndex].pieces,
          edit.start,
          edit.end,
          edit.proposal,
          provenance,
        );
      }
    }
    for (const [sourceIndex, edits] of ledgerEdits) {
      applyLedgerEdits(ledgers[sourceIndex], edits, rule.id, provenance);
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

  const { changes, tokens } = ledgerChanges(ledgers);
  const groups = proposalGroups(provenance, changes, tokens, diagnostics);
  return {
    value: segments.map((segment) => segment.value).join(""),
    segments: segments.map(({ id, value, protected: isProtected }) => ({
      ...(id === undefined ? {} : { id }),
      value,
      ...(isProtected === undefined ? {} : { protected: isProtected }),
    })),
    changes,
    groups,
    diagnostics,
    appliedRuleIds,
  };
}
