import type { PresetDefinition } from "../model.ts";

const commonFrenchRules = [
  { ruleId: "punctuation.comma.no-space-before" },
  { ruleId: "punctuation.period.no-space-before" },
  { ruleId: "classify.numeric-constructs", mode: "manual-review" },
  { ruleId: "punctuation.colon.nbsp-before" },
  { ruleId: "quotes.french.nbsp-inner" },
  { ruleId: "number.percent.nbsp-before" },
  { ruleId: "number.unit.nbsp-before" },
  { ruleId: "number.euro.nbsp-before", mode: "lint" },
] as const;

export const PRESETS: readonly PresetDefinition[] = [
  {
    id: "fr-FR/imprimerie-nationale-2002",
    locale: "fr-FR",
    authority: "imprimerie-nationale-2002",
    status: "CANDIDATE",
    rules: [
      ...commonFrenchRules,
      { ruleId: "classify.ellipsis-candidates", mode: "manual-review" },
      { ruleId: "punctuation.comma.space-after" },
      { ruleId: "punctuation.period.space-after", mode: "manual-review" },
      { ruleId: "punctuation.colon.space-after" },
      { ruleId: "punctuation.semicolon.nnbsp-before" },
      { ruleId: "punctuation.semicolon.space-after" },
      { ruleId: "punctuation.question.nnbsp-before" },
      { ruleId: "punctuation.question.space-after" },
      { ruleId: "punctuation.exclamation.nnbsp-before" },
      { ruleId: "punctuation.exclamation.space-after" },
      { ruleId: "punctuation.ellipsis.after-etc.forbidden" },
    ],
  },
  {
    id: "fr-CA/oqlf",
    locale: "fr-CA",
    authority: "oqlf-spacing",
    status: "CANDIDATE",
    rules: [
      ...commonFrenchRules,
      { ruleId: "punctuation.semicolon.nnbsp-before", mode: "lint" },
      { ruleId: "punctuation.question.nnbsp-before", mode: "lint" },
      { ruleId: "punctuation.exclamation.nnbsp-before", mode: "lint" },
    ],
  },
] as const;
