import assert from "node:assert/strict";
import {
  IMPRIMERIE_NATIONALE_RULES,
  runTextNodePipeline,
  type TextNodeInput,
} from "../src/mod.ts";

// Issue #63: a correct space before or after high punctuation stays in its
// node, whatever the node boundaries around it.
const nbsp = " ";
const nnbsp = " ";

function review(nodes: readonly TextNodeInput[]) {
  return runTextNodePipeline(nodes, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    mode: "review",
  });
}

const marks = [[";", nnbsp], ["?", nnbsp], ["!", nnbsp], [":", nbsp]] as const;

Deno.test("a correct space before the sign in another node is left alone", () => {
  for (const [mark, space] of marks) {
    for (
      const nodes of [
        [
          { id: "a", value: "mot" },
          { id: "b", value: space },
          { id: "c", value: `${mark} suite` },
        ],
        [{ id: "a", value: `mot${space}` }, {
          id: "c",
          value: `${mark} suite`,
        }],
        [
          { id: "a", value: "mot" },
          { id: "b", value: space, protected: true },
          { id: "c", value: `${mark} suite` },
        ],
      ]
    ) {
      const result = review(nodes);
      assert.deepEqual(result.changes, [], JSON.stringify(nodes));
      assert.deepEqual(result.diagnostics, [], JSON.stringify(nodes));
    }
  }
});

Deno.test("a correct space after the sign in another node is left alone", () => {
  for (const [mark, space] of marks) {
    for (
      const nodes of [
        [{ id: "a", value: `mot${space}${mark}` }, {
          id: "c",
          value: " suite",
        }],
        [
          { id: "a", value: `mot${space}${mark}` },
          { id: "b", value: " " },
          { id: "c", value: "suite" },
        ],
      ]
    ) {
      const result = review(nodes);
      assert.deepEqual(result.changes, [], JSON.stringify(nodes));
      assert.deepEqual(result.diagnostics, [], JSON.stringify(nodes));
    }
  }
});

Deno.test("a wrong space split across nodes is still corrected", () => {
  // An ordinary space in its own node before `;` is replaced by U+202F.
  const ordinary = review([
    { id: "a", value: "mot" },
    { id: "b", value: " " },
    { id: "c", value: "; suite" },
  ]);
  assert.equal(ordinary.value, `mot${nnbsp}; suite`);

  // A doubled space, one part in each node, becomes a single U+202F.
  const doubled = review([
    { id: "a", value: "mot " },
    { id: "c", value: `${nnbsp}; suite` },
  ]);
  assert.equal(doubled.value, `mot${nnbsp}; suite`);

  // A missing space after the sign is inserted, and two spaces split across
  // nodes become one.
  const after = review([
    { id: "a", value: `mot${nnbsp};` },
    { id: "b", value: " " },
    { id: "c", value: " suite" },
  ]);
  assert.equal(after.value, `mot${nnbsp}; suite`);

  // The fixed nodes, split again by a host, propose nothing.
  for (const fixed of [ordinary, doubled, after]) {
    const nodes = fixed.nodes.map(({ id, value }) => ({ id, value }));
    assert.deepEqual(review(nodes).changes, [], JSON.stringify(nodes));
  }
});
