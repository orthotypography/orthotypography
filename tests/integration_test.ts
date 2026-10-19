import assert from "node:assert/strict";
import {
  FRENCH_GUILLEMETS_SPACING_RULE,
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_RULES,
  runTextNodePipeline,
} from "../src/mod.ts";

function applyNodeChanges(
  source: string,
  changes: readonly {
    readonly start: number;
    readonly end: number;
    readonly expected: string;
    readonly replacement: string;
  }[],
): string {
  let result = source;
  for (
    const change of [...changes].sort((left, right) => right.start - left.start)
  ) {
    assert.equal(source.slice(change.start, change.end), change.expected);
    result = result.slice(0, change.start) + change.replacement +
      result.slice(change.end);
  }
  return result;
}

Deno.test("text-node fixes preserve tree boundaries", () => {
  const result = runTextNodePipeline(
    [
      { id: "opening", value: "«Version " },
      { id: "code", value: "1.2.3", protected: true },
      { id: "closing", value: "»" },
    ],
    [FRENCH_GUILLEMETS_SPACING_RULE],
    { locale: "fr-FR", mode: "fix" },
  );

  assert.deepEqual(result.nodes, [
    { id: "opening", value: "«\u00a0Version " },
    { id: "code", value: "1.2.3", protected: true },
    { id: "closing", value: "\u00a0»" },
  ]);
  assert.equal(result.value, "«\u00a0Version 1.2.3\u00a0»");
  assert.deepEqual(
    result.changes.map((change) => ({
      segmentId: change.segmentId,
      start: change.start,
      end: change.end,
      expected: change.expected,
      replacement: change.replacement,
    })),
    [
      {
        segmentId: "opening",
        start: 1,
        end: 1,
        expected: "",
        replacement: "\u00a0",
      },
      {
        segmentId: "closing",
        start: 0,
        end: 0,
        expected: "",
        replacement: "\u00a0",
      },
    ],
  );
});

Deno.test("text-node lint exposes source diagnostics without mutation", () => {
  const nodes = [
    { id: "opening", value: "«texte" },
    { id: "closing", value: "»" },
  ] as const;
  const result = runTextNodePipeline(
    nodes,
    [FRENCH_GUILLEMETS_SPACING_RULE],
    { locale: "fr-FR", mode: "lint" },
  );

  assert.deepEqual(result.nodes, nodes);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => ({
      segmentId: diagnostic.segmentId,
      relatedId: diagnostic.related?.[0]?.segmentId,
    })),
    [
      {
        segmentId: "opening",
        relatedId: "closing",
      },
      {
        segmentId: "closing",
        relatedId: "opening",
      },
    ],
  );
});

Deno.test("classifier fragments fold back into their source node", () => {
  const source = "«Version 1.2.3»";
  const result = runTextNodePipeline(
    [{ id: "paragraph", value: source }],
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-FR", mode: "fix" },
  );

  assert.deepEqual(result.nodes, [{
    id: "paragraph",
    value: "«\u00a0Version 1.2.3\u00a0»",
  }]);
  assert.equal(applyNodeChanges(source, result.changes), result.nodes[0].value);
});

Deno.test("changes reproduce fixes after protected classifier fragments", () => {
  const source = "Version 1.2.3 : 25%. Bonjour , monde.";
  const result = runTextNodePipeline(
    [{ id: "paragraph", value: source }],
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-FR", mode: "fix" },
  );

  assert.equal(
    applyNodeChanges(source, result.changes),
    result.nodes[0].value,
  );
  assert.ok(result.changes.every(({ segmentId }) => segmentId === "paragraph"));
});

