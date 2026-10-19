import { runPipeline } from "../../src/mod.ts";
import type { PipelineResult, RuleMode, TextSegment } from "../../src/model.ts";
import { COMPOSITIONS } from "./invariants.ts";

const corpusDirectory = new URL("../fixtures/corpus/", import.meta.url);
const snapshotUrl = new URL("snapshots.json", corpusDirectory);

/** Corpus files, in snapshot order. */
export const CORPUS_FILES: readonly string[] = [
  "prose.txt",
  "technique.txt",
  "nombres.txt",
];

/** Compositions whose outputs are recorded for every corpus paragraph. */
export const CORPUS_COMPOSITIONS: readonly string[] = [
  "IMPRIMERIE_NATIONALE_RULES",
  "IMPRIMERIE_NATIONALE_RULES with opt-in ellipsis rules",
];

type Mode = RuleMode | "default";
const MODES: readonly Mode[] = ["default", "lint", "fix"];

/** Splits a paragraph into unprotected segments of four words each. */
function segmentedNodes(paragraph: string): TextSegment[] {
  const words = paragraph.split(/(?<= )/u);
  const nodes: TextSegment[] = [];
  for (let index = 0; index < words.length; index += 4) {
    nodes.push({
      id: `n${nodes.length}`,
      value: words.slice(index, index + 4).join(""),
    });
  }
  return nodes;
}

function compact(result: PipelineResult, mode: Mode): unknown {
  return {
    ...(mode === "lint" ? {} : { value: result.value }),
    changes: result.changes.map((change) => [
      change.segmentIndex,
      change.start,
      change.end,
      change.expected,
      change.replacement,
      change.ruleIds.join("+"),
    ]),
    diagnostics: result.diagnostics.map((diagnostic) => [
      diagnostic.ruleId,
      diagnostic.segmentIndex,
      diagnostic.start,
      diagnostic.end,
      ...(diagnostic.replacement === undefined ? [] : [diagnostic.replacement]),
    ]),
    // Each group as its diagnostic indexes and its change IDs.
    ...(result.groups.length === 0 ? {} : {
      groups: result.groups.map((group) => [
        group.diagnostics.join(" "),
        group.changeIds.join(" "),
      ]),
    }),
  };
}

/** Paragraphs of every corpus file, keyed as `file#index`. */
export async function readCorpus(): Promise<Map<string, string>> {
  const paragraphs = new Map<string, string>();
  for (const file of CORPUS_FILES) {
    const text = await Deno.readTextFile(new URL(file, corpusDirectory));
    text.split(/\n{2,}/u).map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .forEach((paragraph, index) => {
        paragraphs.set(`${file}#${index + 1}`, paragraph);
      });
  }
  return paragraphs;
}

/** Computes the snapshot of every paragraph, composition, and mode. */
export function computeSnapshots(
  paragraphs: ReadonlyMap<string, string>,
): Record<string, unknown> {
  const snapshots: Record<string, unknown> = {};
  for (const [key, paragraph] of paragraphs) {
    const entry: Record<string, unknown> = { source: paragraph };
    for (const name of CORPUS_COMPOSITIONS) {
      const composition = COMPOSITIONS.find((candidate) =>
        candidate.name === name
      );
      if (composition === undefined) {
        throw new Error(`Unknown composition ${name}`);
      }
      const outputs: Record<string, unknown> = {};
      for (
        const [variant, nodes] of [
          ["single", [{ id: "n0", value: paragraph }]],
          ["segmented", segmentedNodes(paragraph)],
        ] as const
      ) {
        for (const mode of MODES) {
          const result = runPipeline(nodes, composition.rules, {
            locale: "fr-FR",
            ...(mode === "default" ? {} : { mode }),
          });
          outputs[`${variant}/${mode}`] = compact(result, mode);
        }
      }
      entry[name] = outputs;
    }
    snapshots[key] = entry;
  }
  return snapshots;
}

/** Serializes snapshots with one line per change or diagnostic. */
export function formatSnapshots(snapshots: Record<string, unknown>): string {
  const json = JSON.stringify(
    snapshots,
    (_key, value) =>
      Array.isArray(value) && value.every((item) => typeof item !== "object")
        ? `\u0000${JSON.stringify(value)}`
        : value,
    2,
  );
  return `${
    json.replace(
      /"\\u0000((?:[^"\\]|\\.)*)"/gu,
      (_match, encoded: string) => JSON.parse(`"${encoded}"`),
    ).replace(/[\u00a0\u202f]/gu, (space) =>
      `\\u${space.codePointAt(0)?.toString(16).padStart(4, "0")}`)
  }\n`;
}

/** Reads the committed snapshots. */
export async function readSnapshots(): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(snapshotUrl));
}

if (import.meta.main) {
  const snapshots = computeSnapshots(await readCorpus());
  await Deno.writeTextFile(snapshotUrl, formatSnapshots(snapshots));
  console.log(`Wrote ${Object.keys(snapshots).length} corpus snapshots.`);
}
