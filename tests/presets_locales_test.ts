import assert from "node:assert/strict";
import * as core from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";
import {
  compilePreset,
  EXECUTABLE_RULES,
  IMPRIMERIE_NATIONALE_RULES,
  ruleLocaleSupport,
  runPipeline,
  runTextNodePipeline,
} from "../src/mod.ts";
import {
  PRESETS,
  RULES,
  SOURCES,
  validateCatalogue,
} from "../src/catalogue/mod.ts";
import type { RuntimeRule } from "../src/model.ts";
import { testRule } from "./support/rules.ts";

const nbsp = " ";
const nnbsp = " ";

/** Catalogue rules of each preset with no executable implementation. */
const documentaryRules: Readonly<Record<string, readonly string[]>> = {
  "fr-FR/imprimerie-nationale-2002": ["punctuation.period.space-after"],
  "fr-CA/oqlf": [],
};

Deno.test("every catalogue preset compiles to its executable rules", () => {
  assert.deepEqual(
    PRESETS.map(({ id }) => id).sort(),
    Object.keys(documentaryRules).sort(),
  );
  for (const preset of PRESETS) {
    const compiled = compilePreset(preset.id);
    const compiledIds = new Set(compiled.map(({ id }) => id));
    const missing = preset.rules.map(({ ruleId }) => ruleId).filter((id) =>
      !compiledIds.has(id)
    );
    assert.deepEqual(missing, documentaryRules[preset.id], preset.id);
    // Every compiled rule takes the preset's mode, or the catalogue's.
    for (const rule of compiled) {
      const selection = preset.rules.find(({ ruleId }) => ruleId === rule.id);
      const definition = RULES.find(({ id }) => id === rule.id);
      assert.equal(
        rule.defaultMode,
        selection?.mode ?? definition?.defaultMode,
        `${preset.id} ${rule.id}`,
      );
    }
  }
});

Deno.test("the registry holds every exported executable rule", () => {
  const exported = new Set<string>();
  for (const value of Object.values(core)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === "object" && item !== null && "apply" in item) {
        exported.add((item as RuntimeRule).id);
      }
    }
  }
  assert.deepEqual([...exported].sort(), [...EXECUTABLE_RULES.keys()].sort());
  const catalogued = new Set(RULES.map(({ id }) => id));
  for (const id of EXECUTABLE_RULES.keys()) assert.ok(catalogued.has(id), id);
});

Deno.test("the Imprimerie nationale export is the compiled preset", () => {
  assert.deepEqual(
    IMPRIMERIE_NATIONALE_RULES.map(({ id, defaultMode }) => [id, defaultMode]),
    compilePreset("fr-FR/imprimerie-nationale-2002").map((
      { id, defaultMode },
    ) => [id, defaultMode]),
  );
});

Deno.test("preset modes drive the default mode and review hints", () => {
  // The Quebec preset reports the space before ; ? ! instead of fixing it.
  const quebec = compilePreset("fr-CA/oqlf");
  const input = "Oui; non? oui!";
  const byDefault = runPipeline(input, quebec, { locale: "fr-CA" });
  assert.equal(byDefault.value, input);
  assert.deepEqual(
    byDefault.diagnostics.map(({ ruleId }) => ruleId).sort(),
    [
      "punctuation.exclamation.nnbsp-before",
      "punctuation.question.nnbsp-before",
      "punctuation.semicolon.nnbsp-before",
    ],
  );
  const review = runPipeline(input, quebec, {
    locale: "fr-CA",
    mode: "review",
  });
  assert.equal(review.value, `Oui${nnbsp}; non${nnbsp}? oui${nnbsp}!`);
  assert.ok(
    review.diagnostics.every(({ suggested }) => suggested === "review"),
  );

  // An override turns the euro rule of the Imprimerie nationale into a fix.
  const euroFix = compilePreset("fr-FR/imprimerie-nationale-2002", {
    modes: { "number.euro.nbsp-before": "fix" },
  });
  assert.equal(
    runPipeline("Prix 12€.", IMPRIMERIE_NATIONALE_RULES, { locale: "fr-FR" })
      .value,
    "Prix 12€.",
  );
  assert.equal(
    runPipeline("Prix 12€.", euroFix, { locale: "fr-FR" }).value,
    `Prix 12${nbsp}€.`,
  );
});

