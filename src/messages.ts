import { OrthotypographyError } from "./errors.ts";

/**
 * English templates of the diagnostic messages of the built-in rules, by
 * message ID. Parameters are written `{name}`. Hosts translate diagnostics
 * from `messageId` and `messageArgs`; the English text is the default
 * rendering found in `message`.
 */
export const DIAGNOSTIC_MESSAGES: Readonly<Record<string, string>> = Object
  .freeze({
    "spacing.no-space-before": "Unexpected whitespace before {mark}",
    "spacing.space-before": "Unexpected whitespace before {mark}",
    "spacing.space-after": "Unexpected whitespace after {mark}",
    "spacing.space-after.ellipsis":
      "Spacing between {mark} and suspension points is not prescribed",
    "spacing.comma.space-after": "Missing whitespace after comma",
    "quotes.french.inner-space":
      "Expected a no-break space inside paired French guillemets",
    "number.percent.space":
      "Expected a no-break space before the percentage symbol",
    "number.unit.space": "Expected a no-break space before the unit symbol",
    "number.euro.position":
      "Expected the euro symbol after the amount with a no-break space",
    "number.euro.position.attached":
      "Expected the euro symbol after the amount with a no-break space; not corrected because the symbol is attached to the preceding text",
    "number.digits.grouping":
      "Expected digit grouping in this classified quantity",
    "ellipsis.after-etc": "Suspension points must not follow etc.",
    "ellipsis.glyph": "Use U+2026 for a recognized {function} ellipsis",
    "ellipsis.initial.space-after":
      "Insert a word space after a structurally initial ellipsis",
  });

/** Renders a message template with its parameters. */
export function formatDiagnosticMessage(
  id: string,
  args: Readonly<Record<string, string>> = {},
): string {
  const template = DIAGNOSTIC_MESSAGES[id];
  if (template === undefined) return id;
  return template.replace(
    /\{(\w+)\}/gu,
    (placeholder, name: string) =>
      Object.hasOwn(args, name) ? args[name] : placeholder,
  );
}

/** Message fields of a built-in diagnostic, rendered from its template. */
export function diagnosticMessage(
  id: keyof typeof DIAGNOSTIC_MESSAGES & string,
  args: Readonly<Record<string, string>> = {},
): {
  readonly message: string;
  readonly messageId: string;
  readonly messageArgs: Readonly<Record<string, string>>;
} {
  if (!Object.hasOwn(DIAGNOSTIC_MESSAGES, id)) {
    throw new OrthotypographyError(
      "INTERNAL_INVARIANT",
      `Unknown diagnostic message: ${id}`,
      { messageId: id },
    );
  }
  return {
    message: formatDiagnosticMessage(id, args),
    messageId: id,
    messageArgs: args,
  };
}
