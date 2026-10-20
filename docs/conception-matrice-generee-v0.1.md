# Conception — matrice de couverture générée v0.1

Statut : décisions validées le 19 octobre 2026 ;
[issue nº 28](https://github.com/orthotypography/orthotypography/issues/28),
étape 6 de la [revue d’architecture](revue-architecture-v0.1.md).

## 1. Objet

Ne plus tenir à la main le tableau de la
[matrice de couverture](matrice-couverture-in-2002-v0.1.md) : le produire à
partir du catalogue, du preset compilé et de déclarations portées par les tests,
et faire échouer la vérification du dépôt lorsqu’il est périmé. La prose
explicative de la matrice reste rédigée à la main.

## 2. État actuel

- Le tableau de la matrice (32 lignes) a été resynchronisé à la main dans les
  PR [nº 12](https://github.com/orthotypography/orthotypography/pull/12),
  [nº 16](https://github.com/orthotypography/orthotypography/pull/16),
  [nº 58](https://github.com/orthotypography/orthotypography/pull/58),
  [nº 60](https://github.com/orthotypography/orthotypography/pull/60),
  [nº 61](https://github.com/orthotypography/orthotypography/pull/61) et
  [nº 69](https://github.com/orthotypography/orthotypography/pull/69). La
  dernière vérification a encore corrigé des mentions « non publiée » périmées
  depuis `0.1.0-alpha.3`.
- `RuleDefinition.exceptions` est une liste de phrases, en français pour onze
  fiches et en anglais pour douze ; aucun test n’y est relié.
- Onze lignes de la matrice décrivent des prescriptions du
  [dépouillement](depouillement-lexique-v0.3.md) sans fiche propre : huit n’ont
  aucune fiche (glyphes des guillemets, trois prescriptions sur les tirets,
  séparateur décimal, trois sur les symboles d’unités), trois sont rattachées à
  la fiche d’une autre prescription (`percent.glyph`, `currency.euro.position`,
  `number.noGrouping.ordinal`).
- Les tests ne déclarent pas les règles ni les exceptions qu’ils couvrent ; la
  colonne « Tests directs » est relevée à la main.

## 3. Décisions

1. **Les exceptions deviennent des objets `{ id, description }`.**
   L’identifiant est stable, en minuscules séparées par des tirets
   (`decimal-separator`) ; la description est en anglais, conformément à
   `AGENTS.md`. Le changement de type de `RuleDefinition.exceptions` est une
   rupture de l’export `./catalogue`, regroupée dans la ligne `0.2` avant
   `0.2.0` ; aucun consommateur connu, ni dans le cœur ni dans les intégrations,
   ne lit ce champ.
2. **Les tests déclarent ce qu’ils couvrent.** Un utilitaire
   `covers(ruleId, exceptionIds?)` est appelé dans chaque test concerné ; le
   générateur relève statiquement ces appels, et un test échoue si une exception
   d’une règle exécutable n’est couverte par aucun test.
3. **Les données propres à la matrice vivent sous `docs/`.** Un fichier
   `docs/data/matrice-in-2002.json` porte les prescriptions du dépouillement, la
   fiche qui les représente, les libellés français des exceptions et le travail
   restant. Un script génère le tableau entre deux marqueurs du Markdown ;
   `deno task check` échoue s’il est périmé. Le paquet publié ne change pas.

## 4. Exceptions structurées

```ts
interface RuleException {
  /** Identifiant stable dans la fiche, en kebab-case. */
  readonly id: string;
  readonly description: string;
  /** Exception assurée hors du cœur, par l’intégration ou l’hôte. */
  readonly scope?: "integration" | "review";
}

interface RuleDefinition {
  // …
  readonly exceptions: readonly RuleException[];
}
```

- Les identifiants sont partagés entre fiches quand le sens est le même :
  `protected-content` (aujourd’hui « syntaxe protégée » ou « protected
  content »), `technical-syntax`, `end-of-text`, `closing-sign`… La validation du
  catalogue vérifie leur forme et leur unicité dans une fiche.
- `scope: "integration"` marque une exception que le cœur ne peut pas tester,
  parce qu’elle relève de l’hôte : « support contraint » (police ou éditeur qui
  ne rend pas `U+202F`), « entrée structurée par l’intégration ». Ces exceptions
  sont exemptées de l’exigence de couverture.
- `scope: "review"` marque un cas que la règle ne détecte pas et qu’une
  personne tranche, pour une règle qui signale sans corriger par défaut :
  « citation d’une autre convention » pour l’euro. Ces cas sont exemptés de la
  même façon (décision du 19 octobre 2026, à l’implémentation).
- L’exigence de couverture a révélé quatre exceptions sans objet, retirées à
  l’implémentation : « séparateur décimal » pour l’absence de blanc avant la
  virgule, « abréviation », « numéro de version » et « adresse IP » pour
  l’absence de blanc avant le point. Les règles suppriment le blanc dans tous
  ces cas, ce qui est la prescription ; les constructions numériques restent
  protégées par la classification.
- `protected-content` est couverte par les invariants du pipeline, qui
  vérifient la préservation des segments protégés pour chaque composition ; ils
  déclarent `covers` pour chaque règle exécutable.

## 5. Déclarations de couverture

```ts
// tests/support/coverage.ts
export function covers(
  ruleId: string,
  exceptionIds: readonly string[] = [],
): void;
```

- L’appel figure dans le corps du test, avec des arguments littéraux, pour que
  le générateur le relève sans exécuter les tests. À l’exécution, il vérifie que
  la règle et les exceptions existent au catalogue et lève une erreur sinon ;
  une faute de frappe fait donc échouer le test.
- Un test sans exception déclarée couvre le comportement nominal de la règle.
- Un test de cohérence vérifie que chaque règle exécutable est couverte, et que
  chacune de ses exceptions hors `scope: "integration"` l’est aussi. Les fiches
  documentaires, sans règle exécutable, en sont exemptées.

## 6. Données de la matrice

`docs/data/matrice-in-2002.json`, une entrée par ligne, dans l’ordre du
tableau :

```json
{
  "prescription": "space.before.comma",
  "rule": "punctuation.comma.no-space-before",
  "execution": "`SAFE_PUNCTUATION_RULES` : `fix`",
  "remaining": "décimales et syntaxe technique protégées par classification"
}
```

- `rule` est absent pour une prescription sans fiche, qui fournit alors
  `catalogue`, `execution`, `tests` et `preset` en texte libre.
- Une prescription rattachée à la fiche d’une autre garde `rule` et fournit
  `catalogue` (par exemple « résultat agrégé dans `number.euro.nbsp-before` ») ;
  les autres colonnes viennent de la fiche liée, sauf texte libre explicite.
- `exceptionLabels` donne, une fois pour tout le fichier, le libellé français
  de chaque identifiant d’exception ; le générateur échoue si une exception
  d’une fiche liée n’a pas de libellé.
- Le texte libre est en français : le fichier est une donnée documentaire
  sous `docs/`.

## 7. Génération et vérification

- `scripts/coverage_matrix.ts` lit le catalogue, `compilePreset`, les
  déclarations `covers` des tests et le fichier de données, puis écrit le
  tableau entre `<!-- matrice:début -->` et `<!-- matrice:fin -->`.
- Colonnes produites pour une ligne liée à une fiche :

| Colonne | Source |
| --- | --- |
| Prescription atomique | fichier de données |
| Catalogue machine | identifiant de la fiche, vérifié au catalogue |
| Exécution sur `main` | texte du fichier de données ; la présence dans `EXECUTABLE_RULES` est vérifiée |
| Tests directs | fichiers de test qui déclarent `covers` pour la règle |
| Preset IN 2002 | sélection et mode dans `compilePreset("fr-FR/imprimerie-nationale-2002")` |
| Exclusions ou travail restant | libellés des exceptions de la fiche, puis `remaining` |

- `deno task matrix` écrit le tableau ; `deno task matrix:check` compare le
  tableau régénéré au fichier et échoue s’il diffère. `deno task check` appelle
  `matrix:check`, donc la CI échoue quand le tableau est périmé.
- En-tête de la matrice : la date de vérification et la base examinée restent
  rédigées à la main, comme la prose des sections 3 et 4.

## 8. Mise en œuvre

Une seule PR, après la fusion de cette note :

1. exceptions structurées dans les 23 fiches, avec identifiants partagés et
   descriptions anglaises, et validation du catalogue ;
2. `covers` dans les tests existants, et test de cohérence de la couverture ;
3. fichier de données, script, tâches et marqueurs ; le tableau régénéré doit
   être identique au tableau actuel, sauf la colonne « Tests directs », qui
   reflète les déclarations, et les libellés d’exceptions harmonisés.

## 9. Hors champ

- La traduction des descriptions françaises des fiches (`description`), qui
  relève de la tâche de cohérence linguistique de la
  [feuille de route](roadmap.md) ; seules les exceptions sont traitées ici.
- Une matrice pour le preset québécois.
- Les annotations partagées de
  l’[issue nº 22](https://github.com/orthotypography/orthotypography/issues/22),
  indépendantes ; la nouvelle fiche `classify.ellipsis-candidates` y recevra
  des exceptions structurées.
