# Architecture technique v0.4

## Objectif

Le cœur transforme des segments de texte déjà isolés par une intégration. Il ne parse ni HTML, ni Markdown, ni MDX : ces formats appartiennent aux adaptateurs, qui transmettent au moteur des segments textuels et des segments protégés.

## Séparation des responsabilités

| Couche | Responsabilité |
|---|---|
| catalogue | sources, localisateurs, règles documentaires et presets nommés |
| runtime | implémentations pures des règles atomiques |
| pipeline | ordre, dépendances, segments protégés et diagnostics |
| intégrations | analyse syntaxique des documents et reconstruction sans perte |
| distribution | source JSR canonique et paquet npm généré par `dnt` |

Une règle documentaire n’est pas automatiquement une règle exécutable. `RuleDefinition` décrit ce qui est attesté ; `RuntimeRule` porte l’algorithme. Cette séparation interdit qu’une expression régulière expérimentale soit confondue avec une prescription éditoriale. Une règle livrée tire son identifiant, sa phase, ses locales, son mode par défaut et ses dépendances de sa fiche du catalogue ; une règle externe utilise un identifiant préfixé par `x-` et n’a pas de fiche.

## Pipeline

L’ordre stable est : classification, glyphes, guillemets, espaces de ponctuation, espaces numériques, nettoyage. Une dépendance ne peut pas remonter vers une phase ultérieure. Le compilateur du pipeline rejette les identifiants dupliqués, les dépendances absentes et les cycles avant toute transformation.

Chaque règle est appelée une fois par passe sur une vue de toute la suite logique ; ses modifications et diagnostics, exprimés dans les coordonnées de cette suite, sont projetés sur les nœuds sources (voir la [conception de l’exécution sur la suite logique](conception-suite-logique-v0.1.md)).

Les intégrations peuvent protéger un segment entier. Cette primitive suffit au cœur pour préserver code, attributs ou syntaxe, sans lier la bibliothèque à un parseur particulier. Les règles de classification retournent des annotations typées : celles qui protègent deviennent des segments protégés, et toutes suivent les modifications des règles suivantes.

### Coordonnées des diagnostics

Une intégration peut attribuer un `id` stable à chaque `TextSegment`. Ces
identifiants doivent être non vides et uniques dans un appel au pipeline ; ils
sont conservés quand le classificateur découpe un nœud en fragments protégés.

Chaque diagnostic et chaque emplacement `related` est exprimé dans le segment
fourni par l’intégration, quel que soit le mode : `segmentIndex` et
`segmentId` désignent ce segment, tandis que `start` et `end` sont des offsets
UTF-16 semi-ouverts dans sa valeur initiale, dont `segmentValue` constitue
l’instantané exact. Une paire peut donc relier deux nœuds distincts sans
fusionner leurs positions, et un découpage par la protection ne change pas le
segment désigné.

Avec `mode: "lint"`, aucune règle ne transforme le texte et ces positions sont
exactes. Dans les autres modes, une règle peut constater un fait dans du texte
produit par une correction antérieure. Son emplacement est alors élargi à la
plage source de cette correction : un début situé dans un texte produit se
reporte au début de la plage remplacée, une fin à sa fin, et une position vide
au bord d’un texte inchangé garde sa position exacte
(`conception-resultats-v0.1.md`, § 6). Si des corrections s’annulent,
l’emplacement désigne le texte source inchangé qui les entourait. Une
intégration publie donc les diagnostics d’une passe de correction sur l’arbre
d’origine, sans passe `lint` séparée.

Les corrections suivent un contrat distinct. Une passe qui transforme le texte
retourne des `TextChange` non chevauchants, toujours projetés sur les segments
sources. Le pipeline compose les éditions atomiques successives dans un journal
et conserve leurs `ruleIds`. `expected` permet à une intégration de refuser un
changement si le document a évolué depuis son analyse.

