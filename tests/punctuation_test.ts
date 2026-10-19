import assert from "node:assert/strict";
import {
  applyTextChanges,
  HIGH_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  runPipeline,
  runTextNodePipeline,
  SAFE_PUNCTUATION_RULES,
} from "../src/mod.ts";
import type { TextSegment } from "../src/model.ts";

Deno.test("safe punctuation rules remove whitespace before comma and period", () => {
  const result = runPipeline(
    "Bonjour , monde. Fin .",
    SAFE_PUNCTUATION_RULES,
    { locale: "fr-FR" },
  );

  assert.equal(result.value, "Bonjour, monde. Fin.");
  assert.equal(result.diagnostics.length, 2);
});

Deno.test("safe punctuation rules report without changing text in lint mode", () => {
  const input = "Bonjour , monde .";
  const result = runPipeline(input, SAFE_PUNCTUATION_RULES, {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(result.value, input);
  assert.equal(result.diagnostics.length, 2);
});

Deno.test("safe punctuation rules preserve protected segments", () => {
  const result = runPipeline(
    [
      { value: "Bonjour ," },
      { value: " code .", protected: true },
    ],
    SAFE_PUNCTUATION_RULES,
    { locale: "fr-FR" },
  );

  assert.equal(result.value, "Bonjour, code .");
});

Deno.test("safe punctuation rules are idempotent", () => {
  const first = runPipeline(
    "Bonjour , monde .",
    SAFE_PUNCTUATION_RULES,
    { locale: "fr-FR" },
  );
  const second = runPipeline(first.value, SAFE_PUNCTUATION_RULES, {
    locale: "fr-FR",
  });

  assert.equal(second.value, first.value);
  assert.deepEqual(second.diagnostics, []);
});

Deno.test("high punctuation rules apply source-specific French spacing", () => {
  const result = runPipeline(
    "Note:exemple; vraiment? Bravo!",
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR" },
  );

  assert.equal(
    result.value,
    "Note\u00a0: exemple\u202f; vraiment\u202f? Bravo\u202f!",
  );
});

Deno.test("colon spacing preserves classified numeric and technical contexts", () => {
  const input =
    "À 12:30, ratio 1:2, https://exemple.fr:443/a, localhost:3000 et ::before. " +
    "Sauvegarde à 23:45:10 dans C:\\Temp\\rapport.txt ou D:/data.";
  const result = runPipeline(
    input,
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR" },
  );

  assert.equal(result.value, input);
});

Deno.test("high punctuation preserves expressive and code-like sequences", () => {
  const input = "Quoi?! Vraiment!! Déclaration !important";
  const result = runPipeline(
    input,
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR" },
  );

  assert.equal(result.value, input);
  assert.deepEqual(result.diagnostics, []);
});

Deno.test("high punctuation rules require their classifier dependency", () => {
  assert.throws(
    () =>
      runPipeline("Note: exemple", HIGH_PUNCTUATION_RULES, {
        locale: "fr-FR",
      }),
    Error,
    "Missing dependency classify.numeric-constructs",
  );
});

Deno.test("high punctuation composition is idempotent", () => {
  const first = runPipeline(
    "Note:exemple; vraiment? Bravo!",
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR" },
  );
  const second = runPipeline(
    first.value,
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR" },
  );

  assert.equal(second.value, first.value);
  assert.deepEqual(second.diagnostics, []);
});

Deno.test("high punctuation supports lint mode", () => {
  const input = "Note:exemple; vraiment?";
  const result = runPipeline(
    input,
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR", mode: "lint" },
  );

  assert.equal(result.value, input);
  assert.equal(result.diagnostics.length, 4);
});

Deno.test("French punctuation rules do not run for another locale", () => {
  const input = "Note: example; really?";
  const result = runPipeline(
    input,
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "en-US" },
  );

  assert.equal(result.value, input);
  assert.deepEqual(result.appliedRuleIds, []);
});

Deno.test("period spacing leaves runs of periods to the ellipsis rules", () => {
  for (
    const [input, expected] of [
      ["Alors ...", "Alors ..."],
      [
        "Il m’a traité de ... devant tout le monde.",
        "Il m’a traité de ... devant tout le monde.",
      ],
      ["Espèce de ... !", "Espèce de ... !"],
      ["Fin ....", "Fin ...."],
      ["Fin .", "Fin."],
    ]
  ) {
    const result = runPipeline(input, SAFE_PUNCTUATION_RULES, {
      locale: "fr-FR",
      mode: "fix",
    });
    assert.equal(result.value, expected, input);
  }
  const split = runTextNodePipeline(
    [{ id: "a", value: "Alors ." }, { id: "b", value: ".." }],
    SAFE_PUNCTUATION_RULES,
    { locale: "fr-FR", mode: "fix" },
  );
  assert.deepEqual(split.changes, []);
});

function fixNodes(values: readonly (string | TextSegment)[]): string[] {
  const nodes = values.map((value, index) => ({
    id: `n${index}`,
    ...(typeof value === "string" ? { value } : value),
  }));
  const result = runTextNodePipeline(
    nodes,
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR", mode: "fix" },
  );
  assert.deepEqual(
    applyTextChanges(nodes, result.changes).map(({ value }) => value),
    result.nodes.map(({ value }) => value),
  );
  return result.nodes.map(({ value }) => value);
}

Deno.test("punctuation spacing stays in the mark's node", () => {
  assert.deepEqual(fixNodes(["Bonjour,", "monde"]), ["Bonjour, ", "monde"]);
  assert.deepEqual(fixNodes(["Bonjour", "; oui"]), ["Bonjour", " ; oui"]);
  assert.deepEqual(fixNodes(["Bonjour ", ";oui"]), ["Bonjour", " ; oui"]);
  // A correct space after the mark stays in its node (#63).
  assert.deepEqual(fixNodes(["Bonjour :", " suite"]), [
    "Bonjour\u00a0:",
    " suite",
  ]);
  assert.deepEqual(fixNodes(["Oui ", " ", "!"]), ["Oui", "", " !"]);
  assert.deepEqual(fixNodes(["Bonjour", "  ,", " monde"]), [
    "Bonjour",
    ",",
    " monde",
  ]);
});

Deno.test("technical tokens before a comma extend across unprotected nodes", () => {
  assert.deepEqual(fixNodes(["http", "://x,y"]), ["http", "://x,y"]);
  assert.deepEqual(
    fixNodes(["http://", { value: "x", protected: true }, "a,b"]),
    ["http://", "x", "a, b"],
  );
});

Deno.test("empty protected nodes do not affect punctuation rules", () => {
  const empty = { value: "", protected: true };
  assert.deepEqual(fixNodes(["Bonjour,", empty, "monde"]), [
    "Bonjour, ",
    "",
    "monde",
  ]);
  assert.deepEqual(fixNodes(["Fin .", empty, ".."]), ["Fin .", "", ".."]);
  assert.deepEqual(
    fixNodes(["Fin .", { value: "x", protected: true }, ".."]),
    ["Fin.", "x", ".."],
  );
});
