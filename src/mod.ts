/** Orthotypography core: source-backed, composable typographic primitives. */
export { applyTextChanges } from "./changes.ts";
export {
  ERROR_CODES,
  type ErrorCategory,
  type ErrorCode,
  type ErrorDetails,
  OrthotypographyError,
} from "./errors.ts";
export { DIAGNOSTIC_MESSAGES, formatDiagnosticMessage } from "./messages.ts";
export {
  canonicalLocale,
  compilePipeline,
  type LocaleSupport,
  type PipelineOptions,
  ruleLocaleSupport,
  runPipeline,
} from "./pipeline.ts";
export {
  runTextNodePipeline,
  type TextNodeInput,
  type TextNodeOutput,
  type TextNodePipelineOptions,
  type TextNodePipelineResult,
} from "./integration.ts";
export {
  classifyNumericConstructs,
  ELLIPSIS_CLASSIFICATION_RULE,
  NUMERIC_PROTECTION_RULE,
} from "./classify/mod.ts";
export {
  compilePreset,
  type CompilePresetOptions,
  DIGIT_GROUPING_RULE,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
  ELLIPSIS_RECOGNITION_RULE,
  ETC_ELLIPSIS_RULE,
  EURO_SPACING_RULE,
  EXECUTABLE_RULES,
  FRENCH_GUILLEMETS_SPACING_RULE,
  HIGH_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_RULES,
  PERCENTAGE_SPACING_RULE,
  SAFE_PUNCTUATION_RULES,
  SPACE_AFTER_COMMA_RULE,
  UNIT_SPACING_RULE,
} from "./rules/mod.ts";
export type {
  Annotation,
  ChangeSet,
  DiagnosticLocation,
  DismissedProposal,
  LogicalRun,
  NumericConstruct,
  NumericConstructDisposition,
  NumericConstructKind,
  PipelineMode,
  PipelineResult,
  ProposalGroup,
  RuleDiagnostic,
  RuleMode,
  RulePhase,
  RuleResult,
  RunBias,
  RunDiagnostic,
  RunEdit,
  RunLocation,
  RunRange,
  RuntimeRule,
  TextChange,
  TextSegment,
} from "./model.ts";

export * as catalogue from "./catalogue/mod.ts";
export * as registry from "./registry/mod.ts";
