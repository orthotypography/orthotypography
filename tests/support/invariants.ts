import {
  applyTextChanges,
  DIAGNOSTIC_MESSAGES,
  DIGIT_GROUPING_RULE,
  ELLIPSIS_CLASSIFICATION_RULE,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
  ETC_ELLIPSIS_RULE,
  EURO_SPACING_RULE,
  formatDiagnosticMessage,
  FRENCH_GUILLEMETS_SPACING_RULE,
  HIGH_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  PERCENTAGE_SPACING_RULE,
  runTextNodePipeline,
  SAFE_PUNCTUATION_RULES,
  SPACE_AFTER_COMMA_RULE,
  UNIT_SPACING_RULE,
} from "../../src/mod.ts";
import type { RuleDiagnostic, RuntimeRule } from "../../src/model.ts";
import type {
  TextNodeInput,
  TextNodePipelineResult,
} from "../../src/integration.ts";

/** A named rule composition checked by the invariant harness. */
export interface Composition {
  readonly name: string;
  readonly rules: readonly RuntimeRule[];
}

/** Every exported composition, and each opt-in rule with its dependencies. */
export const COMPOSITIONS: readonly Composition[] = [
  { name: "SAFE_PUNCTUATION_RULES", rules: SAFE_PUNCTUATION_RULES },
  {
    name: "HIGH_PUNCTUATION_RULES",
    rules: [NUMERIC_PROTECTION_RULE, ...HIGH_PUNCTUATION_RULES],
  },
  {
    name: "IMPRIMERIE_NATIONALE_PUNCTUATION_RULES",
    rules: IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  },
  { name: "IMPRIMERIE_NATIONALE_RULES", rules: IMPRIMERIE_NATIONALE_RULES },
  { name: "SPACE_AFTER_COMMA_RULE", rules: [SPACE_AFTER_COMMA_RULE] },
  { name: "ETC_ELLIPSIS_RULE", rules: [ETC_ELLIPSIS_RULE] },
  {
    name: "ELLIPSIS_GLYPH_RULE",
    rules: [
      NUMERIC_PROTECTION_RULE,
      ELLIPSIS_CLASSIFICATION_RULE,
      ELLIPSIS_GLYPH_RULE,
    ],
  },
  {
    name: "ELLIPSIS_INITIAL_SPACE_AFTER_RULE",
    rules: [
      NUMERIC_PROTECTION_RULE,
      ELLIPSIS_CLASSIFICATION_RULE,
      ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
    ],
  },
  {
    name: "FRENCH_GUILLEMETS_SPACING_RULE",
    rules: [NUMERIC_PROTECTION_RULE, FRENCH_GUILLEMETS_SPACING_RULE],
  },
  {
    name: "PERCENTAGE_SPACING_RULE",
    rules: [NUMERIC_PROTECTION_RULE, PERCENTAGE_SPACING_RULE],
  },
  {
    name: "UNIT_SPACING_RULE",
    rules: [NUMERIC_PROTECTION_RULE, UNIT_SPACING_RULE],
  },
  {
    name: "EURO_SPACING_RULE",
    rules: [NUMERIC_PROTECTION_RULE, EURO_SPACING_RULE],
  },
  {
    name: "DIGIT_GROUPING_RULE",
    rules: [NUMERIC_PROTECTION_RULE, DIGIT_GROUPING_RULE],
  },
  {
    name: "IMPRIMERIE_NATIONALE_RULES with opt-in ellipsis rules",
    rules: [
      ...IMPRIMERIE_NATIONALE_RULES,
      ELLIPSIS_GLYPH_RULE,
      ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
      DIGIT_GROUPING_RULE,
    ],
  },
];

/** A reported defect that the harness still detects, pending its fix. */
export interface KnownViolation {
  readonly issue: number;
  readonly compositions: readonly string[];
  readonly pattern: RegExp;
  /** Minimal input that must keep reproducing the violation until fixed. */
  readonly example: readonly TextNodeInput[];
}

/**
 * Violations tracked in issues. Remove an entry together with its fix: the
 * harness test fails as soon as the example stops reproducing it.
 */
export const KNOWN_VIOLATIONS: readonly KnownViolation[] = [];

function describe(nodes: readonly TextNodeInput[]): string {
  return JSON.stringify(nodes);
}

