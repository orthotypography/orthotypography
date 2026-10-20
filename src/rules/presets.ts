import { OrthotypographyError } from "../errors.ts";
import { PRESETS } from "../catalogue/presets.ts";
import {
  ELLIPSIS_CLASSIFICATION_RULE,
  NUMERIC_PROTECTION_RULE,
} from "../classify/runtime.ts";
import type { RuleMode, RuntimeRule } from "../model.ts";
import {
  DIGIT_GROUPING_RULE,
  EURO_SPACING_RULE,
  PERCENTAGE_SPACING_RULE,
  UNIT_SPACING_RULE,
} from "./numeric.ts";
import {
  HIGH_PUNCTUATION_RULES,
  SAFE_PUNCTUATION_RULES,
  SPACE_AFTER_COMMA_RULE,
} from "./punctuation.ts";
import {
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
  ETC_ELLIPSIS_RULE,
} from "./ellipsis.ts";
import { FRENCH_GUILLEMETS_SPACING_RULE } from "./quotes.ts";

/**
 * Built-in executable rules by ID, in canonical execution order.
 *
 * A preset is a selection of rules, not an order: compiled presets follow this
 * order, and `compilePipeline` then orders rules by phase and dependencies.
 * The rules of the Imprimerie nationale preset come first, followed by the
 * rules that no preset selects yet.
 */
export const EXECUTABLE_RULES: ReadonlyMap<string, RuntimeRule> = new Map(
  [
    NUMERIC_PROTECTION_RULE,
    ELLIPSIS_CLASSIFICATION_RULE,
    FRENCH_GUILLEMETS_SPACING_RULE,
    ...SAFE_PUNCTUATION_RULES,
    SPACE_AFTER_COMMA_RULE,
    ...HIGH_PUNCTUATION_RULES,
    PERCENTAGE_SPACING_RULE,
    UNIT_SPACING_RULE,
    EURO_SPACING_RULE,
    ETC_ELLIPSIS_RULE,
    ELLIPSIS_GLYPH_RULE,
    ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
    DIGIT_GROUPING_RULE,
  ].map((rule) => [rule.id, rule]),
);

export interface CompilePresetOptions {
  /** Modes replacing those of the preset, by ID of a rule of the preset. */
  readonly modes?: Readonly<Record<string, RuleMode>>;
}

/**
 * Builds the executable rules of a catalogue preset.
 *
 * Each executable rule of the preset takes the preset's mode, or the mode of
 * `options.modes`, as its default mode. Rules of the preset that have no
 * executable implementation are documentary and are left out. The result
 * follows the order of `EXECUTABLE_RULES`.
 *
 * Unknown presets, modes for rules outside the preset, and executable rules
 * that do not support the preset's locale are rejected.
 */
export function compilePreset(
  presetId: string,
  options: CompilePresetOptions = {},
): readonly RuntimeRule[] {
  const preset = PRESETS.find(({ id }) => id === presetId);
  if (preset === undefined) {
    throw new OrthotypographyError(
      "UNKNOWN_PRESET",
      `Unknown preset: ${presetId}`,
      { presetId },
    );
  }
  const modes = new Map<string, RuleMode>();
  for (const selection of preset.rules) {
    if (selection.mode !== undefined) {
      modes.set(selection.ruleId, selection.mode);
    }
  }
  const selected = new Set(preset.rules.map(({ ruleId }) => ruleId));
  for (const [ruleId, mode] of Object.entries(options.modes ?? {})) {
    if (!selected.has(ruleId)) {
      throw new OrthotypographyError(
        "INVALID_PRESET_OVERRIDE",
        `Rule ${ruleId} is not in preset ${presetId}`,
        { ruleId, presetId },
      );
    }
    modes.set(ruleId, mode);
  }

  const rules: RuntimeRule[] = [];
  for (const rule of EXECUTABLE_RULES.values()) {
    if (!selected.has(rule.id)) continue;
    if (!rule.locales.includes(preset.locale)) {
      throw new OrthotypographyError(
        "CATALOGUE_INCONSISTENCY",
        `Rule ${rule.id} does not support ${preset.locale} of preset ${presetId}`,
        { ruleId: rule.id, presetId },
      );
    }
    const mode = modes.get(rule.id);
    rules.push(
      mode === undefined || mode === rule.defaultMode
        ? rule
        : Object.freeze({ ...rule, defaultMode: mode }),
    );
  }
  return Object.freeze(rules);
}

/** Executable rules of the Imprimerie nationale 2002 preset. */
export const IMPRIMERIE_NATIONALE_RULES: readonly RuntimeRule[] = compilePreset(
  "fr-FR/imprimerie-nationale-2002",
);
