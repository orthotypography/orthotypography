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

Avec `mode: "lint"`, aucune règle ne transforme le texte. Chaque diagnostic et
chaque emplacement `related` est alors exprimé dans l’espace `source` :
`segmentIndex` et `segmentId` désignent le segment fourni par l’intégration,
tandis que `start` et `end` sont des offsets UTF-16 semi-ouverts dans sa valeur
initiale. Une paire peut donc relier deux nœuds distincts sans fusionner leurs
positions. `segmentValue` constitue l’instantané exact auquel appliquer ces
offsets.

Dans tout autre mode, des règles antérieures peuvent avoir modifié ou découpé
le texte. Les diagnostics utilisent alors l’espace `runtime` : ils désignent le
fragment au moment précis de l’exécution de la règle, identifié par son index,
sa révision et `segmentValue`. Une intégration qui doit publier des positions
dans le document source exécute donc une passe `lint` séparée ; elle ne doit pas
projeter les offsets d’une passe de correction sur l’arbre d’origine.

Les corrections suivent un contrat distinct. Une passe qui transforme le texte
retourne des `TextChange` non chevauchants, toujours projetés sur les segments
sources. Le pipeline compose les éditions atomiques successives dans un journal
et conserve leurs `ruleIds`. `expected` permet à une intégration de refuser un
changement si le document a évolué depuis son analyse. La
[conception des diagnostics reliés à leurs changements](conception-resultats-v0.1.md)
propose de supprimer l’espace `runtime` et de relier chaque diagnostic aux
changements qui le corrigent.

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
