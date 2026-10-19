import assert from "node:assert/strict";
import {
  type MatrixData,
  renderMatrix,
  replaceTable,
} from "../scripts/coverage_matrix.ts";

// Issue #28: the coverage matrix table is generated
// (docs/conception-matrice-generee-v0.1.md).
const coverage = [
  {
    file: "a_test.ts",
    ruleId: "punctuation.comma.no-space-before",
    exceptionIds: [],
  },
  {
    file: "b_test.ts",
    ruleId: "punctuation.comma.no-space-before",
    exceptionIds: ["protected-content"],
  },
];
const labels = { "protected-content": "contenu protégé" };

Deno.test("matrix rows combine the catalogue, the preset, and the tests", () => {
  const data: MatrixData = {
    exceptionLabels: labels,
    rows: [
      {
        prescription: "`space.before.comma`",
        rule: "punctuation.comma.no-space-before",
        execution: "`SAFE_PUNCTUATION_RULES` : `fix`",
        remaining: "note",
      },
      {
        prescription: "`dash.spacing`",
        catalogue: "issue de source seulement",
        execution: "non",
        tests: "non",
        preset: "non",
      },
    ],
  };
  assert.deepEqual(renderMatrix(data, coverage).slice(2), [
    "| `space.before.comma` | `punctuation.comma.no-space-before` | `SAFE_PUNCTUATION_RULES` : `fix` | `a_test.ts`, `b_test.ts` | oui | contenu protégé ; note |",
    "| `dash.spacing` | issue de source seulement | non | non | non | — |",
  ]);
});

Deno.test("matrix data must stay consistent with the catalogue", () => {
  const row = {
    prescription: "`space.before.comma`",
    rule: "punctuation.comma.no-space-before",
    execution: "`SAFE_PUNCTUATION_RULES` : `fix`",
  };
  assert.throws(
    () => renderMatrix({ exceptionLabels: {}, rows: [row] }, coverage),
    /no label for exception protected-content/,
  );
  assert.throws(
    () =>
      renderMatrix({
        exceptionLabels: labels,
        rows: [{ ...row, execution: "non" }],
      }, coverage),
    /contradicts/,
  );
  assert.throws(
    () =>
      renderMatrix({
        exceptionLabels: labels,
        rows: [{ ...row, rule: "punctuation.unknown" }],
      }, coverage),
    /unknown rule/,
  );
  assert.throws(
    () =>
      renderMatrix({
        exceptionLabels: labels,
        rows: [{ prescription: "`x`", execution: "non" }],
      }, coverage),
    /missing catalogue/,
  );
});

Deno.test("the table is replaced between its markers only", () => {
  const document =
    "avant\n<!-- matrice:début -->\nancien\n<!-- matrice:fin -->\naprès\n";
  assert.equal(
    replaceTable(document, ["| a |", "| b |"]),
    "avant\n<!-- matrice:début -->\n| a |\n| b |\n<!-- matrice:fin -->\naprès\n",
  );
  assert.throws(() => replaceTable("sans marqueurs", []), /must contain/);
});
