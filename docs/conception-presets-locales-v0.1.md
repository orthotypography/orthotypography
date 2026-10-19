# Conception — presets compilés et correspondance des locales v0.1

Statut : décisions validées le 19 octobre 2026 ; issues
[nº 23](https://github.com/orthotypography/orthotypography/issues/23) et
[nº 24](https://github.com/orthotypography/orthotypography/issues/24), étape 4
de la [revue d’architecture](revue-architecture-v0.1.md).

## 1. Objet

Faire du catalogue la seule source des presets et de leurs modes par règle, et
supprimer les passes vides silencieuses causées par une comparaison exacte des
locales. Le contrat des règles et celui des résultats
([conception des résultats](conception-resultats-v0.1.md)) ne changent pas ;
les modes `fix`, `lint`, `review` et le mode par défaut gardent leur sens.

## 2. État actuel

- `IMPRIMERIE_NATIONALE_RULES` est assemblé à la main dans
  `src/rules/presets.ts`. Aucun test ne le compare au preset
  `fr-FR/imprimerie-nationale-2002` du catalogue ; ils coïncident aujourd’hui,
  sauf `punctuation.period.space-after`, règle seulement documentaire.
- `PresetRuleSelection.mode` n’est jamais lu. Le preset `fr-CA/oqlf` place le
  point-virgule, le point d’interrogation et le point d’exclamation en `lint`,
  alors que leurs règles sont en `fix` dans le catalogue ; aucune composition
  exécutable ne l’applique, bien que toutes ses règles déclarent `fr-CA`.
- `manual-review` se comporte déjà comme `lint` à l’exécution (seul `fix`
  applique), sans que ce soit documenté.
- Les locales sont comparées à l’identique : `fr`, `fr-fr` ou `fr-BE` donnent
  une passe vide, `appliedRuleIds: []`, sans erreur ni signalement.

## 3. Décisions

1. **`manual-review` se comporte comme `lint`.** Ses propositions ne sont pas
   appliquées dans le mode par défaut ; elles le sont en `fix` et en `review`
   explicites, où elles reçoivent l’indication `suggested: "review"`. La
   distinction reste documentaire : `lint` signale une correction facultative,
   `manual-review` une décision humaine nécessaire.
2. **Le mode `fix` explicite applique toutes les règles**, comme aujourd’hui.
   Les modes par règle d’un preset valent pour le mode par défaut et donnent les
   indications `suggested` du mode `review`.
3. **Les exports actuels sont dérivés du preset compilé.**
   `IMPRIMERIE_NATIONALE_RULES` devient le résultat de
   `compilePreset("fr-FR/imprimerie-nationale-2002")` ; un test garantit sa
   correspondance avec le catalogue.
4. **Une locale non prise en charge est une erreur, et le résultat liste les
   règles ignorées.** La casse est normalisée (`fr-fr` devient `fr-FR`) ; aucun
   repli régional implicite (`fr-BE` n’hérite pas de `fr-FR`) ; une passe dont
   aucune règle ne prend en charge la locale lève une erreur ; les règles
   ignorées pour cause de locale figurent dans `skippedRuleIds`.

## 4. Registre et compilation

```ts
/** Règles exécutables livrées, par identifiant, dans l’ordre d’exécution canonique. */
export const EXECUTABLE_RULES: ReadonlyMap<string, RuntimeRule>;

export interface CompilePresetOptions {
  /** Modes remplaçant ceux du preset, par identifiant de règle du preset. */
  readonly modes?: Readonly<Record<string, RuleMode>>;
}

export function compilePreset(
  presetId: string,
  options?: CompilePresetOptions,
): readonly RuntimeRule[];
```

- Le registre réunit toutes les règles exécutables livrées. Son ordre est
  l’ordre canonique d’exécution au sein d’une phase : celui de l’actuel
  `IMPRIMERIE_NATIONALE_RULES`, suivi des règles hors preset (glyphe et espace
  initiale des points de suspension, groupement des chiffres). Un preset est
  une sélection, non un ordre : `compilePreset` suit l’ordre du registre, puis
  `compilePipeline` ordonne par phase et dépendances comme aujourd’hui. Les
  sorties d’`IMPRIMERIE_NATIONALE_RULES` restent ainsi identiques.
- Chaque règle retenue reçoit le mode du preset, ou celui d’`options.modes`, à
  la place du mode par défaut du catalogue ; le reste de la règle est inchangé.
  La passe n’a rien d’autre à connaître : le mode par défaut et les indications
  du mode `review` lisent déjà `defaultMode`.
- Une règle du preset absente du registre est documentaire et n’est pas
  compilée (aujourd’hui seulement `punctuation.period.space-after`). Un test
  fixe la liste de ces règles pour chaque preset : toute règle qui disparaît du
  registre, ou toute nouvelle règle documentaire, le fait échouer.
- `compilePreset` refuse un preset inconnu, un mode remplaçant une règle hors
  du preset, et une règle exécutable qui ne prend pas en charge la locale du
  preset.
- `compilePreset("fr-CA/oqlf")` produit une composition exécutable pour le
  Québec, avec ses modes `lint`. Le preset garde son statut `CANDIDATE`.
- `IMPRIMERIE_NATIONALE_PUNCTUATION_RULES`, qui n’est pas un preset du
  catalogue, reste une composition de commodité assemblée à la main.

## 5. Modes à l’exécution

| Mode de la règle | Mode par défaut         | `fix` explicite | `review`                       | `lint` |
| ---------------- | ----------------------- | --------------- | ------------------------------ | ------ |
| `fix`            | appliquée               | appliquée       | appliquée, `suggested: apply`  | non    |
| `lint`           | propositions rapportées | appliquée       | appliquée, `suggested: review` | non    |
| `manual-review`  | propositions rapportées | appliquée       | appliquée, `suggested: review` | non    |

Le mode de la règle est celui du preset compilé, ou à défaut celui du
catalogue.

## 6. Locales

- La locale demandée est normalisée par `Intl.getCanonicalLocales`, disponible
  dans les navigateurs, Deno, Node.js et JavaScriptCore ; une étiquette
  invalide lève une erreur. Les locales du catalogue sont déjà canoniques, ce
  que vérifie la validation du catalogue.
- Une règle s’applique si sa liste de locales contient la locale normalisée.
  Aucun repli n’est déduit : une locale régionale n’hérite pas d’une autre, et
  une langue seule (`fr`) ne choisit pas de région.
- `PipelineResult.skippedRuleIds` et `TextNodePipelineResult.skippedRuleIds`
  listent, dans l’ordre d’exécution, les règles ignorées pour cause de locale.
- Si la composition contient des règles et qu’aucune ne prend en charge la
  locale, la passe lève une erreur au lieu de rendre le texte inchangé.
- `ruleLocaleSupport(rules, locale)` donne, sans exécuter la passe, la locale
  normalisée et les règles prises en charge ou ignorées. Un hôte qui traite un
  document multilingue l’interroge avant chaque suite logique et passe les
  suites dans une langue non prise en charge, au lieu d’attraper l’erreur.

## 7. Conséquences pour les intégrations

- Les compositions existantes donnent les mêmes sorties pour `fr-FR`.
- Une suite logique dans une locale non prise en charge, qui rendait auparavant
  le texte inchangé, lève désormais une erreur. Le SDK et les adaptateurs
  doivent passer ces suites, au moyen de `ruleLocaleSupport`, et peuvent
  utiliser `compilePreset` pour choisir un preset et ses modes.
- `fr-fr` et les autres casses non canoniques fonctionnent désormais.
- Ces changements rejoignent la ligne `0.2` et la feuille de route des
  intégrations, avec la conception des résultats.

## 8. Vérifications

Tests du registre et de la compilation (correspondance avec le catalogue,
règles documentaires, modes, refus), des locales (casse, locale régionale non
prise en charge, langue seule, erreur, `skippedRuleIds`, `ruleLocaleSupport`)
et des presets compilés en mode par défaut et en `review` ; comparaison
complète avec `main` pour `fr-FR`, qui doit être identique hormis
`skippedRuleIds` ; `deno task bench --scaling`.

## 9. Hors champ

- La validation documentaire du preset québécois et de ses sources.
- L’intégration des règles hors preset (points de suspension, groupement des
  chiffres) dans un preset : décision typographique distincte.
- Les codes d’erreur et de message, qui relèvent de
  l’[issue nº 27](https://github.com/orthotypography/orthotypography/issues/27)
  et remplaceront les messages des erreurs introduites ici.