Deno.test("compiling rejects unknown presets and foreign overrides", () => {
  assertCode(() => compilePreset("fr-BE/unknown"), "UNKNOWN_PRESET");
  assertCode(() =>
    compilePreset("fr-CA/oqlf", {
      modes: { "punctuation.comma.space-after": "lint" },
    }), "INVALID_PRESET_OVERRIDE");
});

Deno.test("manual-review behaves as lint at run time", () => {
  const bang = testRule("x-test.bang", (run) =>
    run.text.endsWith("!") ? {} : {
      edits: [{
        start: run.text.length,
        end: run.text.length,
        replacement: "!",
      }],
    }, { defaultMode: "manual-review" });
  assert.equal(runPipeline("Oui", [bang], { locale: "fr-FR" }).value, "Oui");
  assert.equal(
    runPipeline("Oui", [bang], { locale: "fr-FR", mode: "fix" }).value,
    "Oui!",
  );
  const review = runPipeline("Oui", [bang], {
    locale: "fr-FR",
    mode: "review",
  });
  assert.equal(review.value, "Oui!");
  assert.equal(review.diagnostics[0].suggested, "review");
});

Deno.test("locales are canonicalized and matched without fallback", () => {
  const input = "Bonjour , monde : 25%.";
  const expected = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    mode: "fix",
  });
  for (const locale of ["fr-fr", "FR-fr", "fr-FR"]) {
    const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
      locale,
      mode: "fix",
    });
    assert.equal(result.value, expected.value, locale);
    assert.deepEqual(result.skippedRuleIds, [], locale);
  }
  for (const locale of ["fr", "fr-BE", "en-US"]) {
    assertCode(
      () => runPipeline(input, IMPRIMERIE_NATIONALE_RULES, { locale }),
      "UNSUPPORTED_LOCALE",
    );
  }
  assertCode(
    () => runPipeline(input, IMPRIMERIE_NATIONALE_RULES, { locale: "fr_FR" }),
    "INVALID_LOCALE",
  );
  // An empty composition supports nothing and runs nothing.
  assert.equal(runPipeline(input, [], { locale: "en-US" }).value, input);
});

Deno.test("rules that do not support the locale are reported", () => {
  // The Imprimerie nationale space-after rules are scoped to fr-FR.
  const support = ruleLocaleSupport(IMPRIMERIE_NATIONALE_RULES, "fr-ca");
  assert.equal(support.locale, "fr-CA");
  assert.deepEqual(support.unsupported, [
    "punctuation.comma.space-after",
    "punctuation.colon.space-after",
    "punctuation.semicolon.space-after",
    "punctuation.question.space-after",
    "punctuation.exclamation.space-after",
    "punctuation.ellipsis.after-etc.forbidden",
  ]);
  const result = runTextNodePipeline(
    [{ id: "n", value: "Oui ,non" }],
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-CA", mode: "fix" },
  );
  assert.deepEqual(result.skippedRuleIds, support.unsupported);
  assert.deepEqual(result.appliedRuleIds, support.supported);
  assert.equal(result.value, "Oui,non");

  const unsupported = ruleLocaleSupport(IMPRIMERIE_NATIONALE_RULES, "en-US");
  assert.deepEqual(unsupported.supported, []);
});

Deno.test("catalogue locales are canonical", () => {
  assert.deepEqual(validateCatalogue(SOURCES, RULES, PRESETS), []);
  const issues = validateCatalogue(SOURCES, [
    { ...RULES[0], locales: ["fr-fr"] },
  ], []);
  assert.ok(issues.some(({ message }) => message.includes("fr-fr")));
});