function runOrReport(
  violations: string[],
  label: string,
  run: () => void,
): void {
  try {
    run();
  } catch (error) {
    violations.push(
      `${label} threw: ${error instanceof Error ? error.message : error}`,
    );
  }
}

/**
 * Proposal-group invariants of one fix result (design of #26, § 5): every
 * change belongs to exactly one group, groups and diagnostics agree, a group's
 * changes are those of its proposals, and unions of groups apply.
 */
function groupViolations(
  nodes: readonly TextNodeInput[],
  result: TextNodePipelineResult,
): string[] {
  const violations: string[] = [];
  const owner = new Map<string, string>();
  for (const group of result.groups) {
    for (const id of group.changeIds) {
      if (owner.has(id)) violations.push(`change ${id} is in two groups`);
      owner.set(id, group.id);
    }
    const fromProposals = new Set<string>();
    for (const index of group.diagnostics) {
      const diagnostic = result.diagnostics[index];
      if (diagnostic?.groupId !== group.id) {
        violations.push(`diagnostic ${index} is not marked as in ${group.id}`);
      }
      for (const id of diagnostic?.changeIds ?? []) fromProposals.add(id);
    }
    if (
      JSON.stringify([...fromProposals].sort()) !==
        JSON.stringify([...group.changeIds].sort())
    ) {
      violations.push(`group ${group.id} changes differ from its proposals`);
    }
  }
  for (const change of result.changes) {
    if (!owner.has(change.id)) {
      violations.push(`change ${change.id} has no group`);
    }
  }
  const listed = new Set(
    result.groups.flatMap(({ diagnostics }) => diagnostics),
  );
  for (const [index, diagnostic] of result.diagnostics.entries()) {
    if ((diagnostic.groupId !== undefined) !== listed.has(index)) {
      violations.push(`diagnostic ${index} and the groups disagree`);
    }
  }
  // Each group alone, and every other group, must apply on the source nodes.
  const subsets = [
    ...result.groups.map((group) => [group]),
    result.groups.filter((_, index) => index % 2 === 0),
  ];
  for (const subset of subsets) {
    const ids = new Set(subset.flatMap(({ changeIds }) => changeIds));
    try {
      applyTextChanges(nodes, result.changes.filter(({ id }) => ids.has(id)));
    } catch (error) {
      violations.push(
        `groups ${subset.map(({ id }) => id).join("+")} do not apply: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
  return violations;
}

/**
 * Built-in diagnostics take their message from `DIAGNOSTIC_MESSAGES`, so that
 * hosts can translate them (#27).
 */
function messageViolations(diagnostics: readonly RuleDiagnostic[]): string[] {
  const violations: string[] = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.ruleId.startsWith("x-")) continue;
    if (
      !Object.hasOwn(DIAGNOSTIC_MESSAGES, diagnostic.messageId) ||
      diagnostic.message !==
        formatDiagnosticMessage(diagnostic.messageId, diagnostic.messageArgs)
    ) {
      violations.push(
        `diagnostic ${diagnostic.ruleId} has an inconsistent message`,
      );
    }
  }
  return violations;
}

/** Identity of a diagnostic across passes: rule, location, and message. */
function diagnosticKey(diagnostic: RuleDiagnostic): string {
  return JSON.stringify([
    diagnostic.ruleId,
    diagnostic.segmentIndex,
    diagnostic.start,
    diagnostic.end,
    diagnostic.message,
    diagnostic.replacement,
  ]);
}

/**
 * Review-mode and dismissal invariants (design of #26, sections 5 and 8):
 * without its hints, review mode gives the fix result; every applied proposal
 * and group carries a hint; dismissing the proposals of a group reports them
 * as dismissed, outside any group, and leaves the cascade upstream unchanged.
 */
function reviewViolations(
  nodes: readonly TextNodeInput[],
  rules: readonly RuntimeRule[],
  locale: string,
  fix: TextNodePipelineResult,
): string[] {
  const violations: string[] = [];
  const review = runTextNodePipeline(nodes, rules, { locale, mode: "review" });
  const withoutHints = JSON.stringify(
    review,
    (key, value) => key === "suggested" ? undefined : value,
  );
  if (withoutHints !== JSON.stringify(fix)) {
    violations.push("review mode differs from fix mode beyond its hints");
  }
  if (
    review.diagnostics.some(({ groupId, suggested }) =>
      (groupId !== undefined) !== (suggested !== undefined)
    ) || review.groups.some(({ suggested }) => suggested === undefined)
  ) {
    violations.push("review mode hints are missing or misplaced");
  }

  for (const group of [review.groups[0], review.groups.at(-1)]) {
    if (group === undefined) continue;
    const proposals = group.diagnostics.map((index) =>
      review.diagnostics[index]
    );
    const dismissed = runTextNodePipeline(nodes, rules, {
      locale,
      mode: "review",
      dismissed: proposals.map(({ ruleId, segmentIndex, start, end }) => ({
        ruleId,
        segmentIndex,
        start,
        end,
      })),
    });
    const targets = new Set(proposals.map(diagnosticKey));
    for (const diagnostic of dismissed.diagnostics) {
      if (!targets.has(diagnosticKey(diagnostic))) continue;
      if (diagnostic.dismissed !== true || diagnostic.groupId !== undefined) {
        violations.push(`proposal of ${group.id} is not reported dismissed`);
      }
    }
    // The proposals of the group's first rule do not depend on the others and
    // reappear, dismissed; later proposals of the group may no longer arise.
    const firstRule = review.diagnostics[group.diagnostics[0]].ruleId;
    for (const proposal of proposals) {
      if (proposal.ruleId !== firstRule) continue;
      if (
        !dismissed.diagnostics.some((diagnostic) =>
          diagnosticKey(diagnostic) === diagnosticKey(proposal) &&
          diagnostic.dismissed === true
        )
      ) {
        violations.push(`proposal of ${group.id} disappeared when dismissed`);
      }
    }
    // Diagnostics are reported rule by rule. Those of the rules up to the
    // group's first rule do not depend on the dismissal.
    const upstream = (result: TextNodePipelineResult): string => {
      const keys: string[] = [];
      let reached = false;
      for (const diagnostic of result.diagnostics) {
        if (diagnostic.ruleId === firstRule) reached = true;
        else if (reached) break;
        keys.push(diagnosticKey(diagnostic));
      }
      return keys.join("\n");
    };
    if (upstream(review) !== upstream(dismissed)) {
      violations.push(`dismissing ${group.id} changed upstream diagnostics`);
    }
  }
  return violations;
}

/**
 * Checks the pipeline invariants of one composition on one logical text run.
 *
 * Returns human-readable violations instead of asserting, so that the harness
 * itself can be tested against deliberately broken rules.
 */
export function checkInvariants(
  rules: readonly RuntimeRule[],
  nodes: readonly TextNodeInput[],
  locale = "fr-FR",
): string[] {
  const violations: string[] = [];
  const input = describe(nodes);
  const sourceText = nodes.map(({ value }) => value).join("");

  runOrReport(violations, `lint ${input}`, () => {
    const lint = runTextNodePipeline(nodes, rules, { locale, mode: "lint" });
    if (lint.value !== sourceText || lint.changes.length > 0) {
      violations.push(`lint mode changed the text of ${input}`);
    }
    for (const violation of messageViolations(lint.diagnostics)) {
      violations.push(`${violation} for ${input}`);
    }
    if (
      lint.groups.length > 0 ||
      lint.diagnostics.some(({ groupId, changeIds }) =>
        groupId !== undefined || changeIds !== undefined
      )
    ) {
      violations.push(`lint mode reported proposal groups for ${input}`);
    }
    for (const diagnostic of lint.diagnostics) {
      const node = nodes[diagnostic.segmentIndex];
      if (
        node === undefined ||
        diagnostic.segmentValue !== node.value ||
        diagnostic.end > node.value.length
      ) {
        violations.push(
          `lint diagnostic ${diagnostic.ruleId} is not in source coordinates for ${input}`,
        );
      }
    }
  });

  runOrReport(violations, `fix ${input}`, () => {
    const fix = runTextNodePipeline(nodes, rules, { locale, mode: "fix" });
    const again = runTextNodePipeline(nodes, rules, { locale, mode: "fix" });
    if (JSON.stringify(fix) !== JSON.stringify(again)) {
      violations.push(`fix mode is not deterministic for ${input}`);
    }

    const applied = applyTextChanges(nodes, fix.changes);
    const appliedValues = applied.map(({ value }) => value);
    const outputValues = fix.nodes.map(({ value }) => value);
    if (JSON.stringify(appliedValues) !== JSON.stringify(outputValues)) {
      violations.push(
        `changes do not reproduce the fixed nodes for ${input}: ${
          JSON.stringify(outputValues)
        }`,
      );
    }
    if (fix.value !== outputValues.join("")) {
      violations.push(`fixed value does not join the fixed nodes for ${input}`);
    }
    for (const violation of messageViolations(fix.diagnostics)) {
      violations.push(`${violation} for ${input}`);
    }
    for (const violation of groupViolations(nodes, fix)) {
      violations.push(`${violation} for ${input}`);
    }
    for (const violation of reviewViolations(nodes, rules, locale, fix)) {
      violations.push(`${violation} for ${input}`);
    }

    for (const [index, node] of nodes.entries()) {
      if (!node.protected) continue;
      if (
        fix.nodes[index]?.value !== node.value ||
        fix.changes.some(({ segmentIndex }) => segmentIndex === index)
      ) {
        violations.push(`protected node ${node.id} changed in ${input}`);
      }
    }

    const second = runTextNodePipeline(
      fix.nodes.map((node) => ({
        id: node.id,
        value: node.value,
        ...(node.protected === undefined ? {} : { protected: node.protected }),
      })),
      rules,
      { locale, mode: "fix" },
    );
    if (second.changes.length > 0) {
      violations.push(
        `fix mode is not idempotent for ${input}: ${
          JSON.stringify(fix.value)
        } then ${JSON.stringify(second.value)} (${
          second.changes.flatMap(({ ruleIds }) => ruleIds).join(", ")
        })`,
      );
    }

    const lint = runTextNodePipeline(nodes, rules, { locale, mode: "lint" });
    const diagnosed = new Set(lint.diagnostics.map(({ ruleId }) => ruleId));
    for (const change of fix.changes) {
      if (!change.ruleIds.some((ruleId) => diagnosed.has(ruleId))) {
        violations.push(
          `change by ${
            change.ruleIds.join("+")
          } has no lint diagnostic for ${input}`,
        );
      }
    }
  });

  return violations;
}

/** Small deterministic pseudo-random generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const TOKENS: readonly string[] = [
  "Bonjour",
  "monde",
  "il",
  "dit",
  "Alors",
  "Suite",
  "etc.",
  "etc",
  "Paris",
  "été",
  "😀",
  ",",
  ".",
  ":",
  ";",
  "?",
  "!",
  "?!",
  "…",
  "...",
  "....",
  "«",
  "»",
  "(",
  ")",
  "[...]",
  "-",
  "25",
  "12,5",
  "1 000",
  "12345",
  "3.14",
  "2026",
  "10:30",
  "23:45:10",
  "1.2.3",
  "192.168.0.1",
  "%",
  "‰",
  "kg",
  "km/h",
  "m²",
  "€",
  "$",
  "http://ex.org:8080/a?b=1",
  "a::b",
  "C:\\Temp\\a.txt",
  "!important",
  "v1.2",
];

const SEPARATORS: readonly string[] = [
  "",
  " ",
  " ",
  " ",
  " ",
  " ",
  "  ",
  "\t",
];

/** Generates one logical text run split into nodes, some of them protected. */
export function generateNodes(random: () => number): TextNodeInput[] {
  const pick = <T>(values: readonly T[]): T =>
    values[Math.floor(random() * values.length)];
  const length = 1 + Math.floor(random() * 14);
  let text = random() < 0.2 ? pick(SEPARATORS) : "";
  for (let index = 0; index < length; index++) {
    text += pick(TOKENS);
    if (index < length - 1 || random() < 0.2) text += pick(SEPARATORS);
  }

  const characters = Array.from(text);
  const cuts = new Set<number>();
  const nodeCount = 1 + Math.floor(random() * 4);
  while (cuts.size < nodeCount - 1 && characters.length > nodeCount) {
    cuts.add(1 + Math.floor(random() * (characters.length - 1)));
  }
  const boundaries = [0, ...[...cuts].sort((a, b) => a - b), characters.length];
  const nodes: TextNodeInput[] = [];
  for (let index = 0; index + 1 < boundaries.length; index++) {
    const value = characters.slice(boundaries[index], boundaries[index + 1])
      .join("");
    nodes.push({
      id: `n${index}`,
      value,
      ...(random() < 0.15 ? { protected: true } : {}),
    });
  }
  return nodes;
}
