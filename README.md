# orthotypography

Source-backed orthotypographic primitives and named editorial presets for the
JavaScript ecosystem, including browsers and server runtimes.

The `0.1.0-alpha.3` release is a public preview. Its API and rule catalogue may
change during the alpha series. The canonical TypeScript package is distributed
through JSR; an equivalent ESM package is generated from the same sources for
npm.

## Installation

```sh
deno add jsr:@orthotypography/core@0.1.0-alpha.3
npm install @orthotypography/core
```

## Current status

The repository contains a documentary catalogue, a machine-readable rule model,
two candidate French presets, the generic pipeline infrastructure, a
numeric-context classifier, and executable punctuation rules. The
source-specific high-punctuation composition protects technical and numeric
contexts before transforming text. The Imprimerie nationale composition also
inserts a missing word space after a comma when prose follows and removes
suspension points after `etc.`. Opt-in rules outside the presets diagnose or, in
explicit `fix` mode, correct certain ellipses, and diagnose ungrouped digits in
classified quantities. Every rule runs once per pass on one logical run across
text nodes, so that constructs split by inline formatting are handled, while
text-node integrations preserve the formatting boundaries. `compilePreset`
builds the executable rules of a catalogue preset with its per-rule modes, and
`IMPRIMERIE_NATIONALE_RULES` is the compiled Imprimerie nationale preset.
Locales are matched in canonical form without fallback: a pass whose locale no
rule supports throws, and `ruleLocaleSupport` tells beforehand which rules
would run.

```ts
import {
  applyTextChanges,
  IMPRIMERIE_NATIONALE_RULES,
  runPipeline,
} from "@orthotypography/core";
import { PRESETS, RULES } from "@orthotypography/core/catalogue";

const result = runPipeline(
  "Bonjour , monde : 25%.",
  IMPRIMERIE_NATIONALE_RULES,
  { locale: "fr-FR" },
);

console.log(result.value);
// "Bonjour, monde\u00a0: 25\u00a0%."

// Changes are in source coordinates and keep their rule provenance. To accept
// only part of a pass, apply whole proposal groups: every change belongs to
// exactly one group.
console.log(result.changes);
const accepted = new Set(result.groups[0].changeIds);
console.log(applyTextChanges(
  "Bonjour , monde : 25%.",
  result.changes.filter(({ id }) => accepted.has(id)),
));
// "Bonjour, monde : 25%."

// Review mode applies every rule and hints at each rule's default mode. A
// proposal the user declines goes back in `dismissed` on the next pass.
const review = runPipeline("Prix : 25€.", IMPRIMERIE_NATIONALE_RULES, {
  locale: "fr-FR",
  mode: "review",
});
const euro = review.diagnostics.find(({ suggested }) => suggested === "review");
console.log(euro?.ruleId); // "number.euro.nbsp-before"
const declined = runPipeline("Prix : 25€.", IMPRIMERIE_NATIONALE_RULES, {
  locale: "fr-FR",
  mode: "review",
  dismissed: euro === undefined ? [] : [euro],
});
console.log(declined.value);
// "Prix\u00a0: 25€."
```

## Writing a rule

A rule is called once per pass with a read-only view of the whole logical run:
the concatenated text of every input segment, its protected ranges, node
boundaries, and annotations from classify rules. It returns diagnostics in run
coordinates, each carrying the edits that correct it; the pipeline validates
those edits in every mode, applies them in `fix` mode, and projects them onto
the input segments. Rules of other packages use IDs prefixed with `x-`. A
diagnostic may give a `messageId` and `messageArgs` for hosts that render their
own text; otherwise the rule's ID serves as message ID. Errors thrown by the
core are `OrthotypographyError`s with a stable `code` and `category`.

```ts
import { runPipeline, type RuntimeRule } from "@orthotypography/core";

const noDoubleSpace: RuntimeRule = {
  id: "x-example.no-double-space",
  phase: "cleanup",
  locales: ["fr-FR"],
  defaultMode: "lint",
  apply(run) {
    const diagnostics = [...run.text.matchAll(/ {2,}/g)]
      .map((match) => ({
        start: match.index,
        end: match.index + match[0].length,
        replacement: " ",
      }))
      .filter(({ start, end }) =>
        !run.protectedRanges.some((range) =>
          range.start < end && start < range.end
        )
      )
      .map((edit) => ({ ...edit, message: "Double space", edits: [edit] }));
    return { diagnostics };
  },
};

runPipeline("Bonjour  monde", [noDoubleSpace], { locale: "fr-FR", mode: "fix" })
  .value; // "Bonjour monde"
```

See [`docs/architecture-v0.4.md`](./docs/architecture-v0.4.md) for the technical
boundaries and
[`docs/depouillement-lexique-v0.3.md`](./docs/depouillement-lexique-v0.3.md) for
the first French source review. The
[`Imprimerie nationale coverage matrix`](./docs/matrice-couverture-in-2002-v0.1.md)
tracks each documented prescription through catalogue, runtime, tests, and
preset activation.

## Development

```sh
deno task check
deno task test
deno task publish:check
deno task npm:check
deno task bench
deno task corpus:update
deno task currency:update
```

## License

[MIT](./LICENSE) License. Contributions are accepted under the same license; see
[`CONTRIBUTING.md`](./CONTRIBUTING.md).

Copyright (c) 2026 Antoine Boquet.
