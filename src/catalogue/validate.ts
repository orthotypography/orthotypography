import type {
  PresetDefinition,
  RuleDefinition,
  SourceDefinition,
} from "../model.ts";

export interface CatalogueIssue {
  readonly path: string;
  readonly message: string;
}

/** Whether a locale tag is valid and in canonical BCP 47 form. */
function isCanonicalLocale(locale: string): boolean {
  try {
    return Intl.getCanonicalLocales(locale)[0] === locale;
  } catch {
    return false;
  }
}

export function validateCatalogue(
  sources: readonly SourceDefinition[],
  rules: readonly RuleDefinition[],
  presets: readonly PresetDefinition[],
): readonly CatalogueIssue[] {
  const issues: CatalogueIssue[] = [];
  const sourceIds = new Set<string>();
  const ruleIds = new Set<string>();
  const presetIds = new Set<string>();

  for (const source of sources) {
    if (sourceIds.has(source.id)) {
      issues.push({
        path: `sources.${source.id}`,
        message: "duplicate source ID",
      });
    }
    sourceIds.add(source.id);
  }

  for (const rule of rules) {
    if (ruleIds.has(rule.id)) {
      issues.push({ path: `rules.${rule.id}`, message: "duplicate rule ID" });
    }
    ruleIds.add(rule.id);
  }

  for (const rule of rules) {
    for (const source of rule.sources) {
      if (!sourceIds.has(source.sourceId)) {
        issues.push({
          path: `rules.${rule.id}.sources`,
          message: `unknown source ${source.sourceId}`,
        });
      }
    }
    for (const dependency of rule.dependsOn ?? []) {
      if (!ruleIds.has(dependency)) {
        issues.push({
          path: `rules.${rule.id}.dependsOn`,
          message: `unknown rule ${dependency}`,
        });
      }
    }
  }

  for (const rule of rules) {
    for (const locale of rule.locales) {
      if (!isCanonicalLocale(locale)) {
        issues.push({
          path: `rules.${rule.id}.locales`,
          message: `non-canonical locale ${locale}`,
        });
      }
    }
  }

  for (const preset of presets) {
    if (!isCanonicalLocale(preset.locale)) {
      issues.push({
        path: `presets.${preset.id}.locale`,
        message: `non-canonical locale ${preset.locale}`,
      });
    }
    if (presetIds.has(preset.id)) {
      issues.push({
        path: `presets.${preset.id}`,
        message: "duplicate preset ID",
      });
    }
    presetIds.add(preset.id);
    const selected = new Set<string>();
    for (const selection of preset.rules) {
      if (!ruleIds.has(selection.ruleId)) {
        issues.push({
          path: `presets.${preset.id}.rules`,
          message: `unknown rule ${selection.ruleId}`,
        });
      }
      if (selected.has(selection.ruleId)) {
        issues.push({
          path: `presets.${preset.id}.rules`,
          message: `duplicate rule ${selection.ruleId}`,
        });
      }
      selected.add(selection.ruleId);
    }
  }

  return issues;
}
