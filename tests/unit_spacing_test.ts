import assert from "node:assert/strict";
import {
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
  UNIT_SPACING_RULE,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";

Deno.test("unit spacing is diagnostic by default", () => {
  const input = "12kg";
  const result = runPipeline(
    input,
    [NUMERIC_PROTECTION_RULE, UNIT_SPACING_RULE],
    { locale: "fr-FR" },
  );

  assert.equal(result.value, input);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].replacement, "12\u00a0kg");
});

Deno.test("unit spacing fixes recognized symbols when requested", () => {
  const result = runPipeline(
    "12kg ; 20°C ; 2 kPa ; 5 µm",
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-FR", mode: "fix" },
  );

  assert.equal(
    result.value,
    "12\u00a0kg\u202f; 20\u00a0°C\u202f; 2\u00a0kPa\u202f; 5\u00a0µm",
  );
});

Deno.test("unit spacing preserves exclusions and technical text", () => {
  const input = "20° / 12 kilogrammes / 12 Kg / https://x.test/12kg";
  const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
  });

  assert.equal(result.value, input);
  assert.deepEqual(
    result.diagnostics.filter(({ ruleId }) =>
      ruleId === "number.unit.nbsp-before"
    ),
    [],
  );
});

Deno.test("unit spacing requires numeric classification", () => {
  assertCode(
    () => runPipeline("12kg", [UNIT_SPACING_RULE], { locale: "fr-FR" }),
    "MISSING_ANNOTATION_PROVIDER",
  );
});

Deno.test("unit spacing is idempotent in fix mode", () => {
  const rules = [NUMERIC_PROTECTION_RULE, UNIT_SPACING_RULE];
  const first = runPipeline("12kg", rules, {
    locale: "fr-FR",
    mode: "fix",
  });
  const second = runPipeline(first.value, rules, {
    locale: "fr-FR",
    mode: "fix",
  });

  assert.equal(second.value, first.value);
  assert.deepEqual(second.diagnostics, []);
});

Deno.test("unit spacing handles explicit compound SI expressions", () => {
  const result = runPipeline(
    "9,81m/s ; 5m² ; 3kW⋅h ; 2 kg⋅m⋅s⁻²",
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-FR", mode: "fix" },
  );

  assert.equal(
    result.value,
    "9,81\u00a0m/s\u202f; 5\u00a0m²\u202f; 3\u00a0kW⋅h\u202f; 2\u00a0kg⋅m⋅s⁻²",
  );
});

Deno.test("unit spacing rejects ambiguous compound-like strings", () => {
  const input = "12m/s/kg / 12m·s / 12m*s / 12m^2 / 12mps / 12m⁰";
  const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    mode: "fix",
  });

  assert.equal(result.value, input);
  assert.deepEqual(
    result.diagnostics.filter(({ ruleId }) =>
      ruleId === "number.unit.nbsp-before"
    ),
    [],
  );
});

Deno.test("unit spacing handles parenthesized compound SI expressions", () => {
  const result = runPipeline(
    "2m/(s⋅kg) ; 4(m/s)²",
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-FR", mode: "fix" },
  );

  assert.equal(result.value, "2\u00a0m/(s⋅kg)\u202f; 4\u00a0(m/s)²");
});
