# Conception — annotations partagées et dépendances déclarées v0.1

Statut : décisions validées le 19 octobre 2026 ;
[issue nº 22](https://github.com/orthotypography/orthotypography/issues/22),
dernier point ouvert de la [revue d’architecture](revue-architecture-v0.1.md)
avant `0.2.0`, sur la base de la
[conception de l’exécution sur la suite logique](conception-suite-logique-v0.1.md).

## 1. Objet

Achever l’issue nº 22 : chaque classification s’exécute une fois par passe et
par suite, et une règle déclare les types d’annotations qu’elle produit ou lit,
au lieu de nommer la règle dont elle attend les données. La classification
numérique est déjà partagée ; il reste la classification des points de
suspension et la déclaration des dépendances. Le contrat des résultats
([conception des résultats](conception-resultats-v0.1.md)) ne change pas.

## 2. État actuel

- `classify.numeric-constructs` produit des annotations `numeric`
  ([PR nº 48](https://github.com/orthotypography/orthotypography/pull/48)),
  que lisent les quatre règles numériques
  ([PR nº 49](https://github.com/orthotypography/orthotypography/pull/49)).
  Ses contextes `protect` deviennent des plages protégées pour toutes les règles
  suivantes.
- `ELLIPSIS_GLYPH_RULE` (phase `glyphs`) et
  `ELLIPSIS_INITIAL_SPACE_AFTER_RULE` (phase `punctuation-spacing`) appellent
  chacune `classifyEllipsisCandidates` sur le texte qu’elles voient. La
  classification s’exécute donc deux fois, sur deux états du texte.
- `dependsOn` nomme des règles. Dix fiches du catalogue dépendent de
  `classify.numeric-constructs` pour deux raisons différentes : les quatre
  règles numériques lisent ses annotations, tandis que le deux-points, les
  quatre espaces après la ponctuation haute et le glyphe des points de
  suspension n’ont besoin que de ses protections.
- `ELLIPSIS_INITIAL_SPACE_AFTER_RULE` ne dépend de rien : elle peut s’exécuter
  sans classification numérique, donc sans ses protections, contrairement à la
  règle du glyphe.

## 3. Décisions

1. **Deux champs déclarent les annotations : `provides` et `requires`.** Une
   règle de la phase `classify` déclare les types qu’elle produit ; une règle
   déclare les types qu’elle lit. `dependsOn` reste une contrainte d’ordre entre
   identifiants, pour les règles qui n’ont besoin que des protections d’une
   autre. L’ajout est facultatif et sans rupture pour les règles qui n’utilisent
   pas d’annotations.
2. **Un producteur manquant est une erreur.** Comme un `dependsOn` non résolu
   aujourd’hui, une composition contenant une règle qui lit un type sans la
   règle qui le produit est refusée par une erreur codée qui nomme le type et la
   règle livrée qui le produit. Le classificateur des points de suspension
   rejoint le preset `fr-FR/imprimerie-nationale-2002`, comme la classification
   numérique, pour que le preset complété par les règles facultatives des points
   de suspension reste valide.
3. **Toute la famille des points de suspension exige la classification
   numérique.** Le classificateur des points de suspension lit les protections
   numériques et en dépend ; la règle d’espace initiale ne s’exécute plus sans
   elles.

## 4. Déclaration des annotations

```ts
interface RuntimeRule {
  // …
  /** Types d’annotations produits ; réservé à la phase `classify`. */
  readonly provides?: readonly string[];
  /** Types d’annotations lus par la règle. */
  readonly requires?: readonly string[];
}
```

`RuleDefinition` reçoit les mêmes champs : la fiche du catalogue reste la seule
source des métadonnées d’exécution des règles livrées.

`compilePipeline` :

- refuse `provides` hors de la phase `classify` (`INVALID_RULE`) ;
- refuse deux règles qui produisent le même type
  (`DUPLICATE_ANNOTATION_PROVIDER`), afin qu’une annotation ait une seule
  origine ; la contrainte pourra être levée si un besoin apparaît ;
- refuse un type lu sans producteur dans la composition
  (`MISSING_ANNOTATION_PROVIDER`, avec `details.kind`, `details.ruleId` et, pour
  un type livré, la règle qui le produit) ;
- ordonne chaque producteur avant les règles qui lisent son type, avec les mêmes
  contrôles de phase et de cycle que `dependsOn`.

À l’exécution :

- une règle `classify` qui renvoie une annotation d’un type non déclaré enfreint
  le contrat (`INVALID_ANNOTATION`) ;
- `LogicalRun.annotations(kind)` lève une erreur pour un type absent de
  `requires` (`UNDECLARED_ANNOTATION`), afin que les dépendances déclarées
  restent exactes.

Ces codes rejoignent `ERROR_CODES`, catégorie `rule-contract`, sauf
`MISSING_ANNOTATION_PROVIDER` et `DUPLICATE_ANNOTATION_PROVIDER`, catégorie
`input` comme `MISSING_DEPENDENCY`.

Dépendances des règles livrées après la migration :

| Règle | Avant | Après |
| --- | --- | --- |
| `classify.numeric-constructs` | — | `provides: ["numeric"]` |
| `classify.ellipsis-candidates` (nouvelle) | — | `provides: ["ellipsis"]`, `dependsOn: ["classify.numeric-constructs"]` |
| quatre règles numériques | `dependsOn` numérique | `requires: ["numeric"]` |
| deux-points et quatre espaces après ponctuation haute | `dependsOn` numérique | inchangé (protections seulement) |
| `punctuation.ellipsis.glyph` | `dependsOn` numérique | `requires: ["ellipsis"]` |
| `punctuation.ellipsis.initial.space-after` | — | `requires: ["ellipsis"]` |

La classification numérique y reste requise par la règle du glyphe, à travers
le classificateur des points de suspension.

## 5. Classification des points de suspension

- Nouvelle fiche `classify.ellipsis-candidates`, phase `classify`, mode
  `manual-review`, effet `classification-only`, statut `TO_VERIFY` comme la
  classification numérique ; règle exportée `ELLIPSIS_CLASSIFICATION_RULE`,
  insérée dans `EXECUTABLE_RULES` après la classification numérique.
- Elle exécute `classifyEllipsisCandidates` une fois par portion non protégée
  de la suite, avec les mêmes arguments qu’aujourd’hui, et produit une
  annotation `ellipsis` par candidat, certain ou non : `data.function`
  (`final`, `initial`, `word`, `unknown`) et `data.certain` (`"true"` ou
  `"false"`). Les candidats exclus (syntaxe technique, `etc.`, omission entre
  crochets, suites de points) ne reçoivent pas d’annotation.
- La forme (`...` ou `…`) n’est pas conservée : les règles lisent le texte
  courant de l’annotation. Quand la règle du glyphe remplace `...` par `…`,
  l’annotation contient entièrement la modification et se réduit à `…`
  ([conception de la suite logique](conception-suite-logique-v0.1.md), § 5) ;
  la règle d’espace initiale la retrouve donc. Une annotation partiellement
  recouverte par une modification est retirée.
- La règle d’espace initiale lit le caractère suivant dans la portion non
  protégée qui contient l’annotation, sans dépasser sa fin, comme aujourd’hui.

### Conséquence sur les sorties

La règle d’espace initiale décidait sur le texte déjà corrigé par les phases
`glyphs`, `quotes` et par les règles d’espacement antérieures. Elle décide
désormais, comme la règle du glyphe, sur le texte classifié avant toute
correction. Un prototype comparé à `main` sur 2 247 064 exécutions par graine,
deux graines, ne montre que des diagnostics d’espace initiale en moins (96 et
64), plus un ajout par graine. L’ajout examiné vient d’un défaut du prototype,
qui lisait un point de code au-delà d’une protection ; l’implémentation le
corrige.

Les diagnostics en moins portent sur un `…` initial attaché à un mot dont le
jeton, dans le texte d’origine, ressemble à une syntaxe technique :
`…a:ETC.km.....` ou un jeton contenant `/`. Aujourd’hui, la règle ne le
classait qu’après que l’espacement de la ponctuation haute eut coupé ce jeton
(`…a : ETC.km`) et insérait alors l’espace. Ce comportement dépendait de l’ordre
des corrections ; la décision unique est plus prudente et cohérente avec la
règle du glyphe.

## 6. Conséquences pour les compositions et les intégrations

- `IMPRIMERIE_NATIONALE_RULES` gagne `classify.ellipsis-candidates` ; ses
  sorties ne changent pas, car aucune règle du preset ne lit ces annotations.
- `[...IMPRIMERIE_NATIONALE_RULES, ELLIPSIS_GLYPH_RULE,
  ELLIPSIS_INITIAL_SPACE_AFTER_RULE]` reste valide. Une composition qui
  contient une règle des points de suspension sans le preset doit ajouter
  `NUMERIC_PROTECTION_RULE` et `ELLIPSIS_CLASSIFICATION_RULE`, faute de quoi
  elle est refusée par une erreur explicite.
- Une règle tierce (`x-`) qui lit des annotations doit déclarer `requires`, et
  une règle tierce de la phase `classify` qui en produit doit déclarer
  `provides`. Ce sont les seules ruptures de l’interface publique, avec le refus
  de la règle d’espace initiale sans classification ; elles rejoignent la ligne
  `0.2` avant `0.2.0`, dans une nouvelle préversion.
- Les intégrations transmettent au cœur les règles choisies par l’application
  et ne composent pas elles-mêmes les règles des points de suspension ; leur code
  n’a pas à changer. Les compositions de leurs utilisateurs suivent les règles
  ci-dessus.

## 7. Vérifications

- Tests de compilation : `provides` hors `classify`, producteur dupliqué,
  producteur manquant (code et détails), ordre producteur avant lecteur, cycle.
- Tests d’exécution : annotation d’un type non déclaré, lecture d’un type non
  requis, suivi de l’annotation à travers la correction du glyphe, caractère
  suivant borné par une protection.
- Tests de composition : preset complété par les règles des points de
  suspension, règle d’espace initiale seule refusée.
- Comparaison complète avec `main` : seules les différences du § 5 sont
  admises. Instantanés du corpus inchangés, `deno task bench --scaling`.

## 8. Hors champ

- `ETC_ELLIPSIS_RULE` garde son expression régulière : elle cherche des points
  de suspension que la classification exclut, après `etc.`.
- La reconnaissance d’une suite de points dans
  `punctuation.period.no-space-before`.
- La génération de la matrice de couverture
  ([issue nº 28](https://github.com/orthotypography/orthotypography/issues/28)).
