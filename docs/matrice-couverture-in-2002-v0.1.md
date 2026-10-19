# Matrice de couverture — Imprimerie nationale 2002

**Version :** 0.1  
**Date de vérification :** 19 octobre 2026
**Base examinée :** `ae78ecd`, `main` après la
[PR nº 67](https://github.com/orthotypography/orthotypography/pull/67),
publiée sous `0.2.0-alpha.0`
**Source primaire :** *Lexique des règles typographiques en usage à
l’Imprimerie nationale*, édition 2002  
**Relevé de référence :**
[`depouillement-lexique-v0.3.md`](depouillement-lexique-v0.3.md)

**Conception des ellipses :**
[`points-de-suspension-v0.1.md`](points-de-suspension-v0.1.md)

**Spécification du groupement des chiffres :**
[`groupement-chiffres-v0.1.md`](groupement-chiffres-v0.1.md)

**Dernière PR fusionnée :**
[nº 67](https://github.com/orthotypography/orthotypography/pull/67)

## 1. Objet et vocabulaire

Cette matrice distingue huit niveaux qui ne doivent pas être confondus :

- **attesté** : la prescription figure dans le dépouillement de la source ;
- **catalogué** : un `RuleDefinition` machine la représente, seul ou avec
  d’autres prescriptions proches ;
- **reconnu** : un mécanisme interne classe la séquence sans constituer à lui
  seul un signal destiné à l’utilisateur ;
- **diagnostiqué** : un `RuntimeRule` émet un diagnostic sans nécessairement
  proposer ou appliquer une correction ;
- **corrigé** : un `RuntimeRule` produit une modification en mode `fix` ;
- **exécutable** : un `RuntimeRule` produit un diagnostic ou une correction ;
- **testé** : un test automatisé couvre le comportement indiqué ;
- **activé** : le preset documentaire `fr-FR/imprimerie-nationale-2002`
  sélectionne le comportement ; depuis les issues
  [nº 23](https://github.com/orthotypography/orthotypography/issues/23) et
  [nº 24](https://github.com/orthotypography/orthotypography/issues/24), la
  composition exécutable `IMPRIMERIE_NATIONALE_RULES` est compilée à partir de
  ce preset (`compilePreset`), avec ses modes.

Une ligne « partielle » signale qu’une implémentation couvre seulement une
partie de la prescription ou que plusieurs prescriptions sont agrégées sous un
identifiant machine. Les protections de segments sont assurées par le pipeline
pour toutes les règles ; la colonne « exclusions » mentionne les décisions
supplémentaires propres au comportement.

## 2. Matrice

| Prescription atomique du dépouillement | Catalogue machine | Exécution sur `main` | Tests directs | Preset IN 2002 | Exclusions ou travail restant |
|---|---|---|---|---|---|
| `space.before.comma` | `punctuation.comma.no-space-before` | `SAFE_PUNCTUATION_RULES` : `fix` | `punctuation_test.ts`, `integration_test.ts` | oui | décimales et syntaxe technique protégées par classification |
| `space.before.period` | `punctuation.period.no-space-before` | `SAFE_PUNCTUATION_RULES` : `fix` | `punctuation_test.ts`, `integration_test.ts` | oui | versions, adresses IP, URI et autres constructions classifiées ; suites de points laissées aux règles des points de suspension ([nº 31](https://github.com/orthotypography/orthotypography/issues/31)) |
| `space.after.comma` | `punctuation.comma.space-after` | `SPACE_AFTER_COMMA_RULE` : `fix` contextuel | `comma_spacing_test.ts` | oui | fin de texte et ponctuation adjacente exclues ; décimales, URI, chemins et segments protégés préservés |
| `space.after.period` | `punctuation.period.space-after` | non ; `manual-review` documentaire | `catalogue_test.ts` pour le catalogue seulement | oui, `manual-review` | distinguer point final, abréviation et texte qui suit avant toute exécution |
| `space.before.semicolon` | `punctuation.semicolon.nnbsp-before` | `HIGH_PUNCTUATION_RULES` : `fix` | `punctuation_test.ts`, `integration_test.ts` | oui | suites expressives et syntaxe protégée |
| `space.before.exclamation` | `punctuation.exclamation.nnbsp-before` | `HIGH_PUNCTUATION_RULES` : `fix` | `punctuation_test.ts`, `integration_test.ts` | oui | suites expressives et `!important` |
| `space.before.question` | `punctuation.question.nnbsp-before` | `HIGH_PUNCTUATION_RULES` : `fix` | `punctuation_test.ts`, `integration_test.ts` | oui | suites expressives et syntaxe protégée |
| `space.after.semicolon` | `punctuation.semicolon.space-after` | `HIGH_PUNCTUATION_RULES` : `fix` atomique | `high_punctuation_atomicity_test.ts`, `punctuation_test.ts`, `integration_test.ts`, `closing_signs_test.ts`, `split_spacing_test.ts` | oui | suites expressives et syntaxe protégée ; aucune espace imposée devant `»`, `)`, `]` ou `”` (nº 54), ni devant `,` ou `.` (nº 59) ; devant des points de suspension, espacement signalé sans correction ; blanc correct d’un nœud voisin laissé en place (nº 63) |
| `space.after.exclamation` | `punctuation.exclamation.space-after` | `HIGH_PUNCTUATION_RULES` : `fix` atomique | `high_punctuation_atomicity_test.ts`, `punctuation_test.ts`, `integration_test.ts`, `closing_signs_test.ts`, `split_spacing_test.ts` | oui | suites expressives, `!important` et syntaxe protégée ; aucune espace imposée devant `»`, `)`, `]` ou `”` (nº 54), ni devant `,` ou `.` (nº 59) ; devant des points de suspension, espacement signalé sans correction ; blanc correct d’un nœud voisin laissé en place (nº 63) |
| `space.after.question` | `punctuation.question.space-after` | `HIGH_PUNCTUATION_RULES` : `fix` atomique | `high_punctuation_atomicity_test.ts`, `punctuation_test.ts`, `integration_test.ts`, `closing_signs_test.ts`, `split_spacing_test.ts` | oui | suites expressives et syntaxe protégée ; aucune espace imposée devant `»`, `)`, `]` ou `”` (nº 54), ni devant `,` ou `.` (nº 59) ; devant des points de suspension, espacement signalé sans correction ; blanc correct d’un nœud voisin laissé en place (nº 63) |
| `space.before.colon` | `punctuation.colon.nbsp-before` | `HIGH_PUNCTUATION_RULES` : `fix` | `punctuation_test.ts`, `integration_test.ts` | oui | heures, ratios, URI, ports, `::` |
| `space.after.colon` | `punctuation.colon.space-after` | `HIGH_PUNCTUATION_RULES` : `fix` atomique | `high_punctuation_atomicity_test.ts`, `punctuation_test.ts`, `integration_test.ts`, `closing_signs_test.ts`, `split_spacing_test.ts` | oui | heures, ratios, URI, ports et `::` protégés ; aucune espace imposée devant `»`, `)`, `]` ou `”` (nº 54), ni devant `,` ou `.` (nº 59) ; devant des points de suspension, espacement signalé sans correction ; blanc correct d’un nœud voisin laissé en place (nº 63) |
| `quotes.primary.glyphs` | issue de source seulement | non | négatifs dans `quotes_test.ts` | non | reconnaître sans ambiguïté le rôle ouvrant ou fermant des guillemets droits |
| `quotes.primary.innerSpacing` | `quotes.french.nbsp-inner` | `FRENCH_GUILLEMETS_SPACING_RULE` : `fix` | `quotes_test.ts`, `integration_test.ts`, `split_spacing_test.ts` | oui | guillemets appariés seulement ; support contraint hors cœur ; blanc correct d’un nœud voisin laissé en place, blanc incorrect normalisé dans le nœud du guillemet, blanc dans un texte protégé laissé tel quel (nº 66) |
| `ellipsis.count` | `punctuation.ellipsis.glyph` | `ELLIPSIS_GLYPH_RULE` : reconnaissance de `U+2026` ou exactement trois `U+002E` ; diagnostic des seuls trois points ASCII classés `final` ou `initial` certains ; correction atomique en mode explicite `fix`, mode par défaut `lint` ; `ELLIPSIS_RECOGNITION_RULE` reste un alias du même objet | `ellipsis_recognition_test.ts`, `ellipsis_glyph_test.ts`, `catalogue_test.ts` | non | `etc.`, suites de longueur différente, syntaxes techniques, coupures entre crochets et limites protégées exclues ; publié dans `0.1.0-alpha.3` |
| `ellipsis.spacing.final` | `punctuation.ellipsis.final.no-space-before` | fonction `final` reconnue en interne lorsque l’ellipse est attachée à une lettre ; règle d’espacement cataloguée, non exécutable | `ellipsis_recognition_test.ts` pour la reconnaissance | non | les cas certains sont déjà collés au mot précédent ; `Alors ...` reste indéterminé |
| `ellipsis.spacing.initial` | `punctuation.ellipsis.initial.space-after` | fonction `initial` certaine au début structurel : diagnostic si une lettre suit immédiatement `…`, insertion de `U+0020` en mode `fix` explicite ; mode par défaut `lint` | `ellipsis_recognition_test.ts`, `ellipsis_initial_spacing_test.ts` pour modes, exclusions, protections, segments et UTF-16 | non | `...Suite` reste exclu comme syntaxe potentiellement technique ; simple délimiteur ouvrant insuffisant ; publié dans `0.1.0-alpha.3` |
| `ellipsis.spacing.word` | `punctuation.ellipsis.word.space-around` | fonction `word` reconnue en interne mais marquée indéterminée ; aucun diagnostic, aucune correction | `ellipsis_recognition_test.ts` pour la reconnaissance et l’indétermination | non | indice sémantique absent ; maintien en `manual-review` documentaire |
| interdiction des points de suspension après `etc.` | `punctuation.ellipsis.after-etc.forbidden` | `ETC_ELLIPSIS_RULE` : `fix` | `ellipsis_test.ts` | oui | token `etc.` autonome ; syntaxes techniques et segments protégés préservés |
| `dash.parenthetical.glyph` | issue de source seulement | non | non | non | le tiret source `-` est trop ambigu pour une conversion globale |
| `dash.spacing` | issue de source seulement | non | non | non | reconnaître préalablement le tiret d’incise ; cas fermant particulier |
| `dash.closing.beforePeriod` | issue de source seulement | non | non | non | reconnaître une incise appariée avant suppression |
| `number.groupDigits` | `number.digits.grouping` | `DIGIT_GROUPING_RULE` : lint seulement, limité aux mesures, pourcentages et monnaies classifiés | `digit_grouping_test.ts`, `numeric_classifier_test.ts` | non | `U+202F` sortie canonique candidate, `U+00A0` accepté ; quantités autonomes, correction et normalisation des séparateurs reportées |
| `number.decimalSeparator` | issue de source et classificateur | reconnaissance sans conversion | `numeric_classifier_test.ts` | non comme transformation | ne jamais convertir aveuglément versions, identifiants ou conventions citées |
| `number.noGrouping.ordinal` | exclusion de `number.digits.grouping` et protection partielle par classification | le lint de groupement exclut les libellés de numérotage reconnus et n’examine pas les nombres autonomes | `digit_grouping_test.ts`, `numeric_classifier_test.ts` | non | années, dates, numérotations, versions, adresses, identifiants, codes et références restent exclus ; protéger structurellement les contextes connus |
| `space.before.percent` | `number.percent.nbsp-before` | `PERCENTAGE_SPACING_RULE` : `fix` | `numeric_spacing_test.ts` | oui | valeur numérique classifiée ; identifiants et URI protégés |
| `percent.glyph` | résultat agrégé dans `number.percent.nbsp-before` | reconnaissance de `%` et `‰`, sans conversion de glyphe | `numeric_spacing_test.ts` | oui, indirectement | aucun glyphe source alternatif défini |
| `space.numberUnit` | `number.unit.nbsp-before` | `UNIT_SPACING_RULE` : `lint` par défaut, `fix` explicite | `unit_spacing_test.ts` | oui | registre d’unités reconnu ; angles, noms communs et symboles ambigus exclus |
| `unit.symbol.period` | issue de source seulement | non | registre seulement | non | distinguer point fautif et ponctuation finale de phrase |
| `unit.symbol.plural` | issue de source seulement | non | registre seulement | non | éviter qu’un `s` forme un autre symbole valide, par exemple `ms` |
| `unit.symbol.case` | registre d’unités | validation exacte, sans réécriture | `unit_registry_test.ts` | non comme transformation | la casse est signifiante ; correction automatique potentiellement ambiguë |
| `currency.euro.position` | résultat agrégé dans `number.euro.nbsp-before` | `EURO_SPACING_RULE` : `lint` par défaut, `fix` explicite | `euro_spacing_test.ts` | oui | euro seulement ; conventions citées et monnaies ambiguës exclues ; symbole antéposé collé au texte qui précède signalé sans correction (nº 36) |
| `space.numberEuro` | `number.euro.nbsp-before` | `EURO_SPACING_RULE` : `lint` par défaut, `fix` explicite | `euro_spacing_test.ts` | oui | montant classifié et symbole `€` non ambigu |
| classification des constructions numériques et techniques | `classify.numeric-constructs` | `NUMERIC_PROTECTION_RULE` : classification et protection | `numeric_classifier_test.ts`, tests des règles dépendantes | oui, `manual-review` dans le catalogue | autorité documentaire sans objet direct ; statut `TO_VERIFY` maintenu |

## 3. Extensions atomiques retenues

La première extension issue de cette matrice est
`punctuation.ellipsis.after-etc.forbidden`. Le *Lexique* formule deux fois
l’interdiction : aux entrées « Abréviations » et « Ponctuation ». Contrairement
à une normalisation générale du glyphe ou de l’espacement des ellipses, cette
règle ne demande pas d’inférer une suppression, une interruption ou un
sous-entendu.

La correction conserve le point abréviatif final de `etc.` et supprime
uniquement les points de suspension adjacents, qu’ils soient représentés par
`U+2026` ou par une suite usuelle de points. Elle s’applique à travers des
segments textuels contigus, mais ne traverse pas un segment protégé. Les tokens
plus longs, les chemins et les syntaxes techniques ne sont pas assimilés à
l’abréviation autonome.

La tranche suivante est `punctuation.comma.space-after`, identifiant autonome
de la prescription `space.after.comma`. Elle insère `U+0020` lorsque du texte
suit immédiatement la virgule, y compris quand ce texte commence dans un autre
segment non protégé. Elle ne signale pas la fin du texte ni une ponctuation
adjacente. Elle préserve les décimales réparties ou non entre segments, les URI,
les chemins reconnus et toute limite protégée. Une syntaxe technique non
protégée qui serait lexicalement identique à de la prose reste indécidable dans
le cœur : l’intégration doit alors fournir un segment protégé.

Le catalogue distingue les prescriptions suivant le point, le deux-points, le
point-virgule, le point d’interrogation et le point d’exclamation. La règle du
point reste en `manual-review`. Pour les quatre signes de ponctuation haute,
les entrées documentaires sont désormais en `fix` et le preset les sélectionne
sans surcharge de mode. Le runtime produit séparément l’espace précédente et
l’espace suivante sous leurs identifiants propres. Les deux règles partagent
les mêmes exclusions contextuelles : cette atomisation affine la provenance
des diagnostics et des `TextChange` sans modifier la sortie utilisateur.

La conception des points de suspension est stabilisée dans
[`points-de-suspension-v0.1.md`](points-de-suspension-v0.1.md). Sa première
tranche d’implémentation, fusionnée dans la
[PR nº 8](https://github.com/orthotypography/orthotypography/pull/8), a ajouté
quatre définitions au catalogue et une classification interne `final`,
`initial`, `word` ou `unknown`. Ce premier runtime diagnostiquait uniquement les
trois `U+002E` des fonctions finales ou initiales certaines. Il reconnaissait
aussi `U+2026`, sans signaler un glyphe déjà canonique, et ne produisait ni
remplacement, ni `TextChange`, ni correction d’espacement ; aucune de ces règles
ne rejoint `IMPRIMERIE_NATIONALE_RULES`. Les syntaxes
techniques, les suites de longueur différente de trois, `etc...`, les coupures
éditoriales entre crochets et les séquences interrompues par une protection
sont exclues ; la ponctuation adjacente est laissée intacte.

La [PR nº 10](https://github.com/orthotypography/orthotypography/pull/10)
a fusionné la tranche H, qui rend le même identifiant `punctuation.ellipsis.glyph` correcteur
sur demande explicite du mode `fix`. Le mode documentaire par défaut reste
`lint`. Les trois points peuvent traverser plusieurs segments : le premier
fragment reçoit `U+2026`, les fragments suivants sont supprimés par des
`TextChange` gardés, exprimés dans les coordonnées UTF-16 de leurs segments
sources. L’export public `ELLIPSIS_RECOGNITION_RULE` est un alias de
`ELLIPSIS_GLYPH_RULE`, non une seconde règle ; une composition contenant les
deux références identiques reste rejetée comme identifiant dupliqué. Son
comportement en mode explicite `fix` évolue ainsi de diagnostic seul à
correction. Aucun espacement adjacent n’est modifié et le preset ne sélectionne
toujours pas ce glyphe. Cette fonctionnalité est publiée dans `0.1.0-alpha.3`.

La [PR nº 11](https://github.com/orthotypography/orthotypography/pull/11)
a fusionné la tranche I, qui ajoute un runtime distinct pour l’espace après `…` lorsque le
classificateur établit la fonction `initial` à un début structurel et qu’une
lettre suit sans blanc. Le diagnostic par défaut ne modifie rien ; `fix`
explicite ajoute une espace avec des coordonnées source gardées. Les ellipses
déjà espacées, les trois points ASCII suivis d’une lettre, les autres
fonctions, les délimiteurs seuls et les protections restent intacts. Le preset
ne sélectionne pas cette règle. `final.no-space-before` demeure documentaire :
les ellipses finales reconnues avec certitude touchent déjà la lettre avant
elles, tandis que `Alors ...` n’est pas classé final. La tranche I est publiée
dans `0.1.0-alpha.3`.

## 4. Priorités révélées par la matrice

1. Après la correction de glyphe fusionnée dans la tranche H et la règle
   initiale fusionnée dans la tranche I, réexaminer séparément les espacements
   `final` et `word` seulement si leur fonction devient déterminable ; le
   premier ne présente actuellement aucun cas certain à corriger.
2. Étendre le lint de groupement aux quantités autonomes seulement après avoir
   stabilisé leurs indices sémantiques et les exclusions de numérotage ; définir
   ensuite une représentation sûre des corrections inter-segments avant tout
   mode `fix`.
3. Maintenir les règles d’unités et d’euro en `lint` par défaut tant que leurs
   ambiguïtés documentées ne sont pas levées.
