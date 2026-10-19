# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- Leave a correct space next to high punctuation in its node (#63). The
  space rules before and after `:`, `;`, `?`, and `!` moved a correct space
  from a neighboring node into the sign's node, a change with no effect on the
  text that hosts received again on every pass, since they split nodes on
  their own (found in a live Google Docs run). They now propose nothing when
  the spacing around the sign, across nodes, is already the expected one.
  Wrong spacing split across nodes is still corrected in the sign's node.
- Compile presets from the catalogue and match locales canonically (#23, #24;
  `docs/conception-presets-locales-v0.1.md`). `compilePreset(presetId,
  { modes })` returns the executable rules of a catalogue preset, each with the
  preset's mode (or an override) as its default mode, in the order of the new
  `EXECUTABLE_RULES` registry; documentary rules of the preset are left out.
  `IMPRIMERIE_NATIONALE_RULES` is now the compiled Imprimerie nationale preset,
  with unchanged outputs, and `fr-CA/oqlf` compiles to an executable
  composition with its `lint` modes. `manual-review` is documented as behaving
  like `lint` at run time. **Breaking:** locales are canonicalized
  (`canonicalLocale`, so `fr-fr` now works), matched without fallback, and a
  pass whose locale no rule supports throws instead of returning the input
  unchanged; `PipelineResult.skippedRuleIds` lists the rules left out, and
  `ruleLocaleSupport` reports them without running the pass. The catalogue
  validation rejects non-canonical locales.
