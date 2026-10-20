/**
 * Generates the table of docs/matrice-couverture-in-2002-v0.1.md from the
 * catalogue, the Imprimerie nationale preset, the `covers` declarations of the
 * tests, and docs/data/matrice-in-2002.json (docs/conception-matrice-generee-v0.1.md).
 *
 * Usage: deno run --allow-read --allow-write=docs scripts/coverage_matrix.ts
 *        deno run --allow-read scripts/coverage_matrix.ts --check
 */
import { PRESETS } from "../src/catalogue/presets.ts";
import { RULES } from "../src/catalogue/rules.ts";
import { EXECUTABLE_RULES } from "../src/rules/presets.ts";
import { type CoverageDeclaration, readCoverage } from "./test_coverage.ts";

const PRESET_ID = "fr-FR/imprimerie-nationale-2002";
const START = "<!-- matrice:début -->";
const END = "<!-- matrice:fin -->";
const HEADER = [
  "| Prescription atomique du dépouillement | Catalogue machine | Exécution sur `main` | Tests directs | Preset IN 2002 | Exclusions ou travail restant |",
  "|---|---|---|---|---|---|",
];

/** One row of the data file. */
export interface MatrixRow {
  readonly prescription: string;
  /** Catalogue entry the row is linked to. */
  readonly rule?: string;
  /** Catalogue column, when the row has no entry of its own. */
  readonly catalogue?: string;
  readonly execution: string;
  readonly tests?: string;
  readonly preset?: string;
  readonly remaining?: string;
}

export interface MatrixData {
  readonly exceptionLabels: Readonly<Record<string, string>>;
  readonly rows: readonly MatrixRow[];
}

/** Renders the table lines, or throws on inconsistent data. */
export function renderMatrix(
  data: MatrixData,
  coverage: readonly CoverageDeclaration[],
): string[] {
  const preset = PRESETS.find(({ id }) => id === PRESET_ID);
  if (preset === undefined) throw new Error(`Missing preset ${PRESET_ID}`);
  const lines = [...HEADER];
  for (const row of data.rows) {
    const rule = row.rule === undefined
      ? undefined
      : RULES.find(({ id }) => id === row.rule);
    if (row.rule !== undefined && rule === undefined) {
      throw new Error(`${row.prescription}: unknown rule ${row.rule}`);
    }
    if (rule === undefined) {
      for (const field of ["catalogue", "tests", "preset"] as const) {
        if (row[field] === undefined) {
          throw new Error(`${row.prescription}: missing ${field}`);
        }
      }
    }
    const executable = rule !== undefined && EXECUTABLE_RULES.has(rule.id);
    // An executable rule is not described as missing, and a documentary one
    // says that it does not run.
    if (
      rule !== undefined && row.catalogue === undefined &&
      (executable
        ? row.execution.startsWith("non")
        : !row.execution.includes("non"))
    ) {
      throw new Error(
        `${row.prescription}: execution "${row.execution}" contradicts ${rule.id}`,
      );
    }

    const catalogue = row.catalogue ?? `\`${rule?.id}\``;
    const files = [
      ...new Set(
        coverage.filter(({ ruleId }) => ruleId === rule?.id).map(({ file }) =>
          file
        ),
      ),
    ].sort();
    const tests = row.tests ??
      (files.length === 0 ? "non" : files.map((file) => `\`${file}\``).join(
        ", ",
      ));
    const selection = preset.rules.find(({ ruleId }) => ruleId === rule?.id);
    const mode = selection?.mode ?? rule?.defaultMode;
    const presetCell = row.preset ??
      (selection === undefined
        ? "non"
        : mode === "manual-review"
        ? "oui, `manual-review`"
        : "oui");
    // A row linked to the entry of another prescription only adds its notes.
    const exclusions = row.catalogue === undefined && rule !== undefined
      ? rule.exceptions.map(({ id }) => {
        const label = data.exceptionLabels[id];
        if (label === undefined) {
          throw new Error(`${rule.id}: no label for exception ${id}`);
        }
        return label;
      })
      : [];
    const notes = [
      exclusions.join(", "),
      row.remaining ?? "",
    ].filter((part) => part.length > 0).join(" ; ");
    lines.push(
      `| ${row.prescription} | ${catalogue} | ${row.execution} | ${tests} | ${presetCell} | ${
        notes.length === 0 ? "—" : notes
      } |`,
    );
  }
  return lines;
}

/** Replaces the table between the markers of the matrix document. */
export function replaceTable(
  document: string,
  lines: readonly string[],
): string {
  const start = document.indexOf(START);
  const end = document.indexOf(END);
  if (start < 0 || end < start) {
    throw new Error(`The matrix must contain ${START} and ${END}`);
  }
  return `${document.slice(0, start + START.length)}\n${lines.join("\n")}\n${
    document.slice(end)
  }`;
}

if (import.meta.main) {
  const root = new URL("../", import.meta.url);
  const documentUrl = new URL("docs/matrice-couverture-in-2002-v0.1.md", root);
  const data = JSON.parse(
    await Deno.readTextFile(new URL("docs/data/matrice-in-2002.json", root)),
  ) as MatrixData;
  const lines = renderMatrix(data, await readCoverage(root));
  const current = await Deno.readTextFile(documentUrl);
  const generated = replaceTable(current, lines);
  if (Deno.args.includes("--check")) {
    if (generated !== current) {
      console.error(
        "The coverage matrix is out of date; run deno task matrix.",
      );
      Deno.exit(1);
    }
  } else if (generated !== current) {
    await Deno.writeTextFile(documentUrl, generated);
    console.log("Updated docs/matrice-couverture-in-2002-v0.1.md");
  }
}
