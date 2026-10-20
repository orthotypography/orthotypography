import assert from "node:assert/strict";
import {
  DIAGNOSTIC_MESSAGES,
  ERROR_CODES,
  formatDiagnosticMessage,
  IMPRIMERIE_NATIONALE_RULES,
  OrthotypographyError,
  runPipeline,
  runTextNodePipeline,
} from "../src/mod.ts";
import { testRule } from "./support/rules.ts";
import { assertCode } from "./support/errors.ts";
import { covers } from "./support/coverage.ts";

Deno.test("core errors carry a code, a category, and details", () => {
  try {
    runPipeline("texte", IMPRIMERIE_NATIONALE_RULES, { locale: "en-US" });
    assert.fail("expected an error");
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.ok(error instanceof OrthotypographyError);
    assert.equal(error.name, "OrthotypographyError");
    assert.equal(error.code, "UNSUPPORTED_LOCALE");
    assert.equal(error.category, "input");
    assert.deepEqual(error.details, { locale: "en-US" });
    assert.equal(error.message, "No rule supports locale en-US");
  }
  const categories = new Set(Object.values(ERROR_CODES));
  assert.deepEqual(
    [...categories].sort(),
    ["input", "internal", "rule-contract", "stale-change"],
  );
});

Deno.test("rule contract errors name the faulty rule", () => {
  const broken = testRule("x-test.broken", () => ({
    edits: [{ start: 0, end: 99, replacement: "" }],
  }));
  try {
    runPipeline("texte", [broken], { locale: "fr-FR", mode: "fix" });
    assert.fail("expected an error");
  } catch (error) {
    assert.ok(error instanceof OrthotypographyError);
    assert.equal(error.code, "INVALID_EDIT_RANGE");
    assert.equal(error.category, "rule-contract");
    assert.equal(error.details.ruleId, "x-test.broken");
  }
});

Deno.test("built-in diagnostics carry message IDs and arguments", () => {
  const input = "Prix : 25€ ; « oui »,non ?, merci…";
  const result = runPipeline(input, IMPRIMERIE_NATIONALE_RULES, {
    locale: "fr-FR",
    mode: "review",
  });
  assert.ok(result.diagnostics.length > 3);
  for (const diagnostic of result.diagnostics) {
    assert.ok(
      Object.hasOwn(DIAGNOSTIC_MESSAGES, diagnostic.messageId),
      diagnostic.messageId,
    );
    assert.equal(
      diagnostic.message,
      formatDiagnosticMessage(diagnostic.messageId, diagnostic.messageArgs),
    );
  }
  const semicolon = result.diagnostics.find(({ ruleId }) =>
    ruleId === "punctuation.semicolon.nnbsp-before"
  );
  assert.equal(semicolon?.messageId, "spacing.wrong-before");
  assert.deepEqual(semicolon?.messageArgs, { mark: ";", space: "U+202F" });
});

Deno.test("high-punctuation messages tell missing, wrong, and extra spaces apart", () => {
  // Issue #79: one message per kind of spacing fault, before and after.
  covers("punctuation.colon.nbsp-before");
  covers("punctuation.question.nnbsp-before");
  covers("punctuation.colon.space-after");
  const messages = (text: string) =>
    runPipeline(text, IMPRIMERIE_NATIONALE_RULES, {
      locale: "fr-FR",
      mode: "lint",
    }).diagnostics
      .filter(({ messageId }) => messageId.startsWith("spacing."))
      .map(({ messageId, messageArgs }) => [messageId, messageArgs]);

  assert.deepEqual(messages("Note: suite"), [
    ["spacing.missing-before", { mark: ":", space: "U+00A0" }],
  ]);
  assert.deepEqual(messages("Note : suite"), [
    ["spacing.wrong-before", { mark: ":", space: "U+00A0" }],
  ]);
  assert.deepEqual(messages("Vrai \u00a0? oui"), [
    ["spacing.excess-before", { mark: "?", space: "U+202F" }],
  ]);
  assert.deepEqual(messages("Note\u00a0:suite"), [
    ["spacing.missing-after", { mark: ":", space: "U+0020" }],
  ]);
  assert.deepEqual(messages("Note\u00a0:\tsuite"), [
    ["spacing.wrong-after", { mark: ":", space: "U+0020" }],
  ]);
  assert.deepEqual(messages("Note\u00a0:  suite"), [
    ["spacing.excess-after", { mark: ":", space: "U+0020" }],
  ]);
  assert.deepEqual(messages("Note\u00a0: "), [
    ["spacing.trailing-after", { mark: ":" }],
  ]);
  // A space split across text nodes counts as one spacing (issue #63).
  const split = runTextNodePipeline(
    [{ id: "a", value: "Note  " }, { id: "b", value: ": suite" }],
    IMPRIMERIE_NATIONALE_RULES,
    { locale: "fr-FR", mode: "lint" },
  );
  assert.deepEqual(
    split.diagnostics.map(({ messageId }) => messageId),
    ["spacing.excess-before"],
  );
});

Deno.test("external rules may give message IDs or fall back to their ID", () => {
  const plain = testRule("x-test.plain", () => ({
    diagnostics: [{ start: 0, end: 1, message: "Plain" }],
  }));
  const coded = testRule("x-test.coded", () => ({
    diagnostics: [{
      start: 0,
      end: 1,
      message: "Coded a",
      messageId: "x-test.coded.message",
      messageArgs: { value: "a" },
    }],
  }));
  const result = runPipeline("ab", [plain, coded], { locale: "fr-FR" });
  assert.deepEqual(
    result.diagnostics.map(({ messageId, messageArgs }) => [
      messageId,
      messageArgs,
    ]),
    [["x-test.plain", {}], ["x-test.coded.message", { value: "a" }]],
  );

  const invalid = testRule("x-test.invalid", () => ({
    diagnostics: [{
      start: 0,
      end: 1,
      message: "Invalid",
      messageArgs: { value: 1 as unknown as string },
    }],
  }));
  assertCode(
    () => runPipeline("ab", [invalid], { locale: "fr-FR" }),
    "INVALID_DIAGNOSTIC",
  );
});

Deno.test("message templates render their parameters", () => {
  assert.equal(
    formatDiagnosticMessage("spacing.missing-after", {
      mark: "?",
      space: "U+0020",
    }),
    "Missing U+0020 after ?",
  );
  assert.equal(
    formatDiagnosticMessage("ellipsis.glyph", { function: "final" }),
    "Use U+2026 for a recognized final ellipsis",
  );
  // Unknown IDs render as themselves; missing parameters stay visible.
  assert.equal(formatDiagnosticMessage("x-test.message"), "x-test.message");
  assert.equal(
    formatDiagnosticMessage("spacing.trailing-after"),
    "Unexpected whitespace after {mark} at the end of the text",
  );
});
