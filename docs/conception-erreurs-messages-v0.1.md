# Conception — erreurs typées et messages codés v0.1

Statut : décisions validées le 19 octobre 2026 ;
[issue nº 27](https://github.com/orthotypography/orthotypography/issues/27),
étape 5 de la [revue d’architecture](revue-architecture-v0.1.md), avec la
[conception des résultats](conception-resultats-v0.1.md).

## 1. Objet

Rendre les erreurs et les diagnostics exploitables par les éditeurs et les
interfaces : distinguer une erreur de l’appelant d’un défaut interne, et
permettre aux hôtes (SDK, application macOS) d’afficher des messages dans leur
langue sans analyser des phrases anglaises.

## 2. État actuel

- Les 51 erreurs levées par le cœur sont des `Error` ordinaires, distinguées
  seulement par leur texte anglais.
- Les diagnostics portent un `message` anglais écrit dans chaque règle ; une
  interface française ne peut que le traduire mot à mot.

## 3. Décisions

1. **Une classe, des codes.** Toute erreur levée par le cœur est une
   `OrthotypographyError`, sous-classe d’`Error`, qui porte un `code` stable,
   une `category` et des `details`. Le texte anglais de `message` est conservé
   tel quel.
2. **Codes et paramètres, rendu anglais seulement.** Chaque diagnostic porte
   `messageId` et `messageArgs` ; `message` reste le rendu anglais par défaut.
   Le cœur ne livre pas de traductions : la liste des messages, avec leur
   gabarit anglais, est exportée et documentée, et chaque hôte la traduit.
3. **Code facultatif pour les règles externes.** Une règle fournit
   `messageId` et `messageArgs` ; à défaut, le pipeline prend l’identifiant de
   la règle et des paramètres vides. Les règles existantes restent valides.

## 4. Erreurs

```ts
type ErrorCategory = "input" | "stale-change" | "rule-contract" | "internal";

class OrthotypographyError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly details: Readonly<Record<string, string | number>>;
}
```

`ERROR_CODES` associe chaque code à sa catégorie :

| Catégorie       | Codes                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input`         | `INVALID_SEGMENT_ID`, `INVALID_LOCALE`, `UNSUPPORTED_LOCALE`, `INVALID_DISMISSED_PROPOSAL`, `INVALID_RULE`, `UNKNOWN_RULE_ID`, `DUPLICATE_RULE`, `MISSING_DEPENDENCY`, `BACKWARD_DEPENDENCY`, `DEPENDENCY_CYCLE`, `UNKNOWN_PRESET`, `INVALID_PRESET_OVERRIDE`, `INVALID_CHANGE`                       |
| `stale-change`  | `STALE_CHANGE`                                                                                                                                                                                                                                                                                                |
| `rule-contract` | `INVALID_EDIT_RANGE`, `OVERLAPPING_EDITS`, `PROTECTED_TEXT_EDIT`, `INVALID_DIAGNOSTIC`, `INVALID_ANNOTATION`, `TRANSFORM_AND_PROTECT`                                                                                                                                                                       |
| `internal`      | `CATALOGUE_INCONSISTENCY`, `INTERNAL_INVARIANT`                                                                                                                                                                                                                                                              |

- `input` : la composition ou les données fournies par l’appelant sont
  invalides ; l’appelant peut corriger son appel.
- `stale-change` : un changement ne correspond plus au document
  (`expected` différent) ; l’hôte relance la passe sur le document à jour.
- `rule-contract` : une règle a renvoyé un résultat contraire au contrat ;
  `details.ruleId` désigne la règle fautive.
- `internal` : incohérence du catalogue livré ou invariant du pipeline violé ;
  c’est un défaut du cœur, à signaler.

Les tests vérifient les codes et non plus les textes.

## 5. Messages des diagnostics

```ts
interface RunDiagnostic {
  readonly messageId?: string;
  readonly messageArgs?: Readonly<Record<string, string>>;
}

interface RuleDiagnostic {
  readonly messageId: string;
  readonly messageArgs: Readonly<Record<string, string>>;
}

const DIAGNOSTIC_MESSAGES: Readonly<Record<string, string>>;
function formatDiagnosticMessage(
  id: string,
  args?: Readonly<Record<string, string>>,
): string;
```

`DIAGNOSTIC_MESSAGES` associe chaque identifiant à son gabarit anglais, dont
les paramètres s’écrivent `{nom}`. Les règles livrées tirent `message` du
gabarit, si bien que le texte anglais reste identique :

| Identifiant                     | Paramètres | Règles                                                  |
| ------------------------------- | ---------- | ------------------------------------------------------- |
| `spacing.no-space-before`       | `mark`     | `punctuation.comma.no-space-before`, `punctuation.period.no-space-before` |
| `spacing.missing-before`        | `mark`, `space` | espace absente avant `:`, `;`, `?`, `!`             |
| `spacing.wrong-before`          | `mark`, `space` | espace d’une autre nature avant ces signes          |
| `spacing.excess-before`         | `mark`, `space` | blanc plus long que l’espace attendue avant ces signes |
| `spacing.missing-after`         | `mark`, `space` | espace absente après ces signes                     |
| `spacing.wrong-after`           | `mark`, `space` | espace d’une autre nature après ces signes          |
| `spacing.excess-after`          | `mark`, `space` | blanc plus long que l’espace attendue après ces signes |
| `spacing.trailing-after`        | `mark`     | blanc après ces signes en fin de texte                   |
| `spacing.space-after.ellipsis`  | `mark`     | mêmes règles, devant des points de suspension            |
| `spacing.comma.space-after`     | —          | `punctuation.comma.space-after`                          |
| `quotes.french.inner-space`     | —          | `quotes.french.nbsp-inner`                               |
| `number.percent.space`          | —          | `number.percent.nbsp-before`                             |
| `number.unit.space`             | —          | `number.unit.nbsp-before`                                |
| `number.euro.position`          | —          | `number.euro.nbsp-before`                                |
| `number.euro.position.attached` | —          | `number.euro.nbsp-before`, symbole collé (nº 36)         |
| `number.digits.grouping`        | —          | `number.digits.grouping`                                 |
| `ellipsis.after-etc`            | —          | `punctuation.ellipsis.after-etc.forbidden`               |
| `ellipsis.glyph`                | `function` | `punctuation.ellipsis.glyph`                             |
| `ellipsis.initial.space-after`  | —          | `punctuation.ellipsis.initial.space-after`               |

Les espaces des ponctuations hautes distinguent trois défauts, avant et après
le signe ([issue nº 79](https://github.com/orthotypography/orthotypography/issues/79)) :
l’espace manque, elle est d’une autre nature (une espace-mot au lieu d’une
espace fine insécable, par exemple), ou le blanc est plus long que l’espace
attendue. Le blanc examiné réunit celui du nœud du signe et celui des nœuds
voisins que la proposition retire. Le paramètre `space` désigne l’espace
attendue par son point de code (`U+00A0`, `U+202F` ou `U+0020`), qu’un hôte
traduit sans dépendre du texte anglais. En fin de texte, aucune espace n’est
attendue après le signe : `spacing.trailing-after` signale le blanc restant.
Jusqu’à `0.2.0-alpha.1`, un seul identifiant par côté
(`spacing.space-before`, `spacing.space-after`) couvrait les trois cas, avec un
texte anglais qui parlait d’un blanc inattendu même quand l’espace manquait.

## 6. Conséquences pour les intégrations

- Les messages des erreurs et des diagnostics ne changent pas ; les nouveaux
  champs sont additifs.
- Les hôtes affichent leurs propres textes à partir de `messageId` et
  `messageArgs`, et traitent les erreurs selon leur `category` : corriger
  l’appel, relancer la passe après `STALE_CHANGE`, signaler une règle fautive
  ou un défaut du cœur.

## 7. Vérifications

Tests des codes de toutes les erreurs atteignables, de la cohérence entre
`message`, `messageId`, `messageArgs` et `DIAGNOSTIC_MESSAGES` sur le corpus et
les entrées générées, du repli pour les règles externes ; comparaison complète
avec `main`, identique hormis les nouveaux champs ;
`deno task bench --scaling`.