- Do not move a leading euro sign attached to the preceding text (#36).
  `EURO_SPACING_RULE` moved the sign behind the amount and left the preceding
  word glued to the digits (`Prix€ 12` became `Prix12 €`). When the sign follows
  neither the start of the text, a space, nor an opening sign, the rule now
  reports the construct without a correction, since inserting a space is not
  prescribed.
- Do not require a space after `?`, `!`, `:`, or `;` before a comma or a
  period (#59), which the Imprimerie nationale sets « toujours collés au mot
  précédent »: the four `space-after` rules inserted a space that the comma and
  period rules removed. Before suspension points, a combination the source
  does not describe, the rules now leave the spacing as is and report it with
  a diagnostic without edits. The catalogue entries list both exceptions.
- Fix the space after `?`, `!`, `:`, and `;` before a closing sign (#54). The
  four `space-after` rules required a word space whenever text followed, so
  they replaced the no-break space that `quotes.french.nbsp-inner` sets before
  `»` and inserted a space before `)`, `]`, and `”`. They now leave the space
  before these closing signs to the sign's own rule, as the Imprimerie
  nationale table of spaces prescribes; their catalogue entries list the
  `closing sign` exception.
- Add the `review` mode and dismissed proposals (#26, fourth step of
  `docs/conception-resultats-v0.1.md`). `review` applies the proposals of every
  rule, like `fix`, and adds `suggested` to each applied proposal (`apply` when
  its rule's default mode is `fix`, `review` otherwise) and to each group
  (whether all its proposals are suggested). The `dismissed` option of
  `runPipeline` and `runTextNodePipeline` lists proposals by rule and reported
  source location; matching proposals are validated but not applied, are
  reported with `dismissed: true` and no group, and the cascade runs without
  them. `PipelineMode` and `DismissedProposal` are exported. Outputs of the
  `fix`, `lint` and default modes are unchanged.
- Link diagnostics to the changes they produce (#26, third step of
  `docs/conception-resultats-v0.1.md`). `TextChange.id` identifies each change
  in a result. In `fix` mode, the diagnostic of an applied proposal carries
  `changeIds`, the changes that contain its edits, and `groupId`. The new
  `PipelineResult.groups` and `TextNodePipelineResult.groups` list the
  proposal groups: proposals whose edits or locations overlap or touch text
  produced by another, or whose edits the ledger merges, are accepted
  together, and every change belongs to exactly one group. `applyTextChanges`
  accepts changes without `id`. `ProposalGroup` is exported. Outputs are
  otherwise unchanged; `TextChange.id` is required, which is breaking only for
  code that builds `TextChange` objects typed as such.
- Keep the change ledger linear when a rule makes many edits inside text
  changed by an earlier rule. Each such edit was widened to the whole changed
  piece and copied it, so N edits in one piece of length N took quadratic time
  (10.8 s instead of 0.8 s at 250,000 characters). Edits whose widened ranges
  overlap are now combined into one edit first; outputs are unchanged.
  `deno task bench --scaling` measures this case with two external rules.
- **Breaking:** diagnostics are always located in the input segments (#26,
  second step of `docs/conception-resultats-v0.1.md`). `coordinateSpace` and
  `segmentRevision` are removed from `DiagnosticLocation`; `segmentIndex` always
  designates an input segment, even when protection splits it. In `fix` mode, a
  location inside text produced by an earlier fix is widened to the source range
  of that fix; locations in unchanged text are unchanged.
- **Breaking:** edits belong to the diagnostics they correct (#26, first step of
  `docs/conception-resultats-v0.1.md`). `RuleResult.edits` is removed;
  `RunDiagnostic.edits` carries the edits of a diagnostic. The pipeline
  validates proposed edits in every mode and applies them only in `fix` mode, so
  a rule no longer needs to check `run.mode` and no longer fails when it returns
  edits in `lint` or `manual-review` mode. Outputs of the built-in rules are
  unchanged.
- **Breaking:** replace the per-fragment rule interface (#21, #25).
  `RuntimeRule` now carries `id`, `phase`, `locales`, `defaultMode`, and
  optional `dependsOn`, and `apply(run: LogicalRun): RuleResult` is called once
  per pass on the whole logical run. Rules return `RunEdit`s, `RunDiagnostic`s,
  and, in the `classify` phase, `Annotation`s in run coordinates. The
  `definition` property, `RuleContext`, `RuleApplication`,
  `RuleApplicationEdit`, `RuleApplicationSegmentEdit`,
  `RuleApplicationDiagnostic`, `ApplicationDiagnosticLocation`, and
  `ProtectionRange` are removed. Built-in rules take their metadata from their
  catalogue entry; rules outside the catalogue must use an ID prefixed with
  `x-`, and `compilePipeline` rejects other unknown IDs and unknown phases.
  `LogicalRun`, `RuleResult`, `RunEdit`, `RunDiagnostic`, `RunLocation`,
  `RunRange`, `RunBias`, `Annotation`, `RuleMode`, and `RulePhase` are exported.
  Outputs of the built-in rules are unchanged.
- Run the numeric rules (`PERCENTAGE_SPACING_RULE`, `UNIT_SPACING_RULE`,
  `EURO_SPACING_RULE`, `DIGIT_GROUPING_RULE`) once on the logical run, reading
  the `numeric` annotations instead of reclassifying each fragment (#21).
  Calling their `apply` methods directly now throws. Constructs split across
  text nodes are now corrected: `environ 465` · `km` becomes `environ 465` ·
  `\u00a0km`, the space staying in the symbol's node; a split leading euro sign
  moves after the amount into the amount's node. Constructs inside one node are
  replaced whole, as before. Because annotations follow earlier edits instead of
  being recomputed, a few single-node results change where an earlier numeric
  fix used to create a new construct: `€1km` now becomes `€1 km` instead of
  `1 € km`. Digit grouping is now linear in the number of nodes.
- Classify numeric constructs once per unprotected region of the logical run
  instead of once per text node (#21). A time, ratio, version, or address split
  across text nodes is now protected: `Rendez-vous à 10` · `:30` is no longer
  turned into `10 : 30` by colon spacing. Numeric constructs are kept as
  `numeric` annotations that follow later edits. Single-node inputs are
  unchanged, and classification is linear in the number of constructs.
- Run the ellipsis rules (`ETC_ELLIPSIS_RULE`, `ELLIPSIS_GLYPH_RULE`,
  `ELLIPSIS_INITIAL_SPACE_AFTER_RULE`) once on the logical run instead of once
  per fragment (#21). Calling their `apply` methods directly now throws. The
  ellipsis classifier examines each candidate in constant time. Outputs are
  unchanged, except next to empty protected nodes, which no longer split the
  examined text or cancel a structural beginning. Many text nodes or many
  suspension points no longer grow quadratically: 62,500 one-character nodes
  took about 50 s with the preset and now take about 3 s.
- Run the comma, period, and high-punctuation rules once on the logical run
  instead of once per fragment (#21). Calling their `apply` methods directly now
  throws. Outputs are unchanged, except next to empty protected nodes, which no
  longer affect these rules: `Bonjour,` · empty protected node · `monde` now
  receives the space after the comma. The space after a comma followed by a long
  unbroken token is now checked in linear time; 125,000 characters of `a,` took
  about 21 s and now take about 0.1 s.
- Keep the pipeline linear in the number of edits, protected ranges, and
  fragments: edits are assembled in one pass instead of rebuilding the value for
  each edit, protected ranges are found by binary search, and results no longer
  pass large arrays as call arguments, which exceeded the call stack beyond
  about 125,000 changes or fragments. Outputs are unchanged. The benchmark gains
  a `--scaling` option that measures growth on adversarial inputs.
- Run `FRENCH_GUILLEMETS_SPACING_RULE` once on the logical run instead of once
  per fragment (#21). Calling its `apply` method directly now throws; run it
  through `runPipeline` or `runTextNodePipeline`. Outputs are unchanged.
- Compute the pairing of French guillemets once per logical run instead of once
  per fragment. With the linear ledger, 500,000 characters take about 0.4 s in
  fix mode as one segment and 0.5 s as 3,977 nodes, instead of 33 s and 26 s in
  `0.1.0-alpha.3`. Outputs are unchanged.
- Apply each rule's edits to the change ledger in one pass, and locate
  diagnostics and rebuild source changes without rescanning the ledger. Fix mode
  no longer grows quadratically with the number of edits: 500,000 characters in
  one segment take about 7 s instead of 33 s with `IMPRIMERIE_NATIONALE_RULES`.
  Outputs are unchanged (#20).
- Fix currency classification so that a symbol already following an amount is no
  longer reattached to the next amount: `25 € 30 €` stays unchanged instead of
  becoming `25 30 € €` with the euro rule in `fix` mode (#30).
- Group decimal parts by threes only when classifying numbers, so that `12,5 12`
  is no longer read as one number (#30).
- Protect times with seconds (`23:45:10`) and drive-letter paths
  (`C:\Temp\rapport.txt`, `D:/data`) from colon spacing. The numeric classifier
  reports the new `path` construct kind (#32).
- Stop removing the space before a run of periods in
  `punctuation.period.no-space-before`. Suspension points follow their own
  spacing rules, and a space before them is correct when they stand for a word
  (`Il m’a traité de ... devant tout le monde.`); `Alors ...` is now left
  unchanged, like `Alors …`, and the composition with the ellipsis glyph rule is
  stable in one pass (#31).

## [0.1.0-alpha.3] - 2026-09-26

- Insert missing spaces after commas in safe prose contexts, including across
  unprotected text segments, while preserving numeric and technical syntax
  (`SPACE_AFTER_COMMA_RULE`). The rule is part of `IMPRIMERIE_NATIONALE_RULES`
  and `IMPRIMERIE_NATIONALE_PUNCTUATION_RULES`, so both compositions can now
  produce additional changes.
- Remove suspension points after standalone `etc.` across unprotected text
  segments while preserving source UTF-16 coordinates (`ETC_ELLIPSIS_RULE`, part
  of `IMPRIMERIE_NATIONALE_RULES`).
- Execute and diagnose the spaces following colons, semicolons, question marks,
  and exclamation marks under their own rule IDs. `HIGH_PUNCTUATION_RULES` now
  contains eight atomic rules instead of four; fixed text is unchanged, but
  diagnostics, `appliedRuleIds`, and `TextChange.ruleIds` report the new
  `*.space-after` IDs.
- Recognize certain final and structurally initial ellipses written as `U+2026`
  or exactly three `U+002E`. `ELLIPSIS_GLYPH_RULE` diagnoses the ASCII form by
  default and converts it to `…` in explicit `fix` mode;
  `ELLIPSIS_RECOGNITION_RULE` is an alias of the same rule.
- Add `ELLIPSIS_INITIAL_SPACE_AFTER_RULE`, which diagnoses a missing space after
  a structurally initial `…` followed by a letter and inserts `U+0020` in
  explicit `fix` mode.
- Add `DIGIT_GROUPING_RULE` (`number.digits.grouping`), a diagnostic-only rule
  for ungrouped digits in classified measurements, percentages, and currency
  amounts. It never emits changes.
- The ellipsis and digit grouping rules default to `lint` and belong to no
  preset.
- Add atomic documentary catalogue entries for word spacing after periods,
  colons, semicolons, question marks, and exclamation marks, and for the
  ellipsis glyph and its spacing functions.
- Add a source-backed coverage matrix for the Imprimerie nationale preset and
  specifications for ellipses and digit grouping.
- Add explicit public API types required by current Deno 2 lint checks.

## [0.1.0-alpha.2] - 2026-09-09

- Add `applyTextChanges` for guarded application of source-coordinate changes to
  strings and segmented documents.

## [0.1.0-alpha.1] - 2026-09-05

- Add source-coordinate `TextChange` sets with optimistic `expected` guards.
- Compose rule provenance across successive edits without reconstructing a
  post-processing diff.
- Let runtime rules expose precise atomic edits while retaining a conservative
  whole-fragment fallback for existing rules.
- Apply one rule's edits as an atomic transaction across neighboring text
  segments.
- Normalize French high punctuation across inline formatting boundaries while
  preserving split technical and expressive sequences.
- Remove whitespace before commas and periods when it belongs to neighboring
  inline text segments.

## [0.1.0-alpha.0] - 2026-09-01

- Add the JavaScript package scaffold and coordinated JSR/npm distribution
  model.
- Add the machine-readable documentary catalogue and candidate French presets.
- Add the generic ordered pipeline with protected segment support.
- Add a pure classifier for protected and transformable numeric constructs.
- Add safe executable rules for whitespace before commas and periods.
- Convert classified ranges into stable protected segments in the pipeline.
- Add source-specific French spacing rules for colons, semicolons, question
  marks, and exclamation marks.
- Add classified no-break spacing before percentage and per-mille symbols.
- Add paired French-guillemet spacing across protected numeric segments.
- Add a versioned, case-sensitive BIPM registry for SI units and prefixes.
- Add registry-backed unit-spacing diagnostics with explicit opt-in fixes.
- Add an ambiguity-aware monetary registry and opt-in euro-symbol fixes.
- Add a validated, provenance-preserving importer for SIX ISO 4217 List One.
- Resolve conservative SI products, quotients, and Unicode powers.
- Parse parenthesized SI expressions into a public, read-only AST.
