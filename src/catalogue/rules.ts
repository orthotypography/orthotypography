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
    exceptions: ["séparateur décimal", "syntaxe protégée"],
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
      "end of text",
      "adjacent punctuation",
      "decimal separator",
      "technical syntax",
      "protected content",
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
      "abréviation",
      "version",
      "adresse IP",
      "syntaxe protégée",
      "suite de points (points de suspension)",
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
      "end of text",
      "abbreviation boundary",
      "technical syntax",
      "protected content",
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
    exceptions: ["heure", "ratio", "URI", "port", "syntaxe protégée"],
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
      "end of text",
      "closing sign",
      "comma or period",
      "suspension points (reported, not corrected)",
      "adjacent punctuation",
      "technical syntax",
      "protected content",
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
    exceptions: ["syntaxe protégée", "support contraint"],
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
      "end of text",
      "closing sign",
      "comma or period",
      "suspension points (reported, not corrected)",
      "adjacent punctuation",
      "technical syntax",
      "protected content",
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
      "séquence expressive",
      "syntaxe protégée",
      "support contraint",
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
      "end of text",
      "closing sign",
      "comma or period",
      "suspension points (reported, not corrected)",
      "expressive sequence",
      "technical syntax",
      "protected content",
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
      "séquence expressive",
      "syntaxe protégée",
      "support contraint",
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
      "end of text",
      "closing sign",
      "comma or period",
      "suspension points (reported, not corrected)",
      "expressive sequence",
      "technical syntax",
      "protected content",
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
      "ambiguous function",
      "sequences other than exactly three full stops",
      "etc. abbreviation",
      "technical syntax",
      "editorial omission in brackets",
      "protected content",
    ],
    dependsOn: ["classify.numeric-constructs"],
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
      "unestablished function",
      "technical syntax",
      "editorial omission in brackets",
      "protected content",
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
      "unestablished structural beginning",
      "technical syntax",
      "editorial omission in brackets",
      "protected content",
    ],
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
      "missing semantic evidence",
      "technical syntax",
      "editorial omission in brackets",
      "protected content",
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
      "non-standalone token",
      "technical syntax",
      "protected content",
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
      "guillemet non apparié",
      "support contraint",
      "syntaxe protégée",
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
      "years and dates",
      "ordinals and numbering",
      "versions and network addresses",
      "identifiers, codes, and references",
      "technical or protected content",
    ],
    dependsOn: ["classify.numeric-constructs"],
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
    exceptions: ["identifiant", "syntaxe protégée"],
    dependsOn: ["classify.numeric-constructs"],
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
    exceptions: ["angle", "nom commun", "unité inconnue", "syntaxe protégée"],
    dependsOn: ["classify.numeric-constructs"],
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
      "citation d’une autre convention",
      "devise ambiguë",
      "syntaxe protégée",
    ],
    dependsOn: ["classify.numeric-constructs"],
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
    exceptions: ["entrée structurée par l’intégration"],
  },
] as const;
