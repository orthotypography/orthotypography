# Conception — exécution des règles sur la suite logique v0.1

**Date :** 26 septembre 2026
**Issues :** [nº 21](https://github.com/orthotypography/orthotypography/issues/21)
(vue de la suite logique),
[nº 22](https://github.com/orthotypography/orthotypography/issues/22)
(annotations typées),
[nº 25](https://github.com/orthotypography/orthotypography/issues/25)
(règles exécutables séparées des définitions)
**Base examinée :** `0.1.0-alpha.3` et `main` au commit `27bc64a`
**Statut :** conception validée ; aucune implémentation dans ce document

## 1. Objet

Une règle est aujourd’hui appelée une fois par fragment. Elle lit les autres
fragments par `context.segments` et modifie ses voisins par `segmentEdits`.
Chaque module reconstruit donc la suite logique, ce qui duplique le code, rend
le coût quadratique et laisse sans traitement les constructions numériques
coupées entre deux nœuds (`10` suivi de `:30`, `25` suivi de `%`). Voir la
[revue d’architecture](revue-architecture-v0.1.md).

Ce document fixe le contrat qui remplace cette interface dans la ligne `0.2`.

## 2. Décisions

1. L’interface actuelle des règles est remplacée en `0.2`, sans adaptateur de
   compatibilité : aucune règle tierce n’est connue.
2. Le type public garde le nom `RuntimeRule`, afin de limiter les changements
   dans les intégrations, qui ne manipulent que des tableaux de règles.
3. Les constructions numériques coupées entre nœuds deviennent traitables ;
   l’espace insérée entre un nombre et son symbole appartient au nœud du
   symbole.

## 3. Contrat d’une règle

Une règle est appelée une seule fois par passe, sur une vue en lecture seule
de toute la suite logique. Ses modifications et diagnostics sont exprimés dans
les coordonnées UTF-16 de cette suite ; le pipeline les projette sur les nœuds
et les coordonnées sources.

```ts
interface LogicalRun {
  /** Texte courant de toute la suite, nœuds protégés compris. */
  readonly text: string;
  readonly locale: string;
  readonly mode: RuleMode;
  /** Plages protégées, triées et disjointes. */
  readonly protectedRanges: readonly Range[];
  /** Frontières des nœuds sources dans `text`, sans leur contenu. */
  readonly nodeBoundaries: readonly number[];
  /** Annotations d’un type, triées par position. */
  annotations(kind: string): readonly Annotation[];
}

interface RuntimeRule {
  readonly id: string;
  readonly phase: RulePhase;
  readonly locales: readonly string[];
  readonly defaultMode: RuleMode;
  readonly dependsOn?: readonly string[];
  apply(run: LogicalRun): RuleResult;
}

interface RuleResult {
  readonly edits?: readonly RunEdit[];
  readonly diagnostics?: readonly RunDiagnostic[];
  /** Réservé aux règles de la phase `classify`. */
  readonly annotations?: readonly Annotation[];
}

interface RunEdit {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
  /** Nœud qui reçoit le texte inséré à une frontière ; `left` par défaut. */
  readonly bias?: "left" | "right";
}
```

`RunDiagnostic` reprend les champs actuels (`start`, `end`, `message`,
`replacement`, `related`) dans les coordonnées de la suite, avec un `bias`
facultatif pour les emplacements vides situés à une frontière. Les nœuds eux-mêmes
restent invisibles : `nodeBoundaries` sert aux règles qui doivent choisir
`bias` et, pour les règles migrées à l’étape 2, à borner leurs parcours comme le
faisait l’exécution par fragment (`src/rules/run-text.ts`).

## 4. Validation et projection des modifications

### 4.1 Validité

Le pipeline refuse le résultat entier d’une règle si :

- une modification sort de `[0, text.length]` ou a `end < start` ;
- deux modifications se chevauchent ou commencent à la même position, sauf une
  insertion suivie d’une modification non vide : l’insertion précède alors le
  texte remplacé, et les deux sont fusionnées si elles tombent dans le même
  nœud ;
- une modification non vide recoupe une plage protégée ;
- une insertion tombe à l’intérieur d’une plage protégée, ou à une frontière
  dont le côté désigné par `bias` est protégé ;
- une règle modifie le texte en mode `lint`.

### 4.2 Projection sur les nœuds

- Une modification contenue dans un nœud devient un changement de ce nœud.
- Une modification qui traverse plusieurs nœuds est découpée : chaque nœud
  perd sa part du texte remplacé ; le texte de remplacement entier va au
  premier nœud touché (`left`) ou au dernier (`right`). Une frontière ne reçoit
  donc jamais deux insertions.
- Une insertion placée exactement à une frontière va au dernier nœud non vide
  qui se termine à cette position (`left`) ou au premier nœud non vide qui y
  commence (`right`), c’est-à-dire au nœud du caractère voisin ; si le nœud
  choisi est protégé, l’insertion est refusée ; au début ou à la fin de la
  suite, où ce côté n’existe pas, l’autre côté est utilisé. Les nœuds vides non
  protégés ne reçoivent une insertion que si aucun nœud non vide ne touche la
  position, c’est-à-dire dans une suite vide ; les nœuds protégés vides sont
  toujours ignorés.
- Un diagnostic vide placé à une frontière suit la même règle, `bias` compris,
  sans refus pour les nœuds protégés ; un diagnostic non vide doit tenir dans un
  seul fragment tant que le format des résultats n’évolue pas
  ([nº 26](https://github.com/orthotypography/orthotypography/issues/26)).

Convention des règles françaises, conforme au comportement actuel : un blanc
inséré ou normalisé appartient au nœud du signe dont il dépend. Exemples
mesurés sur `0.1.0-alpha.3` :

| Nœuds | Résultat |
| --- | --- |
| `Bonjour,` · `monde` | `Bonjour, ` · `monde` |
| `Bonjour` · `; oui` | `Bonjour` · ` ; oui` |
| `Bonjour ` · `;oui` | `Bonjour` · ` ; oui` |
| `«` · `texte»` | `« ` · `texte »` |

Un blanc déjà correct n’est pas déplacé, même s’il se trouve dans un nœud
voisin de celui du signe : `Bonjour` · ` ` · `; oui`, avec une espace fine
insécable, ne produit aucune modification
([nº 63](https://github.com/orthotypography/orthotypography/issues/63)), pas
plus que `«` · ` ` · `oui` · ` ` · `»` avec des espaces insécables
([nº 66](https://github.com/orthotypography/orthotypography/issues/66)). Les
hôtes découpent eux-mêmes les nœuds, et un déplacement sans effet sur le texte
serait proposé à chaque passe.

Le blanc d’un signe est lu dans son nœud et se prolonge dans les nœuds voisins
non protégés. Un blanc incorrect est normalisé dans le nœud du signe, et sa
partie située dans les nœuds voisins est supprimée : `« ` · ` texte»` donne
`« ` · `texte »`, avec une espace insécable dans le premier nœud. Jusqu’au
nº 66, la règle des guillemets ne lisait que le nœud du signe et doublait
l’espace. Un blanc situé dans un texte protégé ne peut être corrigé : le signe
est alors laissé tel quel.

Les nœuds protégés vides n’apparaissent pas dans la vue : aucune règle ne les
voit. Dans l’exécution par fragment, un tel nœud bloquait l’espace après la
virgule, la reconnaissance d’une suite de points et la recherche du signe voisin
en ponctuation haute, mais pas la suppression des blancs ; pour les points de
suspension, il coupait la suite examinée et faisait perdre le début structurel
du texte. Les règles migrées l’ignorent partout.

Le ledger des changements, les coordonnées sources, le garde-fou `expected` et
`applyTextChanges` sont inchangés.

## 5. Annotations

```ts
interface Annotation {
  readonly kind: string;
  readonly start: number;
  readonly end: number;
  /** La plage devient protégée pour toutes les règles suivantes. */
  readonly protect?: boolean;
  readonly data?: Readonly<Record<string, string>>;
}
```

- Les règles de la phase `classify` produisent des annotations sur toute la
  suite, une seule fois. La classification numérique devient une annotation
  `numeric` dont `data.kind` et `data.disposition` reprennent
  `NumericConstructKind` et `NumericConstructDisposition`.
- Les plages protégées de la vue sont l’union des nœuds protégés et des
  annotations `protect`.
- Après les modifications d’une règle, une annotation qui contient entièrement
  une modification est étendue ou réduite d’autant ; une annotation
  partiellement recouverte est retirée ; les autres sont décalées. Une
  insertion au début d’une annotation la décale, une insertion à sa fin la
  laisse en place.
- La classification numérique s’exécute une fois par portion non protégée de
  la suite. Les contextes syntaxiques (`protect`) y sont cherchés sur toute la
  portion, ce qui protège une heure ou une version coupée entre deux nœuds ;
  les cibles (`target`) sont cherchées dans le texte compris entre ces
  contextes, comme chaque règle numérique le reclassait dans son fragment.
- `dependsOn` reste une contrainte d’ordre entre identifiants ; le type
  d’annotation consommé par une règle est documenté avec elle.

## 6. Règles exécutables et catalogue

- `RuntimeRule` ne contient plus de `RuleDefinition`. Les règles livrées sont
  construites à partir de leur fiche du catalogue, qui fournit phase, locales,
  mode par défaut et dépendances ; il n’y a qu’une source pour ces valeurs.
- Un test vérifie que chaque règle livrée a une fiche au même identifiant.
- Les règles tierces utilisent des identifiants préfixés par `x-` et n’ont pas
  besoin de fiche documentaire.

## 7. Ce qui ne change pas

Les entrées (`runPipeline`, `runTextNodePipeline`, `TextSegment`,
`TextNodeInput`), les sorties (`TextChange`, `RuleDiagnostic`, espaces de
coordonnées, `appliedRuleIds`) et `applyTextChanges` gardent leur forme. Leur
évolution relève des issues
[nº 26](https://github.com/orthotypography/orthotypography/issues/26) et
[nº 27](https://github.com/orthotypography/orthotypography/issues/27). Les
presets, les modes par règle et les locales relèvent des issues
[nº 23](https://github.com/orthotypography/orthotypography/issues/23) et
[nº 24](https://github.com/orthotypography/orthotypography/issues/24).

## 8. Compatibilité avec le SDK et Google Docs

`@orthotypography/editor-sdk` exécute `runTextNodePipeline` en `lint` puis en
`fix` sur des nœuds qui correspondent à des passages de style uniforme, vérifie
`applyTextChanges`, puis place chaque changement par son nœud. D’où trois
exigences :

1. **Attribution identique.** Le texte inséré prend le style de son nœud
   (`google-docs-style.ts`). Chaque règle migrée reproduit le nœud actuel de
   chaque insertion.
2. **Une insertion par frontière.** Le SDK refuse deux insertions au même
   index natif ; la projection du § 4.2 le garantit.
3. **Bords de paragraphe.** Le SDK refuse les insertions stylées au bord d’un
   paragraphe ; les règles migrées n’en créent pas de nouvelles.

Le code source du SDK compile sans changement. Ses tests qui fabriquent des
règles avec l’ancienne interface seront réécrits lors du passage au cœur
`0.2`.

## 9. Étapes et vérifications

| Étape | Contenu | Sorties |
| --- | --- | --- |
| 1 | Pipeline exécutant les règles sur la vue, construite une fois par règle ; les règles non migrées gardent leur exécution par fragment | identiques |
| 2 | Migration des guillemets, de la ponctuation, puis des points de suspension, une PR par module ; suppression des utilitaires dupliqués | identiques |
| 3 | Annotations : classification numérique puis règles numériques | identiques, sauf constructions coupées entre nœuds |
| 4 | Séparation des définitions (§ 6) et bascule publique ; suppression de `segmentEdits` et `context.segments` | identiques |

État : l’étape 1 est fusionnée
([PR nº 41](https://github.com/orthotypography/orthotypography/pull/41)).
L’étape 2 est terminée : guillemets
([PR nº 43](https://github.com/orthotypography/orthotypography/pull/43)),
ponctuation ([PR nº 45](https://github.com/orthotypography/orthotypography/pull/45),
reportée sur `main` par la
[PR nº 46](https://github.com/orthotypography/orthotypography/pull/46)) et points
de suspension
([PR nº 47](https://github.com/orthotypography/orthotypography/pull/47)). Seules
les règles numériques gardent l’exécution par fragment ; elles relèvent de
l’étape 3 : la [PR nº 48](https://github.com/orthotypography/orthotypography/pull/48)
exécute la classification numérique sur la suite et conserve ses annotations,
et la [PR nº 49](https://github.com/orthotypography/orthotypography/pull/49)
fait lire ces annotations aux règles numériques. Toutes les règles livrées
s’exécutent désormais sur la suite. L’étape 4
([PR nº 50](https://github.com/orthotypography/orthotypography/pull/50)) rend
publique l’interface du § 3, construit les règles livrées à partir de leur fiche
(§ 6) et retire l’interface par fragment. Le chantier est achevé ; la
publication de `0.2.0` attend encore les issues nº 26 et nº 27.

Règles numériques après l’étape 3 :

- une construction contenue dans un fragment est remplacée entière, comme
  auparavant ;
- une construction coupée entre nœuds reçoit les modifications minimales :
  l’espace avant un symbole (`%`, unité, `€` final) va au nœud du symbole ; un
  `€` initial et son blanc quittent leur place et suivent le montant, dans le
  nœud du montant ; le diagnostic porte sur la première partie, les autres
  parties en emplacements liés, sans remplacement tant que le format des
  résultats n’évolue pas
  ([nº 26](https://github.com/orthotypography/orthotypography/issues/26)) ;
- les annotations suivent les modifications des règles antérieures au lieu
  d’être recalculées : dans un seul nœud, une construction modifiée entre la
  classification et la règle garde la lecture de la classification (voir la
  PR nº 49).

Chaque étape vérifie :

- les tests, les invariants et les instantanés du corpus ;
- une comparaison complète avec l’implémentation précédente sur les entrées
  générées, le corpus et des textes longs ;
- à partir de l’étape 2, les tests du SDK et une comparaison des lots de
  requêtes Google Docs, simples et stylés, sur la fixture de validation réelle
  et sur des paragraphes générés avec de nombreux changements de style ;
- `deno task bench`, comparé à [`performances-v0.1.md`](performances-v0.1.md),
  et `deno task bench --scaling`, dont le facteur de croissance par doublement
  doit rester proche de 2 pour les lignes qui relèvent des règles migrées.

À l’étape 3, les instantanés segmentés du corpus changent volontairement ; la
PR liste chaque différence. La publication de `0.2.0` suit ce chantier et
celui des issues nº 26 et nº 27.
