# Conception — couche d’écriture des règles v0.1

Statut : proposition ; orientations validées le 20 octobre 2026 ;
[issue nº 82](https://github.com/orthotypography/orthotypography/issues/82),
préalable à l’extension du catalogue par lots retenue dans la
[feuille de route](roadmap.md) à la suite de l’audit du cœur du 20 octobre 2026
(constat R1).

## 1. Objet

Donner aux règles une couche d’écriture au-dessus des primitives de la
[suite logique](conception-suite-logique-v0.1.md), avant d’ajouter des règles en
volume. Une nouvelle règle d’espacement autour d’un signe doit pouvoir s’écrire
en déclarant le signe, le côté, l’espace attendue et ses exclusions nommées,
sans réécrire de parcours. Le contrat des règles (`RuntimeRule.apply(run)`), le
contrat des résultats et les sorties des règles livrées ne changent pas.

## 2. État actuel

Sur `main` (`5ff8a0b`), le cœur exécute 19 règles et 2 classifications. Les
règles forment trois familles :

| Famille | Règles | Mécanique commune |
| --- | --- | --- |
| Espacement autour d’un signe | 12 : absence de blanc avant la virgule et le point, espace après la virgule, espaces avant et après les quatre ponctuations hautes, espaces intérieures des guillemets | trouver le signe hors texte protégé ; mesurer le blanc d’un côté, y compris dans les nœuds voisins ; appliquer des exclusions ; comparer à l’espace attendue ; corriger dans le nœud du signe et retirer le blanc des nœuds voisins |
| Réécriture d’une construction annotée | 6 : pourcentage, unité, euro, groupement des chiffres, glyphe et espace initiale des points de suspension | lire les annotations d’un type ; calculer le texte attendu ; répartir la correction par nœud avec `stretchParts` |
| Motif sur les régions non protégées | 1 : points de suspension après `etc.` | expression régulière sur chaque région non protégée, avec contrôle de la limite de mot |

Constats :

- `src/rules/punctuation.ts` compte 639 lignes pour 11 règles. La classe
  `PunctuationScan` y porte la mécanique de la première famille, mais chaque
  règle refait son parcours, ses comparaisons et ses propositions ;
  `src/rules/quotes.ts` réimplémente la mesure du blanc entre nœuds pour les
  guillemets.
- Le `bias` suit partout la même convention, choisie à la main à chaque
  règle : le texte inséré reste dans le nœud du signe (`right` avant le signe,
  `left` après).
- Les exclusions sont codées sans lien avec les identifiants d’exceptions des
  fiches. Une comparaison du code et du catalogue fait apparaître des
  exclusions exécutées mais non déclarées :

| Règle | Exclusion codée | Exception absente de la fiche |
| --- | --- | --- |
| les quatre espaces avant la ponctuation haute | signe en début de texte, sans caractère précédent (`: suite`) | `start-of-text` |
| `punctuation.colon.nbsp-before` | `::` | `technical-syntax` |
| `punctuation.colon.nbsp-before`, `punctuation.semicolon.nnbsp-before` | signe doublé, signe de rang supérieur avant le signe (`?:`) | `adjacent-punctuation` |
| `punctuation.exclamation.nnbsp-before` | `!important` | `technical-syntax` |

  Les autres exceptions de ces fiches sont soit vérifiées par le code
  (`uri` pour `:/`, `expressive-sequence` pour `?!`, `period-run`…), soit
  assurées par la classification numérique, qui protège heures, ratios et
  ports avant la phase des espaces, soit structurelles (`protected-content`),
  soit hors du cœur (`scope: "integration"`).

## 3. Décisions

1. **Primitives communes et fabrique déclarative.** Une boîte à outils sert
   toutes les règles ; une fabrique `markSpacingRule` couvre la famille
   « espacement autour d’un signe ». Les deux autres familles utilisent les
   primitives et recevront une fabrique quand un lot de règles le justifiera.
2. **Exclusions indexées par `RuleException.id`.** Chaque exclusion de la
   fabrique porte l’identifiant d’une exception de la fiche. La construction de
   la règle échoue si l’identifiant est inconnu de la fiche, ou si une
   exception testable de la fiche n’a pas d’exclusion. Le lien fiche → code →
   test devient vérifiable.
3. **Couche interne.** Le module vit sous `src/rules/authoring/` et n’est pas
   exporté par le paquet pendant la ligne `0.2`. Son export pour les règles
   tierces (`x-`) sera décidé une fois la forme éprouvée par plusieurs lots.
4. **Validation par migration.** Les dix règles d’espacement de virgule, de
   point et de ponctuation haute sont réécrites avec la fabrique, à sorties
   identiques.
5. **`bias` dérivé du côté.** La fabrique fixe `bias: "right"` pour une
   correction avant le signe et `bias: "left"` après ; une règle ne le choisit
   plus.

## 4. Primitives

`src/rules/authoring/scan.ts` reprend `PunctuationScan`, renommée `RunScan`,
et `src/rules/run-text.ts`. Les primitives existantes gardent leur
sémantique :

| Primitive | Rôle |
| --- | --- |
| `occurrences(mark)` | positions d’un signe hors texte protégé, dans l’ordre du texte |
| `spacing(index, side)` | blanc d’un côté d’une position : plage dans la portion du signe, plages à retirer dans les portions voisines, caractère et position adjacents, ou blocage par du texte protégé |
| `precedingCharacter`, `followingCharacter` | caractère adjacent, en lisant la portion voisine, sans franchir le texte protégé |
| `technicalTokenBefore(index)` | jeton sans blanc d’allure technique (chemin, schéma d’URL, `www.`) avant une position |
| `propose(diagnostic, own, removals)`, `report(diagnostic)`, `result()` | propositions dans l’ordre des signes ; une portion garde ses propres modifications seulement si l’une d’elles change son texte, comme aujourd’hui |
| `spacingMessage(side, mark, actual, expected)` | message `missing`, `wrong`, `excess` ou `trailing` ([issue nº 79](https://github.com/orthotypography/orthotypography/issues/79)) |

`spacing(index, side)` réunit `spacingStart`, `spacingEnd`,
`precedingBoundary`, `followingBoundary` et `inspectHighPunctuation`, dont les
règles enchaînaient aujourd’hui les appels à la main.

Garanties de coût, vérifiées par `deno task bench --scaling` :

- les index (portions, débuts de jetons, motifs techniques) sont construits au
  plus une fois par appel de règle, à la demande ;
- une primitive appelée sur une occurrence ne lit que le blanc qui l’entoure et
  un nombre borné de caractères ; la remontée d’un jeton reste bornée à 256
  unités de code ;
- aucune primitive ne découpe le texte de la suite par occurrence.

## 5. Fabrique `markSpacingRule`

```ts
interface MarkSpacingSpec {
  /** Catalogue entry, the only source of phase, locales, and dependencies. */
  readonly id: string;
  readonly mark: string;
  readonly side: "before" | "after";
  /** Expected spacing, or a function of the occurrence context. */
  readonly expected: string | ((context: MarkContext) => string);
  /** Exclusions keyed by the `RuleException.id` of the catalogue entry. */
  readonly exclusions: Readonly<Record<string, Exclusion>>;
  /** Message of a proposal; defaults to `spacingMessage`. */
  readonly message?: (context: MarkContext, actual: string, expected: string) =>
    DiagnosticMessage;
}

/** What the rule sees around one occurrence of its mark. */
interface MarkContext {
  readonly scan: RunScan;
  readonly mark: string;
  readonly index: number;
  readonly before: Spacing;
  readonly after: Spacing;
}

type Exclusion =
  /** The occurrence is left as is, without diagnostic. */
  | { readonly skip: (context: MarkContext) => boolean }
  /** The occurrence is reported without edit, with its own message. */
  | {
    readonly report: (context: MarkContext) => boolean;
    readonly messageId: string;
  }
  /** Ensured before the rule: protected text, or a classification. */
  | { readonly ensuredBy: "protection" | `classification:${string}` };
```

Pour chaque occurrence du signe, la fabrique :

1. ignore le signe si le blanc du côté examiné touche du texte protégé ;
2. évalue les exclusions dans l’ordre de leur déclaration : la première qui
   s’applique laisse le signe sans proposition (`skip`) ou le signale sans
   modification (`report`) ;
3. calcule l’espace attendue, puis le blanc effectif, qui réunit le blanc de la
   portion du signe et celui des portions voisines ;
4. ne propose rien si le blanc effectif est déjà l’espace attendue, même s’il
   se trouve dans un nœud voisin
   ([issue nº 63](https://github.com/orthotypography/orthotypography/issues/63)) ;
5. sinon propose le remplacement dans la portion du signe, avec le `bias` du
   côté, et le retrait du blanc des portions voisines en emplacements liés.

La préséance entre ponctuations hautes, qui laisse au signe de rang supérieur
le blanc qui les sépare, s’exprime comme une exclusion `skip` nommée
`adjacent-punctuation` ; elle s’appuie sur une primitive qui évalue les
exclusions d’une autre règle de la même famille à une autre position.

Exemple, l’espace avant le deux-points après migration :

```ts
export const COLON_SPACE_BEFORE_RULE = markSpacingRule({
  id: "punctuation.colon.nbsp-before",
  mark: ":",
  side: "before",
  expected: " ",
  exclusions: {
    "protected-content": { ensuredBy: "protection" },
    "time": { ensuredBy: "classification:numeric" },
    "ratio": { ensuredBy: "classification:numeric" },
    "port": { ensuredBy: "classification:numeric" },
    "uri": { skip: ({ after }) => after.character === "/" },
    "technical-syntax": { skip: doubledMark },
    "adjacent-punctuation": { skip: yieldsToHigherMark },
    "start-of-text": { skip: ({ before }) => before.character === undefined },
  },
});
```

`ensuredBy: "classification:numeric"` exige que la fiche dépende de la
classification qui produit ce type d’annotation (`dependsOn` ou `requires`) ;
la construction échoue sinon.

## 6. Exclusions et catalogue

- À la construction, `markSpacingRule` vérifie que chaque clé d’`exclusions`
  est l’identifiant d’une exception de la fiche, et que chaque exception de la
  fiche hors `scope: "integration"` ou `"review"` a une clé. Une incohérence
  lève `CATALOGUE_INCONSISTENCY`, au chargement du module, donc dans tous les
  tests.
- La migration ajoute aux fiches les exceptions de la section 2, qui décrivent
  des exclusions déjà exécutées : `start-of-text` pour les quatre espaces avant
  la ponctuation haute, `technical-syntax` pour le deux-points et le point
  d’exclamation, `adjacent-punctuation` pour le deux-points et le
  point-virgule. Les sorties ne changent pas ; la matrice reçoit leurs libellés
  français dans `docs/data/matrice-in-2002.json`, et chaque nouvelle exception
  testable reçoit un test qui la couvre
  ([conception de la matrice générée](conception-matrice-generee-v0.1.md)).
- Une exclusion `ensuredBy` n’exige pas de test propre à la règle : la
  protection est couverte par les invariants du pipeline, et la classification
  par ses propres tests. Une exclusion `skip` ou `report` exige un test qui
  déclare `covers(ruleId, [exceptionId])`.

## 7. Gabarit de test

Chaque règle écrite avec la fabrique reçoit, dans un fichier de test de sa
famille :

- un cas positif par sorte de défaut (espace manquante, d’une autre nature, en
  trop), avec le message attendu ;
- un cas négatif où l’espace attendue est déjà présente ;
- un cas par exclusion `skip` ou `report`, qui déclare `covers` avec
  l’identifiant de l’exception ;
- un cas de texte protégé contre le signe ;
- un cas où le blanc est réparti entre deux nœuds, correct puis incorrect ;
- l’idempotence en mode `fix`.

Un utilitaire de test commun énumère ces cas à partir d’une table, pour que le
coût d’une nouvelle règle soit sa table et non un fichier recopié. Les tests
existants des règles migrées restent inchangés.

## 8. Mise en œuvre et validation

Une PR, après la fusion de cette note :

1. module `src/rules/authoring/` (primitives et fabrique), avec ses tests de
   validation à la construction ;
2. migration des dix règles d’espacement de virgule, de point et de
   ponctuation haute ; exceptions ajoutées aux fiches, libellés de la matrice
   et tests de couverture ;
3. suppression du code remplacé dans `src/rules/punctuation.ts`.

Critères d’acceptation :

- le harnais de comparaison avec `main` (deux graines, toutes les compositions
  et tous les modes) ne montre aucune différence, messages compris ;
- `deno task bench --scaling` ne montre aucune croissance nouvelle, et les
  temps des règles migrées restent du même ordre ;
- `deno task check` et `deno task test` réussissent ; les tests existants sont
  inchangés, hors déclarations `covers` des nouvelles exceptions.

## 9. Hors champ

- L’export public de la couche, à décider après plusieurs lots de règles.
- Les fabriques des familles « construction annotée » et « motif sur les
  régions », à concevoir avec le premier lot qui en aura besoin.
- La migration de l’espace après la virgule, qui n’insère qu’en l’absence de
  blanc, et des espaces intérieures des guillemets, qui dépendent de leur
  appariement. Elles pourront rejoindre la fabrique si sa forme les accueille
  sans option ad hoc.
- Les sorties actuelles de combinaisons rares, comme `?:`, qui reçoit une
  espace-mot avant le deux-points parce que le point d’interrogation est
  prioritaire ; la migration les conserve, et toute évolution relèverait d’une
  issue distincte.