Chaque changement porte un identifiant `id`, propre au résultat. Un diagnostic
dont les modifications ont été appliquées (une proposition) désigne par
`changeIds` les changements qui les contiennent, et par `groupId` son groupe de
propositions (`groups`). Deux propositions partagent un groupe quand les
modifications ou l’emplacement de l’une recoupent ou touchent un texte produit
par l’autre au moment où sa règle s’exécute, ou quand le journal fusionne leurs
modifications dans un même changement. Chaque changement appartient à un seul
groupe, de sorte que toute réunion de groupes s’applique sans conflit. Le
journal suit cette provenance par deux structures union-find, sur les pièces
modifiées et sur les propositions, ce qui garde la passe linéaire
([conception des diagnostics reliés à leurs changements](conception-resultats-v0.1.md),
§ 7). En mode `lint`, et pour les propositions non appliquées d’une règle en
mode `lint` dans le mode par défaut, il n’y a ni groupe ni changement.

Le mode `review` applique les propositions de toutes les règles, comme `fix`,
et indique pour chaque proposition appliquée le mode par défaut de sa règle
(`suggested`, `apply` ou `review`) ; un groupe est suggéré quand toutes ses
propositions le sont. L’option `dismissed` désigne des propositions écartées
par leur règle et leur emplacement source : elles sont validées mais non
appliquées, rapportées avec `dismissed: true`, et la cascade se poursuit sans
elles. Un hôte interactif relance ainsi la passe après chaque décision, sans
que le cœur suive l’historique du document.

Les éditions d’une même règle forment une transaction sur l’instantané courant
de la suite logique. Elles peuvent viser plusieurs segments non protégés ; le
pipeline les valide et les applique ensemble avant de passer à la règle
suivante. La ponctuation peut ainsi reconnaître ses voisins à travers des nœuds
en ligne, normaliser les blancs portés par un nœud adjacent et conserver les
exceptions techniques également réparties sur plusieurs nœuds. Cette propriété
vaut pour la suppression des blancs avant la virgule et le point comme pour
l’espacement de `:;?!`.

Le protocole de collecte et de reconstruction des nœuds est défini dans le
[contrat d’intégration des arbres textuels](integration-contract-v0.1.md).
`runTextNodePipeline` replie les fragments internes dans les nœuds sources sans
modifier la structure de l’arbre.

## Catalogue initial

Le catalogue machine contient deux presets candidats :

- `fr-FR/imprimerie-nationale-2002` ;
- `fr-CA/oqlf`.

Les comportements ambigus restent en `lint` ou `manual-review`. Le
classificateur numérique protège les constructions techniques et identifie les
mesures et les monnaies dont la notation figure dans les registres.
L’espacement des unités est
activé en diagnostic par défaut ; sa correction doit être demandée
explicitement. La règle euro suit la même politique ; les symboles monétaires
ambigus restent hors correction automatique.

## API initiale

```ts
import { compilePipeline, runPipeline } from "@orthotypography/core";
import { PRESETS, RULES, SOURCES } from "@orthotypography/core/catalogue";
```

Cette version expose l’infrastructure, les données documentaires, le registre
versionné des unités et préfixes, le registre monétaire initial, le
classificateur numérique, huit règles
exécutables de ponctuation, l’espacement des pourcentages et celui des
guillemets français appariés. La composition `IMPRIMERIE_NATIONALE_RULES`
protège d’abord les constructions numériques et techniques, puis applique le
sous-ensemble exécutable du preset attesté. La règle atomique de l’espace
suivant la virgule agit dans la prose, y compris à une frontière de segments
non protégés. Elle s’arrête devant une ponctuation adjacente, à une limite
protégée et dans les constructions numériques ou techniques reconnues. La
composition diagnostique l’espacement des unités et de l’euro sans les corriger
par défaut. Elle ne constitue pas un profil français universel.

## Distribution

Les mêmes sources TypeScript alimentent toutes les distributions JavaScript. Elles sont publiées directement sur JSR sous `@orthotypography/core` ; le paquet npm de même nom et de même version est généré par `@deno/dnt`, avec ESM et déclarations TypeScript. Comme dans `greek-conversion`, la publication de confiance est déclenchée par une release GitHub et reste désactivée tant que la variable `PUBLISH_ENABLED` n’est pas explicitement réglée à `true`.

## Prochain lot

1. Exécuter et auditer le premier import complet de la List One ISO 4217.
2. Créer le dépôt d’intégrations et y implémenter l’adaptateur rehype selon le
   contrat v0.1.
3. Ajouter ensuite la couche de configuration Astro au-dessus de rehype.
