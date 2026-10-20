/**
 * Measures the Imprimerie nationale preset on the reference corpus
 * (docs/corpus-reference-v0.1.md).
 *
 * Each domain file holds the expected text, reviewed by hand. The raw texts
 * are derived from it by fixed typing conventions, written independently of
 * the rules. The script reports the proposals on the expected text, which
 * must all be documented known gaps, and how far the corrected raw texts are
 * from the expected text.
 *
 * Usage: deno run --allow-read=tests/fixtures scripts/reference_corpus.ts
 */
import { IMPRIMERIE_NATIONALE_RULES, runPipeline } from "../src/mod.ts";
import type { RuleDiagnostic, TextSegment } from "../src/model.ts";

const directory = new URL("../tests/fixtures/reference/", import.meta.url);

/** Raw text variants, from typing conventions (corpus note, §4). */
export const VARIANTS = ["spaced", "compact"] as const;
export type Variant = typeof VARIANTS[number];

export interface Source {
  readonly file: string;
  readonly domain: string;
  readonly title: string;
  readonly author: string;
  readonly url?: string;
  readonly retrieved?: string;
  readonly license: string;
  readonly reviewed: boolean;
}

export interface KnownGap {
  readonly file: string;
  readonly ruleId: string;
  /** Text of the paragraph that contains the reported range. */
  readonly excerpt: string;
  readonly reason: string;
  readonly issue?: string;
}

