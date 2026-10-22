import assert from "node:assert/strict";
import {
  editDistance,
  loadCorpus,
  measure,
  paragraphs,
  rawText,
  segments,
  undocumented,
} from "../scripts/reference_corpus.ts";

// Issue #83: reference corpus measured against the Imprimerie nationale preset
// (docs/corpus-reference-v0.1.md).

Deno.test("the expected reference texts receive no undocumented proposal", async () => {
  const { sources, gaps, texts } = await loadCorpus();
  assert.ok(sources.length > 0);
  for (const source of sources) {
    const result = measure(source.file, texts.get(source.file) ?? "");
    assert.ok(result.paragraphs > 0, source.file);
    assert.deepEqual(
      undocumented(result, gaps).map(({ ruleId, excerpt }) => ({
        ruleId,
        excerpt,
      })),
      [],
      source.file,
    );
  }
  // A documented gap that no longer occurs must be removed.
  for (const gap of gaps) {
    const result = measure(gap.file, texts.get(gap.file) ?? "");
    assert.ok(
      undocumented(result, [])
        .length > undocumented(result, [gap]).length,
      `stale known gap: ${gap.file} ${gap.ruleId}`,
    );
  }
});

Deno.test("every reference file records its source and license", async () => {
  const { sources } = await loadCorpus();
  const files = new Set(sources.map(({ file }) => file));
  assert.equal(files.size, sources.length);
  for (const source of sources) {
    assert.ok(source.license.trim().length > 0, source.file);
    assert.ok(source.title.trim().length > 0, source.file);
  }
  const directory = new URL("./fixtures/reference/", import.meta.url);
  for await (const entry of Deno.readDir(directory)) {
    if (entry.name.endsWith(".txt")) {
      assert.ok(files.has(entry.name), `${entry.name} has no source entry`);
    }
  }
});

Deno.test("raw texts follow ordinary typing conventions", () => {
  const expected =
    "Note\u00a0: l\u2019oui\u202f; «\u00a0bien\u00a0» et 12\u202f345\u00a0km… `a\u00a0: b…`";
  assert.equal(
    rawText(expected, "spaced"),
    "Note : l'oui ; « bien » et 12 345 km... `a\u00a0: b…`",
  );
  assert.equal(
    rawText(expected, "compact"),
    "Note: l'oui; «bien» et 12 345 km... `a\u00a0: b…`",
  );
  assert.deepEqual(
    segments("voir `x: y` ici").map(({ value, protected: p }) => [value, !!p]),
    [["voir ", false], ["`x: y`", true], [" ici", false]],
  );
  assert.deepEqual(paragraphs("a\nb\n\n  \nc\n"), ["a\nb", "c"]);
});

Deno.test("edit distances count inserted and deleted characters", () => {
  assert.equal(editDistance("", ""), 0);
  assert.equal(editDistance("abc", "abc"), 0);
  assert.equal(editDistance("a b", "a\u00a0b"), 2);
  assert.equal(editDistance("a...", "a…"), 4);
  assert.equal(editDistance("a:", "a\u00a0:"), 1);
});
