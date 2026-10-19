import assert from "node:assert/strict";
import {
  FRENCH_GUILLEMETS_SPACING_RULE,
  IMPRIMERIE_NATIONALE_RULES,
  runPipeline,
} from "../src/mod.ts";
import { assertCode } from "./support/errors.ts";

Deno.test("paired French guillemets receive inner no-break spaces", () => {
  for (const input of ["«texte»", "« texte »", "«\u202ftexte\u202f»"]) {
    const result = runPipeline(input, [FRENCH_GUILLEMETS_SPACING_RULE], {
      locale: "fr-FR",
    });
    assert.equal(result.value, "«\u00a0texte\u00a0»", input);
  }
});

Deno.test("nested French guillemets are paired", () => {
  const result = runPipeline(
    "«Il dit «oui».»",
    [FRENCH_GUILLEMETS_SPACING_RULE],
    { locale: "fr-FR" },
  );

  assert.equal(result.value, "«\u00a0Il dit «\u00a0oui\u00a0».\u00a0»");
});

Deno.test("guillemet pairing crosses numeric protection segments", () => {
  const result = runPipeline(
    "«Version 1.2.3»",
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-FR" },
  );

  assert.equal(result.value, "«\u00a0Version 1.2.3\u00a0»");
  assert.ok(result.segments.some(({ protected: value }) => value));
});

Deno.test("unpaired, empty, straight, and protected quotes are preserved", () => {
  for (const input of ["«texte", "texte»", "«»", "« »", 'Il mesure 5".']) {
    const result = runPipeline(input, [FRENCH_GUILLEMETS_SPACING_RULE], {
      locale: "fr-FR",
    });
    assert.equal(result.value, input);
  }

  const protectedResult = runPipeline(
    [{ value: "«code»", protected: true }],
    [FRENCH_GUILLEMETS_SPACING_RULE],
    { locale: "fr-FR" },
  );
  assert.equal(protectedResult.value, "«code»");
});

Deno.test("French guillemet spacing supports lint mode", () => {
  const input = "«texte»";
  const result = runPipeline(input, [FRENCH_GUILLEMETS_SPACING_RULE], {
    locale: "fr-FR",
    mode: "lint",
  });

  assert.equal(result.value, input);
  assert.equal(result.diagnostics.length, 2);
});

Deno.test("lint diagnostics keep source coordinates across text segments", () => {
  const result = runPipeline(
    [
      { id: "opening", value: "«Version " },
      { id: "version", value: "1.2.3", protected: true },
      { id: "closing", value: "»" },
    ],
    [FRENCH_GUILLEMETS_SPACING_RULE],
    { locale: "fr-FR", mode: "lint" },
  );

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
    [
      {
        segmentId: "opening",
        segmentValue: "«Version ",
        start: 1,
        end: 1,
        related: [{ segmentId: "closing", start: 0, end: 1 }],
      },
      {
        segmentId: "closing",
        segmentValue: "»",
        start: 0,
        end: 0,
        related: [{ segmentId: "opening", start: 0, end: 1 }],
      },
    ],
  );
});

Deno.test("lint coordinates survive classifier-created fragments", () => {
  const source = "«Version 1.2.3»";
  const result = runPipeline(
    [{ id: "paragraph", value: source }],
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-FR", mode: "lint" },
  );

  const quoteDiagnostics = result.diagnostics.filter((diagnostic) =>
    diagnostic.ruleId === "quotes.french.nbsp-inner"
  );
  assert.deepEqual(
    quoteDiagnostics.map(({ segmentId, segmentValue, start, end }) => ({
      segmentId,
      segmentValue,
      start,
      end,
    })),
    [
      { segmentId: "paragraph", segmentValue: source, start: 1, end: 1 },
      { segmentId: "paragraph", segmentValue: source, start: 14, end: 14 },
    ],
  );
});

Deno.test("French guillemet spacing is locale-aware and idempotent", () => {
  assertCode(() =>
    runPipeline("«text»", [FRENCH_GUILLEMETS_SPACING_RULE], {
      locale: "en-US",
    }), "UNSUPPORTED_LOCALE");

  const first = runPipeline(
    "«texte»",
    [FRENCH_GUILLEMETS_SPACING_RULE],
    { locale: "fr-FR" },
  );
  const second = runPipeline(
    first.value,
    [FRENCH_GUILLEMETS_SPACING_RULE],
    { locale: "fr-FR" },
  );
  assert.equal(second.value, first.value);
  assert.deepEqual(second.diagnostics, []);
});

Deno.test("guillemet spacing stays in the guillemet's node", () => {
  const fix = (values: readonly string[]) =>
    runPipeline(
      values.map((value, index) => ({ id: `n${index}`, value })),
      [FRENCH_GUILLEMETS_SPACING_RULE],
      { locale: "fr-FR" },
    ).segments.map(({ value }) => value);

  assert.deepEqual(fix(["«", "Oui»"]), ["«\u00a0", "Oui\u00a0»"]);
  assert.deepEqual(fix(["«Oui", "»"]), ["«\u00a0Oui", "\u00a0»"]);
  assert.deepEqual(fix(["«", "", "Oui", "", "»"]), [
    "«\u00a0",
    "",
    "Oui",
    "",
    "\u00a0»",
  ]);
  // Wrong spacing that continues into a neighboring node is set in the
  // guillemet's node and removed from the neighbor (issue #66).
  assert.deepEqual(fix(["« ", " Oui »"]), ["«\u00a0", "Oui\u00a0»"]);
  assert.deepEqual(fix(["«", "Non"]), ["«", "Non"]);
});

Deno.test("guillemet diagnostics are reported in text order", () => {
  const result = runPipeline(
    "«a «b» c»",
    [FRENCH_GUILLEMETS_SPACING_RULE],
    { locale: "fr-FR", mode: "lint" },
  );
  assert.deepEqual(
    result.diagnostics.map(({ start, end, related }) => [
      start,
      end,
      related?.[0].start,
    ]),
    [[1, 1, 8], [4, 4, 5], [5, 5, 3], [8, 8, 0]],
  );
});
