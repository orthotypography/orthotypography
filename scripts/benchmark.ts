/**
 * Measures pipeline time on repeated corpus text.
 *
 * Usage: `deno task bench [--quick | --full | --scaling]`. The default sizes
 * are 25,000 and 125,000 characters; `--quick` keeps the smallest size and
 * `--full` adds 500,000 characters. Each size runs as one segment and as nodes
 * of about 120 characters, in lint and fix modes.
 *
 * `--scaling` instead measures growth on inputs that stress the pipeline and
 * the rules, with every executable rule (the preset and its opt-in rules):
 * sizes of 31,250, 62,500, and 125,000 characters, and the growth factor per
 * doubling of the size. A factor close to 2 is linear; a factor close to 4 is
 * quadratic. A size that takes more than 20 seconds ends its row. Two
 * external rules then stress the change ledger alone, and a last row measures
 * `applyTextChanges` with one change every six characters.
 */
import {
  applyTextChanges,
  DIGIT_GROUPING_RULE,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
  IMPRIMERIE_NATIONALE_RULES,
  runPipeline,
  runTextNodePipeline,
} from "../src/mod.ts";
import type {
  LogicalRun,
  RuleMode,
  RuleResult,
  RuntimeRule,
  TextChange,
  TextSegment,
} from "../src/model.ts";

const corpusFiles = ["prose.txt", "technique.txt", "nombres.txt"];
const corpusDirectory = new URL("../tests/fixtures/corpus/", import.meta.url);

const sizes = Deno.args.includes("--quick")
  ? [25_000]
  : Deno.args.includes("--full")
  ? [25_000, 125_000, 500_000]
  : [25_000, 125_000];

const corpus = (await Promise.all(
  corpusFiles.map((file) => Deno.readTextFile(new URL(file, corpusDirectory))),
)).join("\n");

function textOfSize(size: number): string {
  let text = "";
  while (text.length < size) text += corpus;
  const cut = text.lastIndexOf(" ", size);
  return text.slice(0, cut > 0 ? cut : size);
}

function nodesOf(text: string): { id: string; value: string }[] {
  const nodes: { id: string; value: string }[] = [];
  let start = 0;
  while (start < text.length) {
    const next = text.indexOf(" ", start + 120);
    const end = next === -1 ? text.length : next + 1;
    nodes.push({ id: `n${nodes.length}`, value: text.slice(start, end) });
    start = end;
  }
  return nodes;
}

function measure(run: () => void): number {
  const samples: number[] = [];
  const started = performance.now();
  do {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  } while (samples.length < 3 && performance.now() - started < 5_000);
  samples.sort((left, right) => left - right);
  return samples[Math.floor(samples.length / 2)];
}

const modes: readonly RuleMode[] = ["lint", "fix"];

type Input = string | readonly TextSegment[];

/** Inputs of about `size` characters that stress one cost each. */
const scalingInputs: Readonly<Record<string, (size: number) => Input>> = {
  "corpus, one segment": (size) => textOfSize(size),
  "corpus, four-word nodes": (size) => {
    const words = textOfSize(size).split(/(?<= )/u);
    const nodes: TextSegment[] = [];
    for (let index = 0; index < words.length; index += 4) {
      nodes.push({ value: words.slice(index, index + 4).join("") });
    }
    return nodes;
  },
  "corpus, one-character nodes": (size) =>
    [...textOfSize(size)].map((value) => ({ value })),
  "commas in one token": (size) => "a,".repeat(size / 2),
  "spaced high punctuation": (size) => "a ; b : c ! d ? ".repeat(size / 16),
  "dense numbers": (size) =>
    "10 % 12:30 1.2.3 25 € 3 km 4,5 ".repeat(size / 32),
  "dense suspension points": (size) =>
    "Oui... etc... [...] …non ".repeat(size / 25),
  "suspension points in one token": (size) => "a...b…".repeat(size / 6),
  "suspension point nodes": (size) =>
    Array.from({ length: Math.floor(size / 11) * 5 }, (_, index) => ({
      value: ["Oui", "...", " ", "…", "non "][index % 5],
    })),
  "spacing nodes around marks": (size) =>
    Array.from({ length: Math.floor(size / 7) * 4 }, (_, index) => ({
      value: ["mot", " ", "  ", ";"][index % 4],
    })),
  "protected node per phrase": (size) =>
    Array.from({ length: Math.floor(size / 11) * 3 }, (_, index) => ({
      value: ["Texte, ", "x:", " ?"][index % 3],
      ...(index % 3 === 1 ? { protected: true } : {}),
    })),
};

