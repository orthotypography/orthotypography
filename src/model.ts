/** Documentary confidence attached to a source-backed definition. */
export type DocumentaryStatus =
  | "VERIFIED"
  | "VERIFIED_MAPPING"
  | "VERIFIED_BY_EXAMPLE"
  | "VERIFIED_SEMANTICS"
  | "DIVERGENT"
  | "TO_VERIFY";

/** Default action exposed to consumers for a rule. */
export type RuleMode = "fix" | "lint" | "manual-review";

/** Stable pipeline phases. Their order is part of the public contract. */
export type RulePhase =
  | "classify"
  | "glyphs"
  | "quotes"
  | "punctuation-spacing"
  | "numeric-spacing"
  | "cleanup";

export const RULE_PHASES: readonly RulePhase[] = [
  "classify",
  "glyphs",
  "quotes",
  "punctuation-spacing",
  "numeric-spacing",
  "cleanup",
] as const;

/** Academic or institutional source used by documentary rules. */
export interface SourceDefinition {
  readonly id: string;
  readonly citation: string;
  readonly url?: string;
  readonly accessedAt?: string;
}

/** A precise locator inside a registered source. */
export interface SourceLocator {
  readonly sourceId: string;
  readonly locator: string;
}

/** Machine-readable description of one atomic orthotypographic behaviour. */
export interface RuleDefinition {
  readonly id: string;
  readonly description: string;
  readonly locales: readonly string[];
  readonly phase: RulePhase;
  readonly status: DocumentaryStatus;
  readonly defaultMode: RuleMode;
  readonly sources: readonly SourceLocator[];
  readonly outcome: Readonly<Record<string, string>>;
  readonly exceptions: readonly string[];
  readonly dependsOn?: readonly string[];
}

export interface PresetRuleSelection {
  readonly ruleId: string;
  readonly mode?: RuleMode;
}

/** A named, source-scoped composition of atomic rules. */
export interface PresetDefinition {
  readonly id: string;
  readonly locale: string;
  readonly authority: string;
  readonly status: "CANDIDATE" | "DRAFT" | "STABLE";
  readonly rules: readonly PresetRuleSelection[];
}

/** A segment integrations may protect from all text transformations. */
export interface TextSegment {
  /** Stable integration-owned identity of the source text node. */
  readonly id?: string;
  readonly value: string;
  readonly protected?: boolean;
}

/** Exact location of a diagnostic or one of its related subjects. */
export interface DiagnosticLocation {
  /** Whether offsets address the input node or a runtime fragment snapshot. */
  readonly coordinateSpace: "source" | "runtime";
  readonly segmentIndex: number;
  readonly segmentId?: string;
  /** Immutable text snapshot against which start and end are measured. */
  readonly segmentValue: string;
  /** Revision of the runtime fragment; always zero in source coordinates. */
  readonly segmentRevision: number;
  readonly start: number;
  readonly end: number;
}

export interface RuleDiagnostic extends DiagnosticLocation {
  readonly ruleId: string;
  readonly message: string;
  readonly replacement?: string;
  readonly related?: readonly DiagnosticLocation[];
}

/** Half-open range in logical-run coordinates (UTF-16 code units). */
export interface RunRange {
  readonly start: number;
  readonly end: number;
}

/** Side that receives text at a boundary between text nodes. */
export type RunBias = "left" | "right";

/** Replacement proposed by a rule in logical-run coordinates. */
export interface RunEdit extends RunRange {
  readonly replacement: string;
  /**
   * Node receiving the replacement at or across a node boundary: the last
   * node touched (`left`, default) or the first one (`right`) for an edit
   * crossing nodes; the node before (`left`) or after (`right`) for an
   * insertion at a boundary.
   */
  readonly bias?: RunBias;
}

/** Diagnostic subject in logical-run coordinates. */
export interface RunLocation extends RunRange {
  /** Node reporting an empty location placed at a node boundary. */
  readonly bias?: RunBias;
}

