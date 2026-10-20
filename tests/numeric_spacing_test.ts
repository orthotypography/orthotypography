import assert from "node:assert/strict";
import {
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  PERCENTAGE_SPACING_RULE,
  runPipeline,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";
import { covers } from "./support/coverage.ts";

Deno.test("percentage spacing uses a no-break space", () => {
  covers("number.percent.nbsp-before");
  const result = runPipeline(
    "25% ; 25,5 % ; 3‰",
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-FR" },
  );

  assert.equal(result.value, "25\u00a0%\u202f; 25,5\u00a0%\u202f; 3\u00a0‰");
});

Deno.test("percentage spacing preserves identifiers and protected URI", () => {
  covers("number.percent.nbsp-before", ["identifier", "protected-content"]);
  const input = "%PATH% prix%variable https://exemple.fr/25%";
  const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
  });

  assert.equal(result.value, input);
});

Deno.test("percentage spacing supports lint mode", () => {
  const input = "25%";
  const result = runPipeline(input, [
    NUMERIC_PROTECTION_RULE,
    PERCENTAGE_SPACING_RULE,
  ], { locale: "fr-FR", mode: "lint" });

  assert.equal(result.value, input);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].replacement, "25\u00a0%");
});

Deno.test("percentage spacing requires numeric classification", () => {
  assertCode(
    () => runPipeline("25%", [PERCENTAGE_SPACING_RULE], { locale: "fr-FR" }),
    "MISSING_ANNOTATION_PROVIDER",
  );
});

Deno.test("percentage spacing is idempotent", () => {
  const first = runPipeline("25%", IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
  });
  const second = runPipeline(first.value, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
  });

  assert.equal(second.value, first.value);
  assert.deepEqual(second.diagnostics, []);
});