Deno.test("high punctuation crosses inline formatting boundaries", () => {
  const cases = [
    {
      nodes: [
        { id: "emphasis", value: "Bonjour" },
        { id: "plain", value: " :suite" },
      ],
      expected: ["Bonjour", "\u00a0: suite"],
    },
    {
      nodes: [
        { id: "plain", value: "Bonjour:" },
        { id: "emphasis", value: "suite" },
      ],
      expected: ["Bonjour\u00a0: ", "suite"],
    },
    {
      nodes: [
        { id: "emphasis", value: "Bonjour " },
        { id: "plain", value: ":suite" },
      ],
      expected: ["Bonjour", "\u00a0: suite"],
    },
    {
      nodes: [
        { id: "plain", value: "Bonjour :" },
        { id: "emphasis", value: " suite" },
      ],
      expected: ["Bonjour\u00a0: ", "suite"],
    },
  ] as const;

  for (const { nodes, expected } of cases) {
    const result = runTextNodePipeline(
      nodes,
      IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
      { locale: "fr-FR", mode: "fix" },
    );
    assert.deepEqual(result.nodes.map(({ value }) => value), expected);
    for (const node of nodes) {
      assert.equal(
        applyNodeChanges(
          node.value,
          result.changes.filter(({ segmentId }) => segmentId === node.id),
        ),
        result.nodes.find(({ id }) => id === node.id)?.value,
      );
    }
  }
});

Deno.test("cross-segment punctuation preserves technical sequences", () => {
  for (
    const nodes of [
      [
        { id: "left", value: "Déclaration !" },
        { id: "right", value: "important" },
      ],
      [{ id: "left", value: "https" }, {
        id: "right",
        value: "://example.test",
      }],
      [{ id: "left", value: "Quoi!" }, { id: "right", value: "?" }],
    ]
  ) {
    const result = runTextNodePipeline(
      nodes,
      IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
      { locale: "fr-FR", mode: "fix" },
    );
    assert.deepEqual(result.nodes, nodes);
    assert.deepEqual(result.changes, []);
  }
});

Deno.test("cross-segment lint relates whitespace in neighboring nodes", () => {
  const result = runTextNodePipeline(
    [
      { id: "emphasis", value: "Bonjour " },
      { id: "plain", value: ":suite" },
    ],
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR", mode: "lint" },
  );
  const diagnostic = result.diagnostics.find(({ ruleId }) =>
    ruleId === "punctuation.colon.nbsp-before"
  );

  assert.equal(diagnostic?.segmentId, "plain");
  assert.equal(diagnostic?.related?.[0]?.segmentId, "emphasis");
  assert.deepEqual(result.changes, []);
});

Deno.test("low punctuation removes whitespace from neighboring nodes", () => {
  const cases = [
    {
      nodes: [
        { id: "emphasis", value: "Bonjour " },
        { id: "plain", value: ", monde" },
      ],
      expected: ["Bonjour", ", monde"],
    },
    {
      nodes: [
        { id: "plain", value: "Fin " },
        { id: "emphasis", value: " ." },
      ],
      expected: ["Fin", "."],
    },
    {
      nodes: [
        { id: "word", value: "Bonjour " },
        { id: "empty-style", value: "\u00a0" },
        { id: "plain", value: ", suite" },
      ],
      expected: ["Bonjour", "", ", suite"],
    },
  ] as const;

  for (const { nodes, expected } of cases) {
    const result = runTextNodePipeline(
      nodes,
      IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
      { locale: "fr-FR", mode: "fix" },
    );
    assert.deepEqual(result.nodes.map(({ value }) => value), expected);
    for (const node of nodes) {
      assert.equal(
        applyNodeChanges(
          node.value,
          result.changes.filter(({ segmentId }) => segmentId === node.id),
        ),
        result.nodes.find(({ id }) => id === node.id)?.value,
      );
    }
  }
});

Deno.test("low-punctuation lint relates preceding-node whitespace", () => {
  const result = runTextNodePipeline(
    [
      { id: "emphasis", value: "Bonjour " },
      { id: "plain", value: ", monde" },
    ],
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR", mode: "lint" },
  );
  const diagnostic = result.diagnostics.find(({ ruleId }) =>
    ruleId === "punctuation.comma.no-space-before"
  );

  assert.equal(diagnostic?.segmentId, "plain");
  assert.equal(diagnostic?.related?.[0]?.segmentId, "emphasis");
  assert.deepEqual(result.changes, []);
});

Deno.test("low punctuation does not edit protected neighboring whitespace", () => {
  const nodes = [
    { id: "protected", value: "Code ", protected: true },
    { id: "plain", value: ", suite" },
  ] as const;
  const result = runTextNodePipeline(
    nodes,
    IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
    { locale: "fr-FR", mode: "fix" },
  );

  assert.deepEqual(result.nodes, nodes);
  assert.deepEqual(result.changes, []);
});
