import type { RuleDefinition } from "../model.ts";

const frenchLocales = ["fr-FR", "fr-CA"] as const;

export const RULES: readonly RuleDefinition[] = [
  {
    id: "punctuation.comma.no-space-before",
    description: "Supprimer tout blanc précédant une virgule de phrase.",
    locales: frenchLocales,
    phase: "punctuation-spacing",
    status: "VERIFIED",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Espacement",
      },
      { sourceId: "oqlf-spacing", locator: "Virgule" },
    ],
    outcome: { before: "" },
    exceptions: [
      { id: "protected-content", description: "protected content" },
    ],
  },
  {
    id: "punctuation.comma.space-after",
    description: "Insert a word space after a comma when text follows.",
    locales: ["fr-FR"],
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Virgule",
      },
    ],
    outcome: { after: "U+0020" },
    exceptions: [
      { id: "end-of-text", description: "end of text" },
      { id: "adjacent-punctuation", description: "adjacent punctuation" },
      { id: "decimal-separator", description: "decimal separator" },
      { id: "technical-syntax", description: "technical syntax" },
      { id: "protected-content", description: "protected content" },
    ],
  },
  {
    id: "punctuation.period.no-space-before",
    description: "Supprimer tout blanc précédant un point final.",
    locales: frenchLocales,
    phase: "punctuation-spacing",
    status: "VERIFIED",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Espacement",
      },
      { sourceId: "oqlf-spacing", locator: "Point" },
    ],
    outcome: { before: "" },
    exceptions: [
      { id: "protected-content", description: "protected content" },
      {
        id: "period-run",
        description: "run of periods, left to the ellipsis rules",
      },
    ],
  },
  {
    id: "punctuation.period.space-after",
    description: "Require a word space after a period when text follows.",
    locales: ["fr-FR"],
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "manual-review",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Point",
      },
    ],
    outcome: { after: "U+0020" },
    exceptions: [
      { id: "end-of-text", description: "end of text" },
      { id: "abbreviation-boundary", description: "abbreviation boundary" },
      { id: "technical-syntax", description: "technical syntax" },
      { id: "protected-content", description: "protected content" },
    ],
  },
  {
    id: "punctuation.colon.nbsp-before",
    description:
      "Placer une espace insécable de mots avant un deux-points de phrase.",
    locales: frenchLocales,
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Deux-points",
      },
      { sourceId: "oqlf-spacing", locator: "Deux-points" },
    ],
    outcome: { before: "U+00A0" },
    exceptions: [
      { id: "time", description: "time of day" },
      { id: "ratio", description: "ratio" },
      { id: "uri", description: "URI" },
      { id: "port", description: "port number" },
      { id: "protected-content", description: "protected content" },
    ],
    dependsOn: ["classify.numeric-constructs"],
  },
  {
    id: "punctuation.colon.space-after",
    description: "Require a word space after a colon when text follows.",
    locales: ["fr-FR"],
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Deux-points",
      },
    ],
    outcome: { after: "U+0020" },
    exceptions: [
      { id: "end-of-text", description: "end of text" },
      { id: "closing-sign", description: "closing sign" },
      { id: "comma-or-period", description: "comma or period" },
      {
        id: "suspension-points",
        description: "suspension points (reported, not corrected)",
      },
      { id: "adjacent-punctuation", description: "adjacent punctuation" },
      { id: "technical-syntax", description: "technical syntax" },
      { id: "protected-content", description: "protected content" },
    ],
    dependsOn: ["classify.numeric-constructs"],
  },
  {
    id: "punctuation.semicolon.nnbsp-before",
    description: "Placer une espace fine insécable avant un point-virgule.",
    locales: frenchLocales,
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Point-virgule",
      },
      { sourceId: "oqlf-space-types", locator: "Espace fine insécable" },
    ],
    outcome: { before: "U+202F" },
    exceptions: [
      { id: "protected-content", description: "protected content" },
      {
        id: "constrained-support",
        description: "rendering support without the required space",
        scope: "integration",
      },
    ],
  },
  {
    id: "punctuation.semicolon.space-after",
    description: "Require a word space after a semicolon when text follows.",
    locales: ["fr-FR"],
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Point-virgule",
      },
    ],
    outcome: { after: "U+0020" },
    exceptions: [
      { id: "end-of-text", description: "end of text" },
      { id: "closing-sign", description: "closing sign" },
      { id: "comma-or-period", description: "comma or period" },
      {
        id: "suspension-points",
        description: "suspension points (reported, not corrected)",
      },
      { id: "adjacent-punctuation", description: "adjacent punctuation" },
      { id: "technical-syntax", description: "technical syntax" },
      { id: "protected-content", description: "protected content" },
    ],
    dependsOn: ["classify.numeric-constructs"],
  },
  {
    id: "punctuation.question.nnbsp-before",
    description:
      "Placer une espace fine insécable avant un point d’interrogation.",
    locales: frenchLocales,
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Point d’interrogation",
      },
      { sourceId: "oqlf-space-types", locator: "Espace fine insécable" },
    ],
    outcome: { before: "U+202F" },
    exceptions: [
      { id: "expressive-sequence", description: "expressive sequence" },
      { id: "protected-content", description: "protected content" },
      {
        id: "constrained-support",
        description: "rendering support without the required space",
        scope: "integration",
      },
    ],
  },
  {
    id: "punctuation.question.space-after",
    description:
      "Require a word space after a question mark when text follows.",
    locales: ["fr-FR"],
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Point d’interrogation",
      },
    ],
    outcome: { after: "U+0020" },
    exceptions: [
      { id: "end-of-text", description: "end of text" },
      { id: "closing-sign", description: "closing sign" },
      { id: "comma-or-period", description: "comma or period" },
      {
        id: "suspension-points",
        description: "suspension points (reported, not corrected)",
      },
      { id: "expressive-sequence", description: "expressive sequence" },
      { id: "technical-syntax", description: "technical syntax" },
      { id: "protected-content", description: "protected content" },
    ],
    dependsOn: ["classify.numeric-constructs"],
  },
  {
    id: "punctuation.exclamation.nnbsp-before",
    description:
      "Placer une espace fine insécable avant un point d’exclamation.",
    locales: frenchLocales,
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Point d’exclamation",
      },
      { sourceId: "oqlf-space-types", locator: "Espace fine insécable" },
    ],
    outcome: { before: "U+202F" },
    exceptions: [
      { id: "expressive-sequence", description: "expressive sequence" },
      { id: "protected-content", description: "protected content" },
      {
        id: "constrained-support",
        description: "rendering support without the required space",
        scope: "integration",
      },
    ],
  },
  {
    id: "punctuation.exclamation.space-after",
    description:
      "Require a word space after an exclamation mark when text follows.",
    locales: ["fr-FR"],
    phase: "punctuation-spacing",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableau Point d’exclamation",
      },
    ],
    outcome: { after: "U+0020" },
    exceptions: [
      { id: "end-of-text", description: "end of text" },
      { id: "closing-sign", description: "closing sign" },
      { id: "comma-or-period", description: "comma or period" },
      {
        id: "suspension-points",
        description: "suspension points (reported, not corrected)",
      },
      { id: "expressive-sequence", description: "expressive sequence" },
      { id: "technical-syntax", description: "technical syntax" },
      { id: "protected-content", description: "protected content" },
    ],
    dependsOn: ["classify.numeric-constructs"],
  },
  {
    id: "punctuation.ellipsis.glyph",
    description:
      "Prefer U+2026 for a conservatively recognized ellipsis represented by exactly three U+002E characters.",
    locales: ["fr-FR"],
    phase: "glyphs",
    status: "VERIFIED_SEMANTICS",
    defaultMode: "lint",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Points de suspension",
      },
    ],
    outcome: { glyph: "U+2026", sourceSequence: "U+002E U+002E U+002E" },
    exceptions: [
      { id: "ambiguous-function", description: "ambiguous function" },
      {
        id: "other-period-sequence",
        description: "sequences other than exactly three full stops",
      },
      { id: "etc-abbreviation", description: "etc. abbreviation" },
      { id: "technical-syntax", description: "technical syntax" },
      {
        id: "editorial-omission",
        description: "editorial omission in brackets",
      },
      { id: "protected-content", description: "protected content" },
    ],
    requires: ["ellipsis"],
  },
  {
    id: "punctuation.ellipsis.final.no-space-before",
    description:
      "Require no whitespace before an ellipsis with an established final function.",
    locales: ["fr-FR"],
    phase: "punctuation-spacing",
    status: "VERIFIED_SEMANTICS",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Points de suspension",
      },
    ],
    outcome: { before: "" },
    exceptions: [
      { id: "unestablished-function", description: "unestablished function" },
      { id: "technical-syntax", description: "technical syntax" },
      {
        id: "editorial-omission",
        description: "editorial omission in brackets",
      },
      { id: "protected-content", description: "protected content" },
    ],
  },
  {
    id: "punctuation.ellipsis.initial.space-after",
    description:
      "Require a word space after an ellipsis replacing a structurally established beginning.",
    locales: ["fr-FR"],
    phase: "punctuation-spacing",
    status: "VERIFIED_SEMANTICS",
    defaultMode: "lint",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Points de suspension",
      },
    ],
    outcome: { after: "U+0020" },
    exceptions: [
      {
        id: "unestablished-beginning",
        description: "unestablished structural beginning",
      },
      { id: "technical-syntax", description: "technical syntax" },
      {
        id: "editorial-omission",
        description: "editorial omission in brackets",
      },
      { id: "protected-content", description: "protected content" },
    ],
    requires: ["ellipsis"],
  },
  {
    id: "punctuation.ellipsis.word.space-around",
    description:
      "Require word spaces around an ellipsis established as replacing one word.",
    locales: ["fr-FR"],
    phase: "punctuation-spacing",
    status: "VERIFIED_SEMANTICS",
    defaultMode: "manual-review",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Points de suspension",
      },
    ],
    outcome: { before: "U+0020", after: "U+0020" },
    exceptions: [
      {
        id: "missing-semantic-evidence",
        description: "missing semantic evidence",
      },
      { id: "technical-syntax", description: "technical syntax" },
      {
        id: "editorial-omission",
        description: "editorial omission in brackets",
      },
      { id: "protected-content", description: "protected content" },
    ],
  },
  {
    id: "punctuation.ellipsis.after-etc.forbidden",
    description: "Remove suspension points that follow the abbreviation etc.",
    locales: ["fr-FR"],
    phase: "cleanup",
    status: "VERIFIED",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Points de suspension",
      },
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Abréviations/etc.",
      },
    ],
    outcome: { afterEtc: "U+002E only" },
    exceptions: [
      { id: "non-standalone-token", description: "non-standalone token" },
      { id: "technical-syntax", description: "technical syntax" },
      { id: "protected-content", description: "protected content" },
    ],
  },
  {
    id: "quotes.french.nbsp-inner",
    description:
      "Placer une espace insécable de mots à l’intérieur des guillemets français.",
    locales: frenchLocales,
    phase: "quotes",
    status: "VERIFIED_MAPPING",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Ponctuation/Tableaux Guillemets",
      },
      { sourceId: "oqlf-quotes", locator: "Guillemets français" },
    ],
    outcome: { afterOpening: "U+00A0", beforeClosing: "U+00A0" },
    exceptions: [
      { id: "unpaired-guillemet", description: "unpaired guillemet" },
      {
        id: "constrained-support",
        description: "rendering support without the required space",
        scope: "integration",
      },
      { id: "protected-content", description: "protected content" },
    ],
  },
  {
    id: "number.digits.grouping",
    description:
      "Group digits in quantities by threes on both sides of the decimal comma.",
    locales: ["fr-FR"],
    phase: "numeric-spacing",
    status: "VERIFIED_SEMANTICS",
    defaultMode: "lint",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Nombres en chiffres arabes/Nota a",
      },
    ],
    outcome: { separator: "U+202F", groupSize: "3" },
    exceptions: [
      { id: "years-and-dates", description: "years and dates" },
      { id: "ordinals-and-numbering", description: "ordinals and numbering" },
      {
        id: "versions-and-addresses",
        description: "versions and network addresses",
      },
      {
        id: "identifiers-and-codes",
        description: "identifiers, codes, and references",
      },
      {
        id: "technical-or-protected-content",
        description: "technical or protected content",
      },
    ],
    requires: ["numeric"],
  },
  {
    id: "number.percent.nbsp-before",
    description:
      "Placer une espace insécable entre une valeur et le symbole pour cent.",
    locales: frenchLocales,
    phase: "numeric-spacing",
    status: "VERIFIED_BY_EXAMPLE",
    defaultMode: "fix",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Nombres en chiffres arabes/Pourcentages",
      },
      { sourceId: "oqlf-spacing", locator: "Symbole pour cent" },
    ],
    outcome: { beforeSymbol: "U+00A0" },
    exceptions: [
      { id: "identifier", description: "identifier" },
      { id: "protected-content", description: "protected content" },
    ],
    requires: ["numeric"],
  },
  {
    id: "number.unit.nbsp-before",
    description:
      "Placer une espace insécable entre une valeur et un symbole d’unité reconnu.",
    locales: frenchLocales,
    phase: "numeric-spacing",
    status: "VERIFIED_BY_EXAMPLE",
    defaultMode: "lint",
    sources: [
      {
        sourceId: "imprimerie-nationale-2002",
        locator: "Unités de mesure/Remarques sur les symboles",
      },
      { sourceId: "oqlf-spacing", locator: "Symboles d’unités de mesure" },
      {
        sourceId: "bipm-si-9-4.01",
        locator: "5.4.3 Formatting the value of a quantity",
      },
    ],
    outcome: { beforeSymbol: "U+00A0" },
    exceptions: [
      { id: "angle", description: "angle" },
      { id: "common-noun", description: "common noun" },
      { id: "unknown-unit", description: "unknown unit" },
      { id: "protected-content", description: "protected content" },
    ],
    requires: ["numeric"],
  },
  {
    id: "number.euro.nbsp-before",
    description:
      "Placer le symbole euro à droite de la valeur et l’en séparer par une espace insécable.",
    locales: frenchLocales,
    phase: "numeric-spacing",
    status: "VERIFIED_BY_EXAMPLE",
    defaultMode: "lint",
    sources: [
      { sourceId: "imprimerie-nationale-2002", locator: "Euro" },
      { sourceId: "oqlf-spacing", locator: "Symboles d’unités monétaires" },
      {
        sourceId: "oqlf-currency-symbols",
        locator: "Écriture des symboles d’unités monétaires",
      },
    ],
    outcome: { position: "after", beforeSymbol: "U+00A0" },
    exceptions: [
      {
        id: "quoted-convention",
        description: "quotation of another convention",
        scope: "review",
      },
      { id: "ambiguous-currency", description: "ambiguous currency" },
      { id: "protected-content", description: "protected content" },
    ],
    requires: ["numeric"],
  },
  {
    id: "classify.numeric-constructs",
    description:
      "Identifier les heures, ratios, mesures, monnaies et autres constructions numériques protégées.",
    locales: frenchLocales,
    phase: "classify",
    status: "TO_VERIFY",
    defaultMode: "manual-review",
    sources: [],
    outcome: { effect: "classification-only" },
    exceptions: [
      {
        id: "integration-input",
        description: "structured input supplied by the integration",
        scope: "integration",
      },
    ],
    provides: ["numeric"],
  },
  {
    id: "classify.ellipsis-candidates",
    description:
      "Classify ellipsis candidates once per pass, with their function and whether it is certain, for the ellipsis rules.",
    locales: frenchLocales,
    phase: "classify",
    status: "TO_VERIFY",
    defaultMode: "manual-review",
    sources: [],
    outcome: { effect: "classification-only" },
    exceptions: [
      {
        id: "integration-input",
        description: "structured input supplied by the integration",
        scope: "integration",
      },
    ],
    dependsOn: ["classify.numeric-constructs"],
    provides: ["ellipsis"],
  },
] as const;
