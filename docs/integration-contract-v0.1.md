# Contrat d’intégration des arbres textuels v0.1

## Portée

Le cœur ne dépend d’aucun format d’arbre. Une intégration rehype, Astro ou
équivalente extrait des nœuds textuels, décide de leurs frontières sémantiques
et transmet chaque suite logique à `runTextNodePipeline`. Le cœur modifie
uniquement les valeurs textuelles : il ne crée, ne supprime, ne déplace et ne
fusionne aucun nœud.

## Suite textuelle logique

Une invocation regroupe les nœuds de texte entre lesquels une construction
typographique peut se poursuivre, notamment une paire de guillemets séparée
par un élément de mise en forme en ligne. Elle ne traverse pas :

- deux blocs distincts ;
- un saut de ligne explicite portant une valeur sémantique ;
- un nœud HTML brut ou un composant embarqué dont le contenu n’est pas connu ;
- `script`, `style`, `pre`, `code` ou tout sous-arbre exclu par la politique de
  l’intégration.

Un contenu connu mais intangible peut être transmis avec `protected: true`.
Il participe alors au texte logique et à l’appariement, mais aucune règle ne le
transforme. Une frontière, au contraire, termine l’invocation courante.

## Identité et reconstruction

Chaque `TextNodeInput` reçoit un `id` non vide, unique dans l’invocation et
stable pendant celle-ci. L’identifiant peut provenir du chemin du nœud dans
l’arbre ; il n’a pas vocation à devenir un identifiant documentaire persistant.

`runTextNodePipeline` replie les fragments créés par le classificateur dans
leur nœud d’origine et retourne exactement un `TextNodeOutput` par entrée, dans
le même ordre. L’intégration remplace chaque propriété textuelle par la valeur
portant le même `id`. Elle ne reconstruit pas l’arbre depuis `value` et ne
répartit pas une chaîne concaténée par calcul de longueurs.

## Deux passes explicites

Une intégration choisit toujours le mode :

- `lint` conserve toutes les valeurs ;
- `fix` retourne les nouvelles valeurs par nœud et son tableau `changes`, jeu
  complet de remplacements dans l’espace source ;
- `review` donne le même résultat que `fix`, avec en plus, pour chaque
  proposition appliquée et chaque groupe, l’indication `suggested` tirée du
  mode par défaut des règles ; un éditeur interactif peut ainsi pré-cocher les
  groupes suggérés.

La locale de chaque suite logique est comparée sous forme canonique aux locales
des règles, sans repli régional. Une passe dont aucune règle ne prend en charge
la locale lève une erreur : une intégration qui traite un document multilingue
interroge `ruleLocaleSupport` avant chaque suite et passe celles qu’aucune
règle ne couvre. Les règles ignorées d’une passe figurent dans
`skippedRuleIds`.

Les propositions que l’utilisateur refuse sont transmises à la passe suivante
dans `dismissed`, par leur règle, leur `segmentId` et leur plage source ;
l’intégration met ces plages à jour quand le document change.

Dans tous les modes, les diagnostics sont exprimés dans l’espace source : leurs
offsets UTF-16 semi-ouverts s’appliquent directement au nœud identifié par
`segmentId`. En correction, un diagnostic dont l’objet se trouve dans un texte
produit par une correction antérieure désigne la plage source de cette
correction. Une intégration n’applique pas elle-même les champs `replacement`
des diagnostics, car cette opération contournerait l’ordre, les dépendances et
les protections du pipeline.

## Changements applicables

Chaque `TextChange` désigne un unique nœud source par `segmentId` et par
`segmentIndex`. `start` et `end` sont des offsets UTF-16 semi-ouverts dans sa
valeur initiale ; `expected` en contient la sous-chaîne exacte et sert de garde
contre une modification concurrente. Les changements sont non chevauchants et
doivent être appliqués par offsets décroissants dans chaque nœud.

`applyTextChanges` réalise cette opération pour une chaîne ou une liste de
segments. Il vérifie les bornes, `segmentId`, `expected`, l’absence de
chevauchement et la protection des segments avant de retourner de nouvelles
valeurs sans modifier les entrées.

L’application de tous les changements à leurs valeurs sources reproduit
exactement les `nodes` retournés par la même passe. `ruleIds` conserve, dans
l’ordre, la provenance des règles ayant créé puis éventuellement affiné une
même modification.

Chaque changement porte un identifiant `id`, propre au résultat ; les
diagnostics des propositions appliquées y renvoient par `changeIds`, et
`groups` réunit les propositions qui doivent être acceptées ensemble. Une
intégration qui n’accepte qu’une partie d’une passe applique des groupes
entiers, jamais des changements isolés, puis relance la passe sur le document
mis à jour ; les adaptateurs qui appliquent tout ou rien peuvent ignorer ces
champs.

Une règle peut produire une transaction couvrant plusieurs segments de la
même suite logique. Le pipeline évalue d’abord la règle contre un instantané
commun, valide toutes les plages, puis applique simultanément les éditions. Une
édition visant un segment protégé ou une plage chevauchante fait échouer la
transaction entière. Cette capacité permet notamment de supprimer un blanc à
la fin d’un nœud de mise en forme tout en insérant l’espace typographique dans
le nœud portant le signe de ponctuation.

## Diagnostics liés

`related` exprime les autres emplacements nécessaires à la compréhension d’un
diagnostic. Pour des guillemets répartis entre plusieurs nœuds, chaque défaut
d’espacement reste local au nœud qu’il faut modifier et référence l’autre
guillemet. Une intégration peut ainsi afficher une relation sans inventer une
plage continue qui engloberait des nœuds intermédiaires.

## Contrat rehype

Le futur adaptateur rehype devra :

1. parcourir l’arbre par suites de contenu en ligne appartenant au même bloc ;
2. attribuer les identifiants et appliquer une politique configurable
   d’exclusion et de protection ;
3. appeler `runTextNodePipeline` une fois par suite logique ;
4. rattacher les diagnostics aux nœuds par `segmentId` ;
5. en correction, remplacer uniquement la propriété `value` de chaque nœud ;
6. pour une correction interactive, appliquer `changes` après vérification de
   `expected`, plutôt que les remplacements des diagnostics ;
7. préserver les données de position fournies par l’analyseur, sans prétendre
   les recalculer après correction.

L’intégration Astro sera une couche de configuration au-dessus de l’adaptateur
rehype pour le contenu Markdown/MDX. Elle ne doit pas faire analyser au cœur la
syntaxe des composants ou des fichiers `.astro`.