/**
 * Diagnostic reported by a rule. A non-empty location must lie within one
 * text node or unprotected fragment.
 */
export interface RunDiagnostic extends RunLocation {
  readonly message: string;
  readonly replacement?: string;
  readonly related?: readonly RunLocation[];
  /**
   * Edits that correct this diagnostic. The pipeline validates them in every
   * mode and applies them only in `fix` mode; a diagnostic with edits is a
   * proposal.
   */
  readonly edits?: readonly RunEdit[];
}

/** Typed classification result attached to a range of the logical run. */
export interface Annotation extends RunRange {
  readonly kind: string;
  /** The range becomes protected for every later rule. */
  readonly protect?: boolean;
  readonly data?: Readonly<Record<string, string>>;
}

/**
 * Read-only view of one logical run: the concatenated text of all input
 * segments, with protected ranges, node boundaries, and the annotations of
 * earlier classify rules, all in current run coordinates.
 */
export interface LogicalRun {
  readonly text: string;
  readonly locale: string;
  readonly mode: RuleMode;
  /** Sorted, disjoint protected ranges. */
  readonly protectedRanges: readonly RunRange[];
  /** Start offset of each source node, followed by the text length. */
  readonly nodeBoundaries: readonly number[];
  /** Annotations of one kind, sorted by position. */
  annotations(kind: string): readonly Annotation[];
}

/** Diagnostics with their edits, and annotations, returned by one rule call. */
export interface RuleResult {
  /** Diagnostics, each carrying the edits that correct it, if any. */
  readonly diagnostics?: readonly RunDiagnostic[];
  /** Reserved for rules of the `classify` phase. */
  readonly annotations?: readonly Annotation[];
}

/**
 * Executable rule, called once per pass on the logical run.
 *
 * Built-in rules take their identity and execution metadata from their
 * catalogue entry. Rules of other packages use IDs prefixed with `x-` and need
 * no catalogue entry.
 */
export interface RuntimeRule {
  readonly id: string;
  readonly phase: RulePhase;
  readonly locales: readonly string[];
  readonly defaultMode: RuleMode;
  /** IDs of rules that must run before this one. */
  readonly dependsOn?: readonly string[];
  apply(run: LogicalRun): RuleResult;
}

/** One non-overlapping replacement expressed against an input source segment. */
export interface TextChange {
  readonly segmentIndex: number;
  readonly segmentId?: string;
  readonly start: number;
  readonly end: number;
  /** Exact source substring expected at start:end. */
  readonly expected: string;
  readonly replacement: string;
  /** Ordered rule provenance, including rules that refined prior output. */
  readonly ruleIds: readonly string[];
}

/** A complete set of source-coordinate edits for one pipeline result. */
export interface ChangeSet {
  readonly changes: readonly TextChange[];
}

export interface PipelineResult extends ChangeSet {
  readonly value: string;
  readonly segments: readonly TextSegment[];
  /** Applied fixes projected back into stable source coordinates. */
  readonly changes: readonly TextChange[];
  readonly diagnostics: readonly RuleDiagnostic[];
  readonly appliedRuleIds: readonly string[];
}

/** Numeric contexts recognized before punctuation and spacing rules run. */
export type NumericConstructKind =
  | "uri"
  | "path"
  | "ipv4"
  | "version"
  | "date"
  | "time"
  | "ratio"
  | "port"
  | "decimal"
  | "percentage"
  | "measurement"
  | "currency";

/** Whether a numeric context must be preserved or may be transformed. */
export type NumericConstructDisposition = "protect" | "target";

/** Half-open source range returned by the numeric classifier. */
export interface NumericConstruct {
  readonly kind: NumericConstructKind;
  readonly disposition: NumericConstructDisposition;
  readonly start: number;
  readonly end: number;
  readonly value: string;
}
