/** Kind of failure, telling the caller how to react to an error. */
export type ErrorCategory =
  /** The caller's composition or data is invalid and can be corrected. */
  | "input"
  /** A change no longer matches the document; run the pass again. */
  | "stale-change"
  /** A rule returned a result that breaks the rule contract. */
  | "rule-contract"
  /** The shipped catalogue or a pipeline invariant is broken: a core defect. */
  | "internal";

/** Stable error codes and their category. */
export const ERROR_CODES = Object.freeze(
  {
    INVALID_SEGMENT_ID: "input",
    INVALID_LOCALE: "input",
    UNSUPPORTED_LOCALE: "input",
    INVALID_DISMISSED_PROPOSAL: "input",
    INVALID_RULE: "input",
    UNKNOWN_RULE_ID: "input",
    DUPLICATE_RULE: "input",
    MISSING_DEPENDENCY: "input",
    MISSING_ANNOTATION_PROVIDER: "input",
    DUPLICATE_ANNOTATION_PROVIDER: "input",
    BACKWARD_DEPENDENCY: "input",
    DEPENDENCY_CYCLE: "input",
    UNKNOWN_PRESET: "input",
    INVALID_PRESET_OVERRIDE: "input",
    INVALID_CHANGE: "input",
    STALE_CHANGE: "stale-change",
    INVALID_EDIT_RANGE: "rule-contract",
    OVERLAPPING_EDITS: "rule-contract",
    PROTECTED_TEXT_EDIT: "rule-contract",
    INVALID_DIAGNOSTIC: "rule-contract",
    INVALID_ANNOTATION: "rule-contract",
    UNDECLARED_ANNOTATION: "rule-contract",
    TRANSFORM_AND_PROTECT: "rule-contract",
    CATALOGUE_INCONSISTENCY: "internal",
    INTERNAL_INVARIANT: "internal",
  } as const satisfies Record<string, ErrorCategory>,
);

/** Stable code of an error thrown by the core. */
export type ErrorCode = keyof typeof ERROR_CODES;

/** Values identifying what an error is about, such as a rule or a segment. */
export type ErrorDetails = Readonly<Record<string, string | number>>;

/**
 * Error thrown by the core. `message` is an English description; callers
 * branch on `code` and `category`, which are stable.
 */
export class OrthotypographyError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly details: ErrorDetails;

  constructor(code: ErrorCode, message: string, details: ErrorDetails = {}) {
    super(message);
    this.name = "OrthotypographyError";
    this.code = code;
    this.category = ERROR_CODES[code];
    this.details = Object.freeze({ ...details });
  }
}
