import assert from "node:assert/strict";
import { classifyEllipsisCandidates } from "../src/classify/ellipsis.ts";
import {
  compilePipeline,
  ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_RECOGNITION_RULE,
  IMPRIMERIE_NATIONALE_RULES,
  NUMERIC_PROTECTION_RULE,
  runPipeline,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";

const recognitionRules = [
  NUMERIC_PROTECTION_RULE,
  ELLIPSIS_RECOGNITION_RULE,
] as const;

Deno.test("ellipsis classification distinguishes supported functions", () => {
  const vectors = [
    ["Il hésite...", "...", "final", true],
    ["Il hésite…", "…", "final", true],
    ["... Suite", "...", "initial", true],
    ["…Suite", "…", "initial", true],
    ["mot ... mot", "...", "word", false],
    ["mot … mot", "…", "word", false],
    ["Alors ...", "...", "unknown", false],
    ["Quoi ?...", "...", "unknown", false],
  ] as const;

  for (const [input, value, ellipsisFunction, certain] of vectors) {
    const candidates = classifyEllipsisCandidates(input);
    assert.equal(candidates.length, 1, input);
    assert.equal(candidates[0].value, value, input);
    assert.equal(candidates[0].function, ellipsisFunction, input);
    assert.equal(candidates[0].certain, certain, input);
  }
});

Deno.test("ellipsis classification rejects excluded forms and technical syntax", () => {
  for (
    const input of [
      "etc...",
      "etc. ...",
      "etc.…",
      "..",
      "....",
      ".....",
      ".…",
      "….",
      "../dossier/.../fichier",
      "C:\\dossier\\...\\fichier",
      "https://example.test/.../page",
      "version...beta",
      "192.168.0.1/...",
      "const copie = {...objet}",
      "function f(...args)",
      "const reste = ...args",
      "[...]",
      "[ … ]",
    ]
  ) {
    assert.deepEqual(classifyEllipsisCandidates(input), [], input);
  }
});

Deno.test("recognition diagnoses only certain ASCII ellipses", () => {
  const input =
    "Il hésite... Puis ... encore. mot ... mot. Alors ... Quoi ?... Déjà…";
  const result = runPipeline(input, recognitionRules, {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(result.value, input);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(
    result.diagnostics.map(({ ruleId, message }) => ({ ruleId, message })),
    [{
      ruleId: "punctuation.ellipsis.glyph",
      message: "Use U+2026 for a recognized final ellipsis",
    }],
  );
});

Deno.test("recognition crosses unprotected segments with UTF-16 coordinates", () => {
  const input = [
    { id: "lead", value: "🚀 hésite." },
    { id: "middle", value: "." },
    { id: "tail", value: ". Suite." },
  ] as const;
  const result = runPipeline(input, recognitionRules, {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(result.value, "🚀 hésite... Suite.");
  assert.deepEqual(result.changes, []);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => ({
      segmentId: diagnostic.segmentId,
      segmentValue: diagnostic.segmentValue,
      start: diagnostic.start,
      end: diagnostic.end,
      related: diagnostic.related?.map((location) => ({
        segmentId: location.segmentId,
        start: location.start,
        end: location.end,
      })),
    })),
    [{
      segmentId: "lead",
      segmentValue: "🚀 hésite.",
      start: 9,
      end: 10,
      related: [
        {
          segmentId: "middle",
          start: 0,
          end: 1,
        },
        {
          segmentId: "tail",
          start: 0,
          end: 1,
        },
      ],
    }],
  );
});

Deno.test("recognition finds an initial ellipsis split across segments", () => {
  const input = [
    { id: "first", value: ".." },
    { id: "second", value: ". Suite." },
  ] as const;
  const result = runPipeline(input, recognitionRules, {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(result.value, "... Suite.");
  assert.deepEqual(result.changes, []);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(
    result.diagnostics[0].message,
    "Use U+2026 for a recognized initial ellipsis",
  );
  assert.equal(result.diagnostics[0].segmentId, "first");
  assert.deepEqual(
    result.diagnostics[0].related?.map(({ segmentId, start, end }) => ({
      segmentId,
      start,
      end,
    })),
    [{ segmentId: "second", start: 0, end: 1 }],
  );
});

Deno.test("recognition does not cross protected boundaries", () => {
  const inputs = [
    [
      { id: "left", value: "Il hésite." },
      { id: "protected", value: ".", protected: true },
      { id: "right", value: ". Suite." },
    ],
    [
      { id: "left", value: "Il hésite" },
      { id: "protected", value: "...", protected: true },
      { id: "right", value: " Suite." },
    ],
  ] as const;

  for (const input of inputs) {
    const result = runPipeline(input, recognitionRules, {
      locale: "fr-FR",
      mode: "lint",
    });
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.changes, []);
    assert.deepEqual(result.segments, input);
  }
});

Deno.test("recognition remains non-mutating in lint mode", () => {
  const input = "Il hésite... puis répond; ... Suite.";
  const result = runPipeline(input, recognitionRules, {
    locale: "fr-FR",
    mode: "lint",
  });
  assert.equal(result.value, input);
  assert.deepEqual(result.changes, []);
  assert.equal(result.diagnostics.length, 1);
  assert.ok(
    result.diagnostics.every(({ replacement }) => replacement === undefined),
  );
});

Deno.test("recognition export aliases the glyph rule without a second diagnostic", () => {
  assert.strictEqual(ELLIPSIS_RECOGNITION_RULE, ELLIPSIS_GLYPH_RULE);
  assertCode(
    () => compilePipeline([ELLIPSIS_RECOGNITION_RULE, ELLIPSIS_GLYPH_RULE]),
    "DUPLICATE_RULE",
  );
  const result = runPipeline("Il hésite...", recognitionRules, {
    locale: "fr-FR",
    mode: "fix",
  });
  assert.equal(result.value, "Il hésite…");
  assert.equal(result.diagnostics.length, 1);
});

Deno.test("recognition remains outside the executable preset", () => {
  const input = "Il hésite...";
  const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    mode: "fix",
  });

  assert.equal(result.value, input);
  assert.deepEqual(result.changes, []);
  assert.ok(
    result.diagnostics.every(({ ruleId }) =>
      ruleId !== "punctuation.ellipsis.glyph"
    ),
  );
});
