# Feuille de route du cœur

État vérifié le 19 octobre 2026 sur
[`4e440e5`](https://github.com/orthotypography/orthotypography/commit/4e440e5),
`main` après la [PR nº 67](https://github.com/orthotypography/orthotypography/pull/67).
La version `0.2.0-alpha.0` est préparée par la
[PR nº 68](https://github.com/orthotypography/orthotypography/pull/68), non encore publiée ; la dernière version publiée reste `0.1.0-alpha.3`. Ce document sert
de passation ; les prochaines tâches sont proposées et ne constituent pas une
promesse de release.

## État acquis

| Chantier                | État vérifié                                                                                                                               | Preuve                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Distribution JavaScript | Dernière version publiée : alpha `0.1.0-alpha.3`, le 26 septembre 2026 sur JSR et npm, sous le tag npm `latest`. `0.2.0-alpha.0` préparée (manifeste, `CHANGELOG`, README), non publiée | [Release](https://github.com/orthotypography/orthotypography/releases/tag/v0.1.0-alpha.3), [manifeste](../deno.json), [CHANGELOG](../CHANGELOG.md) |
| Catalogue documentaire  | Modèle de règles, autorités et deux presets français candidats ; prescriptions d’espacement après ponctuation représentées par des identifiants autonomes ; locales canoniques vérifiées | [Catalogue](catalogue-documentaire-v0.1.md), [matrice](matrice-couverture-in-2002-v0.1.md) |
| Exécution sur la suite logique | Chaque règle s’exécute une fois par passe sur la suite logique traversant les nœuds (`RuntimeRule.apply(run)`), métadonnées tirées du catalogue, constructions numériques partagées par annotations ; croissance linéaire mesurée par `deno task bench --scaling` | [Conception](conception-suite-logique-v0.1.md), PR [nº 41](https://github.com/orthotypography/orthotypography/pull/41) à [nº 50](https://github.com/orthotypography/orthotypography/pull/50) |
| Résultats               | Modifications portées par les diagnostics, emplacements toujours sources, identifiants de changements, groupes de propositions, mode `review` et propositions écartées ; journal des changements linéaire | [Conception](conception-resultats-v0.1.md), PR [nº 38](https://github.com/orthotypography/orthotypography/pull/38), [nº 52](https://github.com/orthotypography/orthotypography/pull/52), [nº 53](https://github.com/orthotypography/orthotypography/pull/53), [nº 55](https://github.com/orthotypography/orthotypography/pull/55) à [nº 57](https://github.com/orthotypography/orthotypography/pull/57) |
| Presets et locales      | `compilePreset` compile les presets du catalogue avec leurs modes ; `IMPRIMERIE_NATIONALE_RULES` en est dérivé ; locales canonisées, sans repli, passe sans règle applicable refusée, `skippedRuleIds` et `ruleLocaleSupport` | [Conception](conception-presets-locales-v0.1.md), [PR nº 62](https://github.com/orthotypography/orthotypography/pull/62) |
| Erreurs et messages     | `OrthotypographyError` avec `code`, `category` et `details` ; diagnostics porteurs de `messageId` et `messageArgs`, gabarits anglais exportés dans `DIAGNOSTIC_MESSAGES` | [Conception](conception-erreurs-messages-v0.1.md), [PR nº 65](https://github.com/orthotypography/orthotypography/pull/65) |
| Changements localisés   | `TextChange` et `applyTextChanges` avec contrôles du texte attendu, des segments, des bornes UTF-16, des chevauchements et des protections | [Contrat](integration-contract-v0.1.md), [implémentation](../src/changes.ts)                                           |
| Registres               | Unités et monnaies documentées ; leur présence ne signifie pas que toutes les corrections sont activées par défaut                         | [Unités](registre-unites-v0.7.md), [monnaies](registre-monnaies-v0.7.md)                                               |
| Matrice de couverture   | Prescriptions du dépouillement reliées au catalogue, à l’exécution, aux tests, aux exclusions et au preset IN 2002 ; vérifiée le 19 octobre 2026 | [Matrice](matrice-couverture-in-2002-v0.1.md)                                                                          |
| Groupement des chiffres | Prescription historique et transposition Unicode spécifiées ; premier lint candidat limité aux quantités déjà classifiées, hors preset et sans correction | [Spécification](groupement-chiffres-v0.1.md), [matrice](matrice-couverture-in-2002-v0.1.md) |
| Ponctuation haute       | Règles d’espace avant et après exécutées et diagnostiquées sous huit identifiants atomiques ; aucune espace imposée devant un signe fermant, une virgule ou un point ; blanc correct d’un nœud voisin laissé en place | [Catalogue](../src/catalogue/rules.ts), [tests](../tests/closing_signs_test.ts), [matrice](matrice-couverture-in-2002-v0.1.md) |
| Points de suspension    | Quatre règles atomiques cataloguées ; correction du glyphe des formes finales ou initiales certaines et espace après `…` initiale structurelle, hors preset, publiées dans `0.1.0-alpha.3` | [Conception](points-de-suspension-v0.1.md), [tests](../tests/ellipsis_initial_spacing_test.ts), [matrice](matrice-couverture-in-2002-v0.1.md) |
| Validation              | 250 tests hors ligne sur `4e440e5` : invariants sur entrées générées, instantanés d’un corpus, découpage de textes corrigés à chaque position ; contrôles JSR et npm exécutés par la CI de chaque PR touchant le paquet. Aucune validation dans un éditeur réel pour la ligne `0.2` | [Tests](../tests/), [mesures](performances-v0.1.md) |

Le cœur reste indépendant des parseurs Markdown/HTML et des API d'éditeurs. Les
adaptateurs et leur avancement sont suivis dans la
[feuille de route des intégrations](https://github.com/orthotypography/orthotypography-integrations/blob/main/docs/roadmap.md).

La [PR nº 9](https://github.com/orthotypography/orthotypography/pull/9), fusionnée, conserve les vérifications Deno sur chaque PR et
chaque push vers `main`, mais limite les contrôles de paquets JSR et npm aux
changements du cœur, du manifeste, des scripts et des workflows de publication
ou de CI. Elle permet aussi une exécution manuelle complète, parallélise les
contrôles de paquets avec les tests et annule les exécutions de PR dépassées.
Le workflow de publication garde tous ses contrôles sur le tag de release.

### Version `0.2.0-alpha.0` préparée

Cette préversion ouvre la ligne `0.2`, qui rompt la compatibilité avec
`0.1.0-alpha.3` : interface des règles sur la suite logique, contrat des
résultats, presets compilés et locales, erreurs typées et messages codés. Elle
réunit les étapes 1 à 5 de la [revue d’architecture](revue-architecture-v0.1.md)
(issues [nº 19](https://github.com/orthotypography/orthotypography/issues/19) à
[nº 21](https://github.com/orthotypography/orthotypography/issues/21) et
[nº 23](https://github.com/orthotypography/orthotypography/issues/23) à
[nº 27](https://github.com/orthotypography/orthotypography/issues/27), closes),
ainsi que les corrections des anomalies
[nº 30](https://github.com/orthotypography/orthotypography/issues/30),
[nº 31](https://github.com/orthotypography/orthotypography/issues/31),
[nº 32](https://github.com/orthotypography/orthotypography/issues/32),
[nº 36](https://github.com/orthotypography/orthotypography/issues/36),
[nº 54](https://github.com/orthotypography/orthotypography/issues/54),
[nº 59](https://github.com/orthotypography/orthotypography/issues/59),
[nº 63](https://github.com/orthotypography/orthotypography/issues/63) et
[nº 66](https://github.com/orthotypography/orthotypography/issues/66). Les
sorties des règles intégrées sont inchangées hors de ces corrections ; le
[`CHANGELOG`](../CHANGELOG.md) détaille les ruptures. Le numéro de préversion
laisse aux intégrations le temps d’adopter ce contrat et de le valider dans les
éditeurs avant une version `0.2.0`.

Sa publication suit [`RELEASING.md`](../RELEASING.md) et attend une
autorisation explicite ; la fusion de la PR de préparation ne l’autorise pas.

La version `0.1.0-alpha.3` réunissait les PR fusionnées depuis
`0.1.0-alpha.2`, dont la publication npm de confiance sans jeton
([nº 14](https://github.com/orthotypography/orthotypography/pull/14)) et la
publication de toute version `0.x` sous le tag npm `latest`
([nº 17](https://github.com/orthotypography/orthotypography/pull/17)). La
version npm porte une attestation de provenance émise par la publication de
confiance.

Les intégrations publiées dépendent du cœur `0.1.0-alpha.3`. Leur
développement suit des commits précis de la ligne `0.2` ; le passage au cœur
`0.2` publié et la validation réelle dans Google Docs sont suivis dans la
[feuille de route des intégrations](https://github.com/orthotypography/orthotypography-integrations/blob/main/docs/roadmap.md).

## Prochaines tâches proposées

1. **Publication de `0.2.0-alpha.0` et adoption par les intégrations.**
   Publier sur instruction explicite, vérifier la présence de la version sur
   JSR et npm et le tag `latest`, puis consigner la publication ici. Les
   intégrations passent alors du commit de développement au cœur publié ; leurs
   retours, y compris ceux de la validation réelle dans Google Docs, décident
   des ajustements avant `0.2.0`. Toute rupture supplémentaire doit être
   regroupée avant `0.2.0`.
2. **Fin de la consolidation de l’architecture.** Restent ouvertes l’issue
   [nº 22](https://github.com/orthotypography/orthotypography/issues/22)
   (partage de la classification des points de suspension et `dependsOn`
   portant sur des types d’annotations ; la classification numérique est déjà
   partagée) et l’issue
   [nº 28](https://github.com/orthotypography/orthotypography/issues/28)
   (matrice générée à partir de données structurées). Ni l’une ni l’autre ne
   change les sorties attendues ; la nº 22 peut modifier l’interface publique
   des règles et doit donc être tranchée avant `0.2.0`.

3. **Cohérence documentaire et linguistique.** Auditer les textes hors de
   `docs/`, traduire leur prose en anglais et actualiser les instructions
   devenues obsolètes. `CONTRIBUTING.md` et `RELEASING.md` sont traités dans
   les PR [nº 15](https://github.com/orthotypography/orthotypography/pull/15) et [nº 14](https://github.com/orthotypography/orthotypography/pull/14) ; reste à décider si les
   descriptions françaises de `src/catalogue/rules.ts` relèvent des données ou
   de la prose à traduire. Conserver les données
   linguistiques nécessaires aux règles et aux tests. Terminé lorsque les
   fichiers concernés respectent `AGENTS.md` et que les commandes documentées
   correspondent au manifeste courant.
4. **Matrice de couverture.** Première version achevée dans
   [`matrice-couverture-in-2002-v0.1.md`](matrice-couverture-in-2002-v0.1.md),
   vérifiée de nouveau le 19 octobre 2026 pour la préparation de
   `0.2.0-alpha.0`. La maintenir à chaque ajout de catalogue,
   d’exécution, de test ou de preset.
   Sa génération à partir de données structurées est proposée dans
   l’issue [nº 28](https://github.com/orthotypography/orthotypography/issues/28).
5. **Extension atomique des règles.** Le modèle révisé de l’issue
   [nº 21](https://github.com/orthotypography/orthotypography/issues/21) est
   en place ; reprise après l’issue [nº 22](https://github.com/orthotypography/orthotypography/issues/22), afin d’écrire les nouvelles règles
   avec les annotations partagées. L’interdiction des points de suspension
   après `etc.` et `space.after.comma` ont été fusionnées dans les PR
   [nº 2](https://github.com/orthotypography/orthotypography/pull/2) et
   [nº 3](https://github.com/orthotypography/orthotypography/pull/3). Les
   prescriptions suivant le point et la ponctuation haute ont reçu des
   identifiants documentaires autonomes dans la
   [PR nº 4](https://github.com/orthotypography/orthotypography/pull/4). La
   [conception des points de suspension](points-de-suspension-v0.1.md), fusionnée
   dans la [PR nº 5](https://github.com/orthotypography/orthotypography/pull/5),
   fixe le choix de glyphe, les fonctions d’espacement, les protections et le
   découpage recommandé, sans ajouter de comportement exécutable. La
   [spécification du groupement des chiffres](groupement-chiffres-v0.1.md),
   fusionnée dans la
   [PR nº 6](https://github.com/orthotypography/orthotypography/pull/6),
   stabilise ensuite la transposition Unicode et borne un premier lint aux
   mesures, pourcentages et monnaies classifiés. La règle reste hors preset,
   sans correction automatique ; les quantités autonomes et les autres règles
   numériques demeurent exclues. La PR
   [nº 7](https://github.com/orthotypography/orthotypography/pull/7) atomise
   ensuite l’exécution des espaces suivant les quatre signes de ponctuation
   haute sous leurs identifiants documentaires propres. Elle conserve l’ordre,
   les protections et les sorties du preset ; seule la provenance des
   diagnostics et des changements est affinée. La
   [PR nº 8](https://github.com/orthotypography/orthotypography/pull/8)
   a catalogué le glyphe et les trois fonctions d’espacement des points de
   suspension. Cette première tranche reconnaissait les deux représentations
   et diagnostiquait seulement les trois points ASCII de fonction finale ou
   initiale certaine, sans corriger le glyphe ni les espaces.
   La [PR nº 10](https://github.com/orthotypography/orthotypography/pull/10)
   a fusionné la tranche H : correction atomique `...` → `…` pour les fonctions
   `final` et `initial` certaines, en mode explicite `fix`. Le mode par défaut
   reste `lint` et l’export de reconnaissance demeure un alias du même objet.
   La [PR nº 11](https://github.com/orthotypography/orthotypography/pull/11)
   a ensuite fusionné la tranche I : `punctuation.ellipsis.initial.space-after`
   diagnostique par défaut l’absence d’espace après `…` au début structurel
   certain, puis insère `U+0020` en mode `fix` explicite. Ces deux règles
   restent hors du preset ; elles sont publiées dans `0.1.0-alpha.3`. `...Suite` demeure
   exclu par le classificateur actuel. La règle
   `punctuation.ellipsis.final.no-space-before` reste documentaire : les
   ellipses finales certaines sont déjà collées à la lettre précédente,
   tandis que `Alors ...` n’a pas de fonction établie.
6. **Stabilité du contrat d'intégration.** Les issues [nº 26](https://github.com/orthotypography/orthotypography/issues/26) et
   [nº 27](https://github.com/orthotypography/orthotypography/issues/27), closes, en ont été le premier chantier ; les anomalies
   [nº 63](https://github.com/orthotypography/orthotypography/issues/63) et
   [nº 66](https://github.com/orthotypography/orthotypography/issues/66), remontées par les intégrations, sont corrigées. Examiner les besoins remontés par les
   adaptateurs sans transférer leurs contraintes natives dans le cœur. Toute
   évolution publique doit avoir des tests de contrat et une stratégie explicite
   de compatibilité et de versionnement.

## Pilotage et passation

Le chat Core porte les décisions typographiques et le contrat du moteur. La
coordination arbitre les dépendances et les publications avec les intégrations.
Chaque réalisation reçoit une issue délimitée : objectif, source, périmètre,
critères d'acceptation, validations et dépendances. Ajouter ici les liens vers
les issues et PR lorsqu'elles existent, sans inventer de numéro.

Après une fusion ou une publication, actualiser l'état et ses preuves. Une PR
fusionnée, une CI réussie et une version disponible dans les registres sont des
étapes distinctes. Les fichiers `AGENTS.md` portent les consignes stables ;
cette feuille porte l'état et les prochaines décisions.
