# Reference corpus

Each `.txt` file holds an expected text, typeset by hand according to the
Imprimerie nationale *Lexique* (2002), with paragraphs separated by blank
lines. Inline code between backticks is passed to the core as protected
segments, as Markdown integrations protect code spans.

The raw texts are not stored: `scripts/reference_corpus.ts` derives them from
the expected text by fixed typing conventions (`spaced` and `compact`), written
independently of the rules. `deno task corpus:reference` reports the proposals
on the expected text and how far the corrected raw texts remain from it.

- `sources.json` records the source, author, URL, retrieval date, license, and
  review status of each file.
- `known-gaps.json` documents each proposal that the preset still makes on the
  expected text, with its reason. The test suite fails on an undocumented
  proposal and on a gap that no longer occurs.

The texts are test data, not examples of recommended usage outside the cases
they illustrate. See `docs/corpus-reference-v0.1.md` for the conventions.
