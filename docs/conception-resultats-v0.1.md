# Conception — diagnostics reliés à leurs changements v0.1

**Date :** 30 septembre 2026, révisée le 19 octobre 2026 **Issue :**
[nº 26](https://github.com/orthotypography/orthotypography/issues/26)
(changements proposés rattachés aux diagnostics) **Base examinée :** `main` au
commit `bfcb659`, après le chantier de la suite logique
([nº 21](https://github.com/orthotypography/orthotypography/issues/21)) **Statut
:** direction générale validée, acceptation partielle par groupes retenue
(option 3 de la discussion du 30 septembre) ; aucune implémentation dans ce
document

## 1. Objet

Une intégration qui veut à la fois signaler et corriger exécute aujourd’hui deux
passes : `lint` pour des diagnostics en coordonnées sources, `fix` pour les
changements. Rien ne relie un diagnostic au changement qui le corrige, et un
utilisateur ne peut accepter que la totalité des corrections.

Ce document fixe, pour la ligne `0.2`, le contrat qui permet à une seule passe
de fournir des diagnostics reliés à leurs changements, et à un hôte interactif,
comme une application de relecture, d’accepter ou d’écarter les corrections une
à une, sans jamais appliquer un changement incohérent.

## 2. État actuel

- Une règle renvoie deux listes indépendantes, `edits` et `diagnostics`
  (`RuleResult`). Le lien entre une modification et le diagnostic qui la
  justifie n’existe que dans le code de la règle.
- En mode `lint`, aucune règle ne modifie le texte : chaque règle voit le texte
  d’origine et les diagnostics sont en coordonnées `source`.
- En mode `fix`, chaque règle voit le texte laissé par les précédentes. Un
  diagnostic dont l’objet recoupe un texte déjà modifié passe dans l’espace
  `runtime` (fragment, révision, valeur du moment), que l’intégration ne peut
  pas projeter sur son document.
- Le journal des changements fusionne les modifications contiguës de plusieurs
  règles en un seul `TextChange`, qui garde la liste de leurs `ruleIds`.
- L’editor SDK exécute les deux passes : `prepareDocumentPlan` prend les
  diagnostics de `lint` et les changements de `fix`, et n’accepte que des lots
  complets. Les adaptateurs rehype, Sätteri et Astro transmettent les
  diagnostics du mode choisi, y compris des emplacements `runtime` en mode
  `fix`.

Mesures sur le corpus (18 paragraphes, toutes les règles exécutables, un
segment) : en mode `fix`, 5 diagnostics sur 67 sont en coordonnées `runtime`, et
un paragraphe n’a pas les mêmes diagnostics en `lint` et en `fix`. Quatre de ces
cinq diagnostics viennent d’un conflit entre règles : avant un `»` fermant, la
règle d’espace après `!` ou `?` remplace l’espace insécable que la règle des
guillemets vient d’insérer, et les deux modifications peuvent s’annuler (§ 7.3).

## 3. Décisions

1. **Les modifications appartiennent aux diagnostics.** Une règle ne renvoie
   plus de liste `edits` séparée : chaque diagnostic porte les modifications qui
   le corrigent. Un diagnostic qui porte des modifications est une
   **proposition**. Une correction sans diagnostic devient impossible par
   construction.
2. **Une passe calcule toute la cascade.** Les propositions s’appliquent dans
   l’ordre des règles, chacune voyant le texte laissé par les précédentes, et
   chaque diagnostic est relié aux changements finaux qui contiennent ses
   modifications.
3. **Tous les emplacements sont en coordonnées sources.** L’espace `runtime`
   disparaît ; un objet situé dans un texte déjà modifié est rapporté sur la
   plage source du changement qui l’a produit (§ 6).
4. **Les propositions liées forment des groupes.** Deux propositions sont liées
   quand l’une modifie ou désigne un texte produit par l’autre, ou contigu à
   celui-ci, ou quand le journal fusionne leurs modifications. Un groupe est
   l’unité d’acceptation : l’accepter applique tous ses changements, et
   n’importe quelle réunion de groupes s’applique sans conflit (§ 7).
5. **Un nouveau mode `review` propose sans rien imposer.** Il calcule la cascade
   de toutes les règles, quel que soit leur mode par défaut, qui devient une
   indication (`suggested`). Les modes `fix` et `lint` gardent leur sens.
6. **Écarter une proposition se fait en relançant la passe** avec la liste des
   propositions écartées, désignées par leur règle et leur plage source. La
   cascade se recalcule sans elles ; aucune dépendance n’est devinée.

## 4. Contrat des règles

```ts
interface RunDiagnostic extends RunLocation {
  readonly message: string;
  readonly replacement?: string;
  readonly related?: readonly RunLocation[];
  /** Modifications qui corrigent ce diagnostic. */
  readonly edits?: readonly RunEdit[];
}

interface RuleResult {
  readonly diagnostics?: readonly RunDiagnostic[];
  /** Réservé aux règles de la phase `classify`. */
  readonly annotations?: readonly Annotation[];
}
```

- Le pipeline valide l’ensemble des modifications d’une règle comme aujourd’hui
  (§ 4.1 de la
  [conception de la suite logique](conception-suite-logique-v0.1.md)), toutes
  propositions confondues : deux propositions d’une même règle ne peuvent pas se
  chevaucher.
- Une règle renvoie ses modifications quel que soit le mode ; c’est le pipeline
  qui décide de les appliquer. Les règles n’ont plus à lire `run.mode` pour
  cela.
- Une règle de simple diagnostic (groupement des chiffres) ne renvoie pas
  d’`edits`.

Les règles livrées produisent déjà un diagnostic par groupe de modifications ;
leur migration consiste à déplacer ces modifications dans le diagnostic
correspondant.

## 5. Résultat du pipeline

```ts
interface TextChange {
  /** Identifiant stable dans ce résultat. */
  readonly id: string;
  readonly segmentIndex: number;
  readonly segmentId?: string;
  readonly start: number;
  readonly end: number;
  readonly expected: string;
  readonly replacement: string;
  readonly ruleIds: readonly string[];
}

interface DiagnosticLocation {
  readonly segmentIndex: number;
  readonly segmentId?: string;
  /** Valeur source du segment, à laquelle s’appliquent start et end. */
  readonly segmentValue: string;
  readonly start: number;
  readonly end: number;
}

interface RuleDiagnostic extends DiagnosticLocation {
  readonly ruleId: string;
  readonly message: string;
  readonly replacement?: string;
  readonly related?: readonly DiagnosticLocation[];
  /** Pour une proposition : le groupe qui l’accepte. */
  readonly groupId?: string;
  /** Changements du résultat qui contiennent les modifications du diagnostic. */
  readonly changeIds?: readonly string[];
  /** Mode par défaut de la règle, à titre d’indication en mode `review`. */
  readonly suggested?: "apply" | "review";
  /** Proposition écartée par l’hôte : non appliquée, rapportée pour mémoire. */
  readonly dismissed?: true;
}

interface ProposalGroup {
  readonly id: string;
  /** Changements à appliquer ensemble ; vide si les modifications s’annulent. */
  readonly changeIds: readonly string[];
  /** Indices des diagnostics du groupe dans `diagnostics`. */
  readonly diagnostics: readonly number[];
  /**
   * En mode `review` : vrai si toutes ses propositions viennent de règles en
   * mode `fix`. Absent dans les autres modes, dont la sortie reste inchangée.
   */
  readonly suggested?: boolean;
}

interface PipelineResult {
  readonly value: string;
  readonly segments: readonly TextSegment[];
  readonly changes: readonly TextChange[];
  readonly groups: readonly ProposalGroup[];
  readonly diagnostics: readonly RuleDiagnostic[];
  readonly appliedRuleIds: readonly string[];
}
```

- `coordinateSpace` et `segmentRevision` disparaissent.
- `value` et `segments` donnent le texte obtenu en appliquant tous les groupes.
- Invariants, vérifiés par le harnais :
  - chaque changement appartient à exactement un groupe ;
  - pour toute réunion de groupes, l’application de leurs changements par
    `applyTextChanges` réussit ; pour la réunion de tous, elle reproduit `value`
    ;
  - chaque proposition non écartée appartient à un groupe ; un diagnostic sans
    modification n’appartient à aucun ;
  - relancer la passe en écartant les propositions d’un groupe donne un résultat
    où celles qui se présentent encore sont rapportées `dismissed`, sans groupe,
    et où aucun changement ne les contient ; les propositions de la première
    règle du groupe se présentent toujours, et les diagnostics des règles qui la
    précèdent sont inchangés. Les propositions suivantes du groupe dépendaient
    du texte écarté et peuvent disparaître.

## 6. Projection des emplacements sur la source

Le journal d’un segment source est une suite de pièces, inchangées ou produites
par des propositions. Un emplacement exprimé sur le texte courant se projette
borne par borne :

- une borne située dans une pièce inchangée garde sa position source exacte ;
- une borne `start` située dans une pièce modifiée prend le début source de
  cette pièce, une borne `end` sa fin source ;
- un emplacement vide situé au bord d’une pièce inchangée se projette par cette
  pièce, la précédente d’abord : la position qui suit un `?` garde sa position
  exacte même si l’espace suivante a été supprimée.

La plage obtenue contient toujours l’objet du diagnostic, élargie au plus petit
changement qui l’englobe : dans `vaut 1 200 €`, le diagnostic de groupement de
`1 200`, posé après la réécriture de la construction par la règle de l’euro, est
rapporté sur `1 200 €`. Un objet entièrement inséré par une règle antérieure
(plage source vide) est rapporté sur la position de l’insertion. Un diagnostic
dont l’objet traverse plusieurs segments reste interdit tant qu’il n’est pas
découpé par la règle, comme aujourd’hui.

## 7. Groupes de propositions

### 7.1 Construction

Chaque modification appliquée porte l’identité de sa proposition. Le journal
conserve ces identités dans ses pièces, comme il conserve déjà les `ruleIds`.
Deux propositions sont réunies dans un même groupe :

- quand une modification ou l’emplacement de l’une recoupe, ou touche par une
  borne, une pièce produite par l’autre au moment où sa règle s’exécute ;
- quand le journal fusionne leurs modifications dans un même changement final.

Les groupes sont les classes de cette relation, calculées par union-find pendant
la passe. Chaque changement final appartient au groupe de ses propositions. Le
coût reste linéaire dans le nombre de modifications, à un facteur logarithmique
près (recherche des pièces voisines), comme le journal (§ « Après le journal
linéaire » des [mesures de performance](performances-v0.1.md)).

### 7.2 Garanties et limites

- Les changements de groupes distincts ne se chevauchent pas : toute réunion de
  groupes s’applique, et chaque changement appliqué est justifié par un
  diagnostic.
- La contiguïté couvre les dépendances locales : une règle qui réagit au texte
  qu’une autre vient d’insérer juste à côté entre dans son groupe. Une
  dépendance lointaine, par exemple une décision prise d’après un appariement de
  guillemets à l’autre bout de la phrase, n’est pas détectée. Une réunion de
  groupes donne alors un texte correct changement par changement, mais pas
  forcément celui qu’une nouvelle passe produirait.
- C’est pourquoi un hôte interactif relance la passe après chaque acceptation,
  sur le document mis à jour : toute proposition devenue nécessaire ou caduque
  apparaît dans le nouveau résultat. La passe étant linéaire, une relance sur un
  paragraphe coûte quelques millisecondes.

### 7.3 Modifications qui s’annulent

Une proposition peut défaire celle d’une autre : la règle des guillemets
remplace par une espace insécable l’espace ordinaire avant `»`, puis la règle
d’espace après `!` la remet. Les deux propositions sont réunies par contiguïté ;
il ne reste aucun changement, et le groupe a une liste `changeIds` vide. Le
contrat l’admet : l’hôte peut présenter ces diagnostics comme contradictoires.
Ce cas précis est un défaut des règles de ponctuation, à corriger séparément
([issue nº 54](https://github.com/orthotypography/orthotypography/issues/54)).

## 8. Modes

| Mode     | Cascade                                       | Résultat                                                                            |
| -------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `review` | toutes les propositions, sauf celles écartées | `value` avec tout appliqué ; groupes et indications `suggested`                     |
| `fix`    | toutes les propositions, sauf celles écartées | comme `review`, sans indications ; l’hôte applique tout                             |
| `lint`   | aucune modification, aucune cascade           | diagnostics sources, sans groupe ni changement                                      |
| défaut   | propositions des règles en mode `fix`         | modes par règle, comme aujourd’hui ; propositions des autres règles sans changement |

- Les règles s’exécutent en mode `review` comme en mode `fix` (`run.mode` vaut
  `fix`) : sans les indications, le résultat est celui du mode `fix`.
- En mode `review`, le mode par défaut de chaque règle devient une indication :
  `suggested: "apply"` pour une règle en mode `fix`, `"review"` sinon. Un groupe
  est `suggested` si toutes ses propositions le sont. Un hôte peut ainsi
  pré-cocher les corrections sûres et laisser les autres à l’appréciation de
  l’utilisateur.
- Accepter seulement les groupes `suggested` ne reproduit pas toujours la sortie
  du mode par défaut, parce que les propositions non suggérées ont pu influencer
  la cascade ; la relance après acceptation (§ 7.2) corrige cet écart.
- Le mode `lint` reste une vérification sans modification, utile en intégration
  continue.

### 8.1 Propositions écartées

```ts
interface DismissedProposal {
  readonly ruleId: string;
  readonly segmentId?: string;
  readonly segmentIndex?: number;
  readonly start: number;
  readonly end: number;
}

runPipeline(input, rules, { locale, mode: "review", dismissed });
```

- Le pipeline projette l’emplacement de chaque proposition au moment où sa règle
  s’exécute ; si la règle et la plage source correspondent à une entrée de
  `dismissed`, la proposition n’est pas appliquée et la cascade continue sans
  elle. Elle est rapportée avec `dismissed: true`, sans groupe. Ses
  modifications restent validées avec celles des autres propositions de sa
  règle.
- Une entrée désigne le segment par `segmentId` ou par `segmentIndex`, et
  écarte toutes les propositions de sa règle rapportées sur cette plage ; une
  entrée sans segment ou dont la plage est invalide est refusée.
- L’écart vaut dans tous les modes : en `lint` et pour les règles non
  appliquées du mode par défaut, la proposition est seulement marquée.
- Les plages désignent le document sur lequel la passe s’exécute. Quand l’hôte
  modifie le document, il met à jour ces plages comme il le fait pour toute
  annotation de son éditeur ; le cœur ne suit pas l’historique du document.

## 9. Conséquences pour les intégrations

- **editor SDK.** `prepareDocumentPlan` n’exécute plus qu’une passe `review`. Le
  plan expose les groupes et la validation reçoit les groupes acceptés ; le lot
  reste atomique et revalidé dans la transaction native. La règle des
  intégrations qui exclut l’acceptation partielle est remplacée par celle-ci :
  une acceptation partielle porte sur des groupes entiers du plan courant,
  jamais sur des changements isolés.
- **Application macOS.** Elle relance la passe `review` après chaque acceptation
  et transmet les propositions écartées, dont elle suit les plages dans son
  stockage de texte.
- **rehype, Sätteri, Astro.** Les diagnostics transmis sont toujours en
  coordonnées sources ; le champ `coordinateSpace` de `AdapterDiagnostic`
  disparaît. Ces adaptateurs appliquent tout ou rien et n’exposent pas les
  groupes dans un premier temps.
- Notes de migration dans le `CHANGELOG` du cœur et dans la feuille de route des
  intégrations, qui adoptent ces changements avec le passage au cœur `0.2`
  publié, comme l’interface des règles
  ([PR nº 50](https://github.com/orthotypography/orthotypography/pull/50)).

## 10. Étapes et vérifications

| Étape | Contenu                                                                  | Sorties                                                                    |
| ----- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1     | Modifications portées par les diagnostics ; migration des règles livrées | identiques                                                                 |
| 2     | Emplacements toujours sources ; suppression de l’espace `runtime`        | identiques en `lint` ; en `fix`, seuls les emplacements `runtime` changent |
| 3     | `id` des changements, `changeIds` des diagnostics et groupes             | ajout des champs                                                           |
| 4     | Mode `review`, indications `suggested`, propositions écartées            | nouveau mode ; `fix`, `lint` et le mode par défaut inchangés               |

Chaque étape vérifie les tests, les invariants (dont ceux du § 5), les
instantanés du corpus, une comparaison complète avec l’implémentation
précédente, les tests des intégrations sur une version de développement, et
`deno task bench --scaling`. Les étapes 3 et 4 ajoutent au harnais l’application
de réunions aléatoires de groupes et la relance avec des propositions écartées.

## 11. Alternatives écartées et hors champ

- **Suggestions indicatives seulement** (option 1 du 30 septembre) : simple,
  mais sans acceptation une à une, nécessaire à l’application macOS.
- **Changements sources pour les seules propositions qui ne touchent pas un
  texte déjà modifié** (option 2) : couverture partielle et résultat hétérogène.
- **Changements indépendants par diagnostic**, calculés comme si la règle était
  seule sur le texte d’origine : ils ne reproduisent pas la cascade, et leur
  somme ne donne pas la sortie `fix`.
- **Dépendances exactes par traçage des lectures de chaque règle** : une règle
  peut lire n’importe quelle partie de la suite, et tracer ses lectures
  imposerait une instrumentation coûteuse de toutes les règles ; la contiguïté
  et la relance après acceptation suffisent.
- **Garder l’espace `runtime`** : il oblige toujours les intégrations à une
  seconde passe pour publier des positions.
- **Codes de message et erreurs typées** : issue
  [nº 27](https://github.com/orthotypography/orthotypography/issues/27), qui
  suivra ce contrat.