/** Paragraphs of a domain file, separated by blank lines. */
export function paragraphs(text: string): string[] {
  return text.split(/\n[ \t]*\n/u).map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/**
 * Splits a paragraph into segments; inline code between backticks is
 * protected, as Markdown integrations protect code spans.
 */
export function segments(paragraph: string): TextSegment[] {
  const result: TextSegment[] = [];
  const pattern = /`[^`\n]*`/gu;
  let cursor = 0;
  for (const match of paragraph.matchAll(pattern)) {
    const start = match.index;
    if (start > cursor) {
      result.push({ value: paragraph.slice(cursor, start) });
    }
    result.push({ value: match[0], protected: true });
    cursor = start + match[0].length;
  }
  if (cursor < paragraph.length) {
    result.push({ value: paragraph.slice(cursor) });
  }
  return result.map((segment, index) => ({ id: `s${index}`, ...segment }));
}

const typographicSpace = /[\u00a0\u202f]/u;

/**
 * Raw text of an expected paragraph, typed on an ordinary keyboard: no-break
 * spaces become word spaces and the ellipsis glyph three periods; the compact
 * variant also omits the spaces that ordinary typing leaves out around high
 * punctuation and guillemets. Protected code is kept as is.
 */
export function rawText(paragraph: string, variant: Variant): string {
  return segments(paragraph).map(({ value, protected: isProtected }) => {
    if (isProtected) return value;
    let text = value;
    if (variant === "compact") {
      text = text.replace(/[\u00a0\u202f]([;:?!»])/gu, "$1")
        .replace(/«[\u00a0\u202f]/gu, "«");
    }
    return text.replace(new RegExp(typographicSpace, "gu"), " ")
      .replaceAll("…", "...");
  }).join("");
}

/** Number of inserted and deleted characters between two texts (Myers). */
export function editDistance(left: string, right: string): number {
  const a = [...left];
  const b = [...right];
  const max = a.length + b.length;
  const offset = max + 1;
  const frontier = new Int32Array(2 * max + 3);
  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d ||
          (k !== d && frontier[offset + k - 1] < frontier[offset + k + 1])
        ? frontier[offset + k + 1]
        : frontier[offset + k - 1] + 1;
      let y = x - k;
      while (x < a.length && y < b.length && a[x] === b[y]) {
        x++;
        y++;
      }
      frontier[offset + k] = x;
      if (x >= a.length && y >= b.length) return d;
    }
  }
  return max;
}

export interface Measure {
  readonly file: string;
  readonly characters: number;
  readonly paragraphs: number;
  /** Diagnostics on the expected text, in each rule's default mode. */
  readonly expected: readonly (RuleDiagnostic & { excerpt: string })[];
  readonly raw: Readonly<
    Record<Variant, {
      readonly diagnostics: number;
      readonly before: number;
      readonly after: number;
      readonly restored: number;
      /** Paragraphs that the corrections move further from the expected text. */
      readonly worsened: number;
    }>
  >;
}

function run(paragraph: string, mode?: "fix") {
  return runPipeline(segments(paragraph), IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    ...(mode === undefined ? {} : { mode }),
  });
}

/** Measures one domain file. */
export function measure(file: string, text: string): Measure {
  const list = paragraphs(text);
  const expected: (RuleDiagnostic & { excerpt: string })[] = [];
  for (const paragraph of list) {
    for (const diagnostic of run(paragraph).diagnostics) {
      expected.push({ ...diagnostic, excerpt: paragraph });
    }
  }
  const raw = Object.fromEntries(VARIANTS.map((variant) => {
    let diagnostics = 0;
    let before = 0;
    let after = 0;
    let restored = 0;
    let worsened = 0;
    for (const paragraph of list) {
      const input = rawText(paragraph, variant);
      const result = run(input, "fix");
      diagnostics += result.diagnostics.length;
      const initial = editDistance(input, paragraph);
      const distance = editDistance(result.value, paragraph);
      before += initial;
      after += distance;
      if (distance === 0) restored++;
      if (distance > initial) worsened++;
    }
    return [variant, { diagnostics, before, after, restored, worsened }];
  })) as Measure["raw"];
  return {
    file,
    characters: [...list.join("\n\n")].length,
    paragraphs: list.length,
    expected,
    raw,
  };
}

/** Diagnostics on the expected text that no known gap documents. */
export function undocumented(
  result: Measure,
  gaps: readonly KnownGap[],
): Measure["expected"] {
  return result.expected.filter((diagnostic) =>
    !gaps.some((gap) =>
      gap.file === result.file && gap.ruleId === diagnostic.ruleId &&
      diagnostic.excerpt.includes(gap.excerpt) &&
      diagnostic.excerpt.indexOf(gap.excerpt) <= offsetIn(diagnostic) &&
      offsetIn(diagnostic) <
        diagnostic.excerpt.indexOf(gap.excerpt) + gap.excerpt.length
    )
  );
}

/** Start of a diagnostic in its paragraph. */
function offsetIn(diagnostic: RuleDiagnostic & { excerpt: string }): number {
  const parts = segments(diagnostic.excerpt);
  let offset = 0;
  for (let index = 0; index < diagnostic.segmentIndex; index++) {
    offset += parts[index].value.length;
  }
  return offset + diagnostic.start;
}

export async function loadCorpus(): Promise<{
  sources: Source[];
  gaps: KnownGap[];
  texts: Map<string, string>;
}> {
  const sources = JSON.parse(
    await Deno.readTextFile(new URL("sources.json", directory)),
  ) as Source[];
  const gaps = JSON.parse(
    await Deno.readTextFile(new URL("known-gaps.json", directory)),
  ) as KnownGap[];
  const texts = new Map<string, string>();
  for (const { file } of sources) {
    texts.set(file, await Deno.readTextFile(new URL(file, directory)));
  }
  return { sources, gaps, texts };
}

if (import.meta.main) {
  const { sources, gaps, texts } = await loadCorpus();
  const rows: string[] = [
    "| File | Characters | Paragraphs | On expected (gaps) | Raw variant | Diagnostics | Distance before | Distance after | Restored | Worsened |",
    "| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  const byRule = new Map<string, number>();
  let failures = 0;
  for (const source of sources) {
    const result = measure(source.file, texts.get(source.file) ?? "");
    const missing = undocumented(result, gaps);
    failures += missing.length;
    for (const { ruleId } of result.expected) {
      byRule.set(ruleId, (byRule.get(ruleId) ?? 0) + 1);
    }
    for (const variant of VARIANTS) {
      const raw = result.raw[variant];
      rows.push(
        `| ${source.file} | ${result.characters} | ${result.paragraphs} | ${result.expected.length} (${
          result.expected.length - missing.length
        }) | ${variant} | ${raw.diagnostics} | ${raw.before} | ${raw.after} | ${raw.restored} | ${raw.worsened} |`,
      );
    }
    for (const diagnostic of missing) {
      const start = offsetIn(diagnostic);
      console.error(
        `${source.file}: undocumented ${diagnostic.ruleId} at «${
          diagnostic.excerpt.slice(Math.max(0, start - 20), start + 20)
        }»`,
      );
    }
  }
  console.log(rows.join("\n"));
  if (byRule.size > 0) {
    console.log("\nDiagnostics on the expected text by rule:");
    for (const [ruleId, count] of [...byRule].sort()) {
      console.log(`- ${ruleId}: ${count}`);
    }
  }
  if (failures > 0) Deno.exit(1);
}
