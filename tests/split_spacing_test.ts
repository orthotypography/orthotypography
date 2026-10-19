import assert from "node:assert/strict";
import {
  EXECUTABLE_RULES,
  FRENCH_GUILLEMETS_SPACING_RULE,
  IMPRIMERIE_NATIONALE_RULES,
  runPipeline,
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

// Issue #66: the same holds for the inner spaces of French guillemets.
function nodesOf(values: readonly string[]): TextNodeInput[] {
  return values.map((value, index) => ({ id: `n${index}`, value }));
}

Deno.test("a correct guillemet space in another node is left alone", () => {
  for (
    const values of [
      ["«", nbsp, "oui", nbsp, "»"],
      [`«${nbsp}oui`, nbsp, "»"],
      ["«", nbsp, `oui${nbsp}»`],
      ["«", `${nbsp}oui`, nbsp, "»"],
      ["«", "", nbsp, "oui", nbsp, "", "»"],
      [`«${nbsp}oui${nbsp}»`],
      ["dit «", nbsp, "oui"],
    ]
  ) {
    for (const mode of ["fix", "review", "lint"] as const) {
      const result = runTextNodePipeline(
        nodesOf(values),
        [FRENCH_GUILLEMETS_SPACING_RULE],
        { locale: "fr-FR", mode },
      );
      assert.deepEqual(result.changes, [], `${mode} ${JSON.stringify(values)}`);
      assert.deepEqual(
        result.diagnostics,
        [],
        `${mode} ${JSON.stringify(values)}`,
      );
    }
  }
});

Deno.test("wrong guillemet spacing split across nodes is set in the guillemet's node", () => {
  const fix = (values: readonly string[]) =>
    runTextNodePipeline(nodesOf(values), [FRENCH_GUILLEMETS_SPACING_RULE], {
      locale: "fr-FR",
      mode: "fix",
    });
  for (
    const [values, expected] of [
      [["«", " ", "oui", " ", "»"], [`«${nbsp}`, "", "oui", "", `${nbsp}»`]],
      [["« ", "oui ", "»"], [`«${nbsp}`, "oui", `${nbsp}»`]],
      [[`«${nbsp}`, " ", `oui${nbsp}»`], [`«${nbsp}`, "", `oui${nbsp}»`]],
      [["« ", nbsp, "oui »"], [`«${nbsp}`, "", `oui${nbsp}»`]],
    ] as const
  ) {
    const result = fix(values);
    assert.deepEqual(
      result.nodes.map(({ value }) => value),
      expected,
      JSON.stringify(values),
    );
    // The fixed nodes, split again, propose nothing.
    const again = fix(result.nodes.map(({ value }) => value));
    assert.deepEqual(again.changes, [], JSON.stringify(values));
  }

  // Spacing in protected text cannot be corrected: the guillemet is left as
  // is rather than given a second space.
  const blocked = runTextNodePipeline(
    [
      { id: "a", value: "«" },
      { id: "b", value: " oui", protected: true },
      { id: "c", value: "»" },
    ],
    [FRENCH_GUILLEMETS_SPACING_RULE],
    { locale: "fr-FR", mode: "fix" },
  );
  assert.equal(blocked.value, `« oui${nbsp}»`);
});

Deno.test("corrected text split at any position proposes nothing", () => {
  const rules = [...EXECUTABLE_RULES.values()];
  const fix = { locale: "fr-FR", mode: "fix" } as const;
  for (
    const input of [
      "Il dit « oui » puis part.",
      "« Vraiment ? » dit-il.",
      "Oui ; non : peut-être ! Et alors ?",
      "Il paie 25 % de 12 € pour 5 km.",
      "Prix : 1 234 567 €.",
      "etc. Bon… Voilà.",
      "« Partez ! » cria-t-il, « vite ! »",
      "Le taux (25 %) monte, « « imbriqué » ».",
      "Mesure : 12,5 kg et 3 m.",
    ]
  ) {
    const text = runPipeline(input, rules, fix).value;
    const splits: string[][] = [[...text], text.split(/(\s)/u)];
    for (let index = 1; index < text.length; index++) {
      splits.push([text.slice(0, index), text.slice(index)]);
    }
    for (const values of splits) {
      const result = runTextNodePipeline(nodesOf(values), rules, fix);
      assert.deepEqual(result.changes, [], JSON.stringify(values));
    }
  }
});
