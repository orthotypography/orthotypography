/**
 * Reads the `covers(ruleId, [exceptionIds])` declarations of the test sources.
 * Shared by `scripts/coverage_matrix.ts` and `tests/coverage_test.ts`.
 */

/** One `covers` call: the test file, the rule, and the exceptions. */
export interface CoverageDeclaration {
  readonly file: string;
  readonly ruleId: string;
  readonly exceptionIds: readonly string[];
}

const coversCall =
  /\bcovers\(\s*"([^"]+)"\s*(?:,\s*\[((?:\s*"[^"]*"\s*,?)*)\s*\]\s*)?,?\s*\)/gu;

/** Declarations found in one test source. */
export function parseCoverage(
  file: string,
  source: string,
): CoverageDeclaration[] {
  const declarations: CoverageDeclaration[] = [];
  for (const match of source.matchAll(coversCall)) {
    const exceptionIds = [...(match[2] ?? "").matchAll(/"([^"]*)"/gu)].map((
      [, id],
    ) => id);
    declarations.push({ file, ruleId: match[1], exceptionIds });
  }
  return declarations;
}

/** Declarations of every test file under `tests/`, by file name. */
export async function readCoverage(
  root: URL,
): Promise<CoverageDeclaration[]> {
  const declarations: CoverageDeclaration[] = [];
  const directory = new URL("tests/", root);
  const names: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    // The coverage test holds sample declarations for the parser.
    if (
      entry.isFile && entry.name.endsWith("_test.ts") &&
      entry.name !== "coverage_test.ts"
    ) names.push(entry.name);
  }
  for (const name of names.sort()) {
    const source = await Deno.readTextFile(new URL(name, directory));
    declarations.push(...parseCoverage(name, source));
  }
  return declarations;
}
