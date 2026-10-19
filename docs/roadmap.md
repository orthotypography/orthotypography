# Feuille de route du cœur

État vérifié le 26 septembre 2026 sur
[`7905702`](https://github.com/orthotypography/orthotypography/commit/7905702e1a56ec3b0130504b766835896ce48c49),
commit publié sous `0.1.0-alpha.3`. Ce document sert de passation ; les prochaines
tâches sont proposées et ne constituent pas une promesse de release.

## État acquis

| Chantier                | État vérifié                                                                                                                               | Preuve                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Distribution JavaScript | Alpha publique `0.1.0-alpha.3`, publiée le 26 septembre 2026 sur JSR et npm, sous le tag npm `latest` | [Release](https://github.com/orthotypography/orthotypography/releases/tag/v0.1.0-alpha.3), [manifeste](../deno.json) |
| Catalogue documentaire  | Modèle de règles, autorités et deux presets français candidats ; prescriptions d’espacement après ponctuation représentées par des identifiants autonomes | [Catalogue](catalogue-documentaire-v0.1.md), [matrice](matrice-couverture-in-2002-v0.1.md) |
| Normalisation           | Pipeline, classification numérique, ponctuation exécutable et traitement de suites textuelles traversant les nœuds                         | [README](../README.md), [architecture](architecture-v0.4.md)                                                           |
| Changements localisés   | `TextChange` et `applyTextChanges` avec contrôles du texte attendu, des segments, des bornes UTF-16, des chevauchements et des protections | [Contrat](integration-contract-v0.1.md), [implémentation](../src/changes.ts)                                           |
| Registres               | Unités et monnaies documentées ; leur présence ne signifie pas que toutes les corrections sont activées par défaut                         | [Unités](registre-unites-v0.7.md), [monnaies](registre-monnaies-v0.7.md)                                               |
| Matrice de couverture   | Prescriptions du dépouillement reliées au catalogue, à l’exécution, aux tests, aux exclusions et au preset IN 2002                   | [Matrice](matrice-couverture-in-2002-v0.1.md)                                                                          |
| Groupement des chiffres | Prescription historique et transposition Unicode spécifiées ; premier lint candidat limité aux quantités déjà classifiées, hors preset et sans correction | [Spécification](groupement-chiffres-v0.1.md), [matrice](matrice-couverture-in-2002-v0.1.md) |
| Ponctuation haute       | Règles d’espace avant et après exécutées et diagnostiquées sous huit identifiants atomiques, à sortie inchangée ; tranche fusionnée dans la PR nº 7 | [Catalogue](../src/catalogue/rules.ts), [tests](../tests/high_punctuation_atomicity_test.ts), [matrice](matrice-couverture-in-2002-v0.1.md) |
| Points de suspension    | Quatre règles atomiques cataloguées ; reconnaissance interne de `U+2026` et de trois `U+002E`, correction du glyphe des formes finales ou initiales certaines (PR nº 10) et espace après `…` initiale structurelle (PR nº 11), tous deux hors preset | [Conception](points-de-suspension-v0.1.md), [tests](../tests/ellipsis_initial_spacing_test.ts), [matrice](matrice-couverture-in-2002-v0.1.md) |
| Validation de release   | 151 tests, contrôles JSR et npm répétés au tag par le workflow de publication, puis présence de la version sur les deux registres et tag npm `latest` vérifiés | [Workflow de publication](https://github.com/orthotypography/orthotypography/actions/runs/36237577147) |

Le cœur reste indépendant des parseurs Markdown/HTML et des API d'éditeurs. Les
adaptateurs et leur avancement sont suivis dans la
[feuille de route des intégrations](https://github.com/orthotypography/orthotypography-integrations/blob/main/docs/roadmap.md).

La [PR nº 9](https://github.com/orthotypography/orthotypography/pull/9), fusionnée, conserve les vérifications Deno sur chaque PR et
chaque push vers `main`, mais limite les contrôles de paquets JSR et npm aux
changements du cœur, du manifeste, des scripts et des workflows de publication
ou de CI. Elle permet aussi une exécution manuelle complète, parallélise les
contrôles de paquets avec les tests et annule les exécutions de PR dépassées.
Le workflow de publication garde tous ses contrôles sur le tag de release.

La version `0.1.0-alpha.3` réunit les PR fusionnées depuis `0.1.0-alpha.2`,
dont la préparation de release : renommage de `number.digits.grouping`
([nº 13](https://github.com/orthotypography/orthotypography/pull/13)), publication npm de confiance sans jeton ([nº 14](https://github.com/orthotypography/orthotypography/pull/14)),
guide de contribution ([nº 15](https://github.com/orthotypography/orthotypography/pull/15)), version, `CHANGELOG` et matrice
([nº 16](https://github.com/orthotypography/orthotypography/pull/16)), puis publication de toute version `0.x` sous le tag npm
`latest`, vérifié en fin de workflow ([nº 17](https://github.com/orthotypography/orthotypography/pull/17)). La version npm porte une
attestation de provenance émise par la publication de confiance. Aucun essai
dans un éditeur n’accompagne cette publication.

Les intégrations dépendent encore de versions antérieures du cœur ; leur montée
vers `0.1.0-alpha.3` est suivie dans la
[feuille de route des intégrations](https://github.com/orthotypography/orthotypography-integrations/blob/main/docs/roadmap.md).

## Prochaines tâches proposées

1. **Consolidation de l’architecture.** La
   [revue d’architecture](revue-architecture-v0.1.md) du 26 septembre 2026
   ouvre les issues [nº 19](https://github.com/orthotypography/orthotypography/issues/19) à [nº 28](https://github.com/orthotypography/orthotypography/issues/28). Ordre proposé : filet de
   tests et mesure de performance ([nº 19](https://github.com/orthotypography/orthotypography/issues/19)), journal des changements
   linéaire ([nº 20](https://github.com/orthotypography/orthotypography/issues/20)), vue de la suite logique, annotations typées et
   séparation des définitions ([nº 21](https://github.com/orthotypography/orthotypography/issues/21), [nº 22](https://github.com/orthotypography/orthotypography/issues/22),
   [nº 25](https://github.com/orthotypography/orthotypography/issues/25)), presets compilés et locales ([nº 23](https://github.com/orthotypography/orthotypography/issues/23),
   [nº 24](https://github.com/orthotypography/orthotypography/issues/24)), diagnostics porteurs de corrections, erreurs et messages
   codés ([nº 26](https://github.com/orthotypography/orthotypography/issues/26), [nº 27](https://github.com/orthotypography/orthotypography/issues/27) ; la nº 26 fait l’objet d’une [conception](conception-resultats-v0.1.md) à valider), matrice générée ([nº 28](https://github.com/orthotypography/orthotypography/issues/28)).
   Les ruptures d’API sont à regrouper dans une ligne `0.2` coordonnée avec les
   intégrations ; la [conception de l’exécution sur la suite logique](conception-suite-logique-v0.1.md)
   fixe le contrat commun aux issues nº 21, 22 et 25 ; ses étapes 1 à 4 sont achevées (PR [nº 41](https://github.com/orthotypography/orthotypography/pull/41), [nº 43](https://github.com/orthotypography/orthotypography/pull/43), [nº 45](https://github.com/orthotypography/orthotypography/pull/45), [nº 47](https://github.com/orthotypography/orthotypography/pull/47), [nº 48](https://github.com/orthotypography/orthotypography/pull/48), [nº 49](https://github.com/orthotypography/orthotypography/pull/49) et [nº 50](https://github.com/orthotypography/orthotypography/pull/50)) ; l’interface publique des règles change en conséquence pour la ligne `0.2`, que les intégrations devront adopter, et `deno task bench --scaling` vérifie que la croissance reste linéaire ; la version `0.2.0` suivra les étapes 3 et 5 de la revue. Le
   filet de tests ([nº 19](https://github.com/orthotypography/orthotypography/issues/19)) est proposé dans la [PR nº 33](https://github.com/orthotypography/orthotypography/pull/33) :
   invariants sur entrées générées, instantanés d’un corpus et
   [mesures de référence](performances-v0.1.md). Il a révélé les anomalies
   [nº 30](https://github.com/orthotypography/orthotypography/issues/30), [nº 31](https://github.com/orthotypography/orthotypography/issues/31) et [nº 32](https://github.com/orthotypography/orthotypography/issues/32), à corriger avant les
   refontes.
2. **Cohérence documentaire et linguistique.** Auditer les textes hors de
   `docs/`, traduire leur prose en anglais et actualiser les instructions
   devenues obsolètes. `CONTRIBUTING.md` et `RELEASING.md` sont traités dans
   les PR [nº 15](https://github.com/orthotypography/orthotypography/pull/15) et [nº 14](https://github.com/orthotypography/orthotypography/pull/14) ; reste à décider si les
   descriptions françaises de `src/catalogue/rules.ts` relèvent des données ou
   de la prose à traduire. Conserver les données
   linguistiques nécessaires aux règles et aux tests. Terminé lorsque les
   fichiers concernés respectent `AGENTS.md` et que les commandes documentées
   correspondent au manifeste courant.
3. **Matrice de couverture.** Première version achevée dans
   [`matrice-couverture-in-2002-v0.1.md`](matrice-couverture-in-2002-v0.1.md).
   Son en-tête et ses sections sur les points de suspension sont synchronisés
   dans la [PR nº 16](https://github.com/orthotypography/orthotypography/pull/16). La maintenir à chaque ajout de catalogue,
   d’exécution, de test ou de preset.
   Sa génération à partir de données structurées est proposée dans
   l’issue [nº 28](https://github.com/orthotypography/orthotypography/issues/28).
4. **Extension atomique des règles.** Reprise après les issues
   [nº 21](https://github.com/orthotypography/orthotypography/issues/21) et [nº 22](https://github.com/orthotypography/orthotypography/issues/22), afin d’écrire les nouvelles règles dans le
   modèle révisé. L’interdiction des points de suspension
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
5. **Stabilité du contrat d'intégration.** Les issues [nº 26](https://github.com/orthotypography/orthotypography/issues/26) et
   [nº 27](https://github.com/orthotypography/orthotypography/issues/27) en sont le premier chantier. Examiner les besoins remontés par les
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
