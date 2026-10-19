# Contributing to Orthotypography

Thank you for helping improve Orthotypography.

## Before contributing

For substantial changes, open an issue first so that the proposed behavior,
documentary sources, affected language or style presets, and compatibility
requirements can be discussed before implementation.

Every orthotypographic rule should be traceable to an identified authority.
Contributions should include relevant positive examples, negative examples,
exceptions, and tests whenever applicable.

## Development

The project uses Deno 2 as its canonical development environment. Deno is not
required to consume the published packages: source code must remain portable to
the supported JavaScript runtimes and browsers unless a runtime-specific entry
point explicitly states otherwise.

The tasks are defined in [`deno.json`](deno.json):

```sh
deno task check          # formatting, lint, type checks, API documentation, and coverage matrix
deno task matrix         # regenerate the coverage matrix table
deno task test           # test suite
deno task publish:check  # JSR dry run
deno task npm:check      # npm build, smoke test, and pack dry run
deno task bench          # pipeline timing on repeated corpus text
```

Run `check` and `test` for every source change. Run `publish:check` and
`npm:check` as well when a change affects the public API, dependencies, or
packaging. The formatter configuration does not include Markdown, so format
changed Markdown files explicitly, for example with `deno fmt CONTRIBUTING.md`.

`deno task test` includes generic pipeline invariants
(`tests/invariants_test.ts`) and corpus snapshots (`tests/corpus_test.ts`). A
behavior change that alters the corpus output requires `deno task corpus:update`
and a review of the resulting diff in `tests/fixtures/corpus/snapshots.json`. An
invariant violation found in existing code is reported in an issue and listed in
`KNOWN_VIOLATIONS` (`tests/support/invariants.ts`) until it is fixed. For
changes that may affect performance, compare `deno task bench` with the baseline
in [`docs/performances-v0.1.md`](docs/performances-v0.1.md) on the same machine.

Tests declare the rules and catalogue exceptions they cover with
`covers(ruleId, [exceptionIds])` (`tests/support/coverage.ts`), called with
literal arguments. `tests/coverage_test.ts` fails when an executable rule, or
one of its exceptions that the core can test, has no covering test. The table of
the coverage matrix is generated from these declarations, the catalogue, the
preset, and `docs/data/matrice-in-2002.json`: run `deno task matrix` after a
change to any of them, since `deno task check` fails on a stale table.

`deno task currency:update` refreshes the ISO 4217 currency data from its
official source; submit the regenerated data in a dedicated change.

## Pull requests

Work on a dedicated branch based on the current `main` and keep each pull
request focused on one task. Describe the checks you ran and any known
limitation. Add user-facing changes to the `Unreleased` section of
[`CHANGELOG.md`](CHANGELOG.md).

A behavioral rule change should:

- cite the authority and locator that justify it in the catalogue;
- distinguish the documentary catalogue entry from the executable rule, and
  state its default mode and preset membership;
- cover positive cases, negative cases, protected content, and text split across
  segments, and check idempotence where applicable, declaring them with
  `covers`;
- give each exception a stable ID and an English description in the catalogue,
  and a French label in `docs/data/matrice-in-2002.json`;
- update the relevant documents in `docs/`, and regenerate the coverage matrix.

The engine stays independent of Markdown or HTML parsers and editor APIs; those
adapters belong in
[orthotypography-integrations](https://github.com/orthotypography/orthotypography-integrations).

French is accepted only in `docs/`. Code, comments, API documentation, tests,
commit messages, pull requests, and the other repository files are written in
English, except for linguistic data under test and source titles.

## License of contributions

By submitting a contribution to this repository, you agree that your
contribution is licensed under the MIT License that applies to this project.

You represent that you have the right to submit the contribution under those
terms. If you contribute on behalf of an employer or another organization, you
are responsible for ensuring that you have the necessary authorization.

See [LICENSE](LICENSE) for the complete license text.