/** Every executable rule: the preset and its opt-in rules. */
const scalingRules = [
  ...IMPRIMERIE_NATIONALE_RULES,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE,
  DIGIT_GROUPING_RULE,
];

/** External rule replacing every occurrence of one character. */
function replaceEach(id: string, from: string, to: string): RuntimeRule {
  return {
    id,
    phase: "cleanup",
    locales: ["fr-FR"],
    defaultMode: "fix",
    apply(run: LogicalRun): RuleResult {
      const diagnostics = [];
      for (let index = 0; index < run.text.length; index++) {
        if (run.text[index] !== from) continue;
        const edit = { start: index, end: index + 1, replacement: to };
        diagnostics.push({ ...edit, message: id, edits: [edit] });
      }
      return { diagnostics };
    },
  };
}

/**
 * Ledger stress: the first rule rewrites every character, so that its edits
 * coalesce into one changed piece; the second edits every character of that
 * piece again.
 */
const ledgerRules = [
  replaceEach("x-bench.rewrite", "a", "b"),
  replaceEach("x-bench.refine", "b", "c"),
];
const ledgerInputs: Readonly<Record<string, (size: number) => Input>> = {
  "edits refining one changed piece": (size) => "a".repeat(size),
};

if (Deno.args.includes("--scaling")) {
  const scalingSizes = [31_250, 62_500, 125_000];
  console.log(
    `| Input | Mode | ${
      scalingSizes.map((size) => `${size}`).join(" | ")
    } | Growth per doubling |`,
  );
  console.log(
    `| --- | --- | ${scalingSizes.map(() => "---:").join(" | ")} | ---: |`,
  );
  const cases = [
    ...Object.entries(scalingInputs).map(([name, make]) =>
      [name, make, scalingRules, modes] as const
    ),
    ...Object.entries(ledgerInputs).map(([name, make]) =>
      [name, make, ledgerRules, ["fix"] as const] as const
    ),
  ];
  for (const [name, make, rules, caseModes] of cases) {
    for (const mode of caseModes) {
      const times: number[] = [];
      for (const size of scalingSizes) {
        const input = make(size);
        times.push(
          measure(() =>
            runPipeline(input, rules, {
              locale: "fr-FR",
              mode,
            })
          ),
        );
        if (times[times.length - 1] > 20_000) break;
      }
      const cells = scalingSizes.map((_, index) =>
        times[index] === undefined ? "—" : `${times[index].toFixed(0)} ms`
      );
      const growth = times.length === scalingSizes.length
        ? Math.sqrt(times[2] / Math.max(times[0], 1)).toFixed(1)
        : "—";
      console.log(`| ${name} | ${mode} | ${cells.join(" | ")} | ${growth} |`);
    }
  }
  // Applying many changes to one segment (issue #80).
  const applyTimes = scalingSizes.map((size) => {
    const text = "abcdef".repeat(Math.ceil(size / 6)).slice(0, size);
    const changes: Omit<TextChange, "id">[] = [];
    for (let start = 0; start + 1 <= size; start += 6) {
      changes.push({
        segmentIndex: 0,
        start,
        end: start + 1,
        expected: text[start],
        replacement: "AB",
        ruleIds: ["x-bench.apply"],
      });
    }
    return measure(() => applyTextChanges(text, changes));
  });
  console.log(
    `| applyTextChanges, a change every 6 characters | fix | ${
      applyTimes.map((time) => `${time.toFixed(1)} ms`).join(" | ")
    } | ${
      Math.sqrt(applyTimes[2] / Math.max(applyTimes[0], 0.01)).toFixed(1)
    } |`,
  );
  Deno.exit(0);
}

console.log("| Input | Characters | Mode | Median time |");
console.log("| --- | ---: | --- | ---: |");
for (const size of sizes) {
  const text = textOfSize(size);
  const nodes = nodesOf(text);
  for (const mode of modes) {
    const single = measure(() =>
      runPipeline(text, IMPRIMERIE_NATIONALE_RULES, { locale: "fr-FR", mode })
    );
    console.log(
      `| one segment | ${text.length} | ${mode} | ${single.toFixed(0)} ms |`,
    );
    const segmented = measure(() =>
      runTextNodePipeline(nodes, IMPRIMERIE_NATIONALE_RULES, {
        locale: "fr-FR",
        mode,
      })
    );
    console.log(
      `| ${nodes.length} nodes | ${text.length} | ${mode} | ${
        segmented.toFixed(0)
      } ms |`,
    );
  }
}
