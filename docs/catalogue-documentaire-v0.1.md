# Orthotypography — Catalogue documentaire

**Version :** 0.1  
**Date d’établissement :** 29 août 2026  
**Statut :** premier noyau de recherche, préalable à la spécification technique  
**Périmètre :** `fr-FR`, `fr-CA`, `en-US`, `en-GB`, `de-DE`, `de-CH`

## 1. Objet et principes

Ce catalogue relie les futures règles atomiques de la bibliothèque à des autorités identifiables. Il ne cherche pas à fabriquer une « bonne typographie » universelle : il distingue la langue, la région, la marche éditoriale, le support et la force de chaque prescription.

La version 0.1 constitue un socle, pas encore un preset publiable. Une règle ne devra entrer dans un preset stable qu'après vérification de son libellé exact, de ses exceptions, de ses interactions et de ses exemples négatifs.

### 1.1 États documentaires

| État | Signification | Usage permis |
|---|---|---|
| `VERIFIED` | Prescription explicitement attestée dans une source consultée | Candidat à l'implémentation et aux tests |
| `DIVERGENT` | Plusieurs autorités ou supports proposent des traitements différents | Option atomique et presets distincts obligatoires |
| `TO_VERIFY` | Usage plausible, mais preuve ou périmètre insuffisant | Aucun comportement par défaut |
| `OUT_OF_SCOPE` | Règle grammaticale, lexicale ou de mise en page dépassant la v1 | Diagnostic éventuel ultérieur |

### 1.2 Force des transformations

| Niveau | Définition | Exemple |
|---|---|---|
| `safe` | Le contexte et la correction sont déterminables sans interprétation éditoriale notable | supprimer l'espace avant une virgule |
| `contextual` | La règle est attestée, mais son application exige une analyse contextuelle | convertir des guillemets droits en guillemets ouvrants et fermants |
| `editorial` | Plusieurs formes sont possibles ou le choix relève d'une marche | choisir les guillemets de premier niveau |
| `diagnostic-only` | Une correction automatique risquerait de modifier le sens | décider si `-` est un trait d'union ou un tiret |

## 2. Hiérarchie des sources

La force ne se déduit pas seulement du prestige d'une source. Elle dépend aussi de son domaine d'application.

1. **Norme officielle interétatique ou nationale**, dans son champ explicite.
2. **Guide d'une administration ou institution linguistique**, pour ses propres textes ou la variété qu'elle documente.
3. **Code typographique professionnel reconnu**, à condition de distinguer prescription générale et marche maison.
4. **Guide éditorial majeur**, pour le preset qui le nomme.
5. **Observation de l'usage**, utile pour documenter une variante, jamais suffisante seule pour imposer une correction.

Un guide administratif ne devient donc pas automatiquement le preset général d'une région. `en-GB/govuk`, `en-US/gpo` et `de-CH/federal` devront rester nommés comme tels.

## 3. Registre des sources

### Sources effectivement consultées

| ID | Autorité | Portée | Statut et apport |
|---|---|---|---|
| `SRC-OQLF-SPACING` | Office québécois de la langue française, « Espacement avant et après les signes de ponctuation et les symboles » | Français, principalement Québec/Canada | Source détaillée pour espaces, ponctuation, guillemets, unités, monnaies et tirets. [Consulter](https://vitrinelinguistique.oqlf.gouv.qc.ca/22039/la-typographie/espacement/espacement-avant-et-apres-les-signes-de-ponctuation-et-les-symboles) |
| `SRC-OQLF-QUOTES` | OQLF, « Généralités sur les guillemets » | Français, Québec/Canada | Guillemets français au premier niveau, espaces insécables internes et hiérarchie des citations. [Consulter](https://vitrinelinguistique.oqlf.gouv.qc.ca/23363/la-ponctuation/guillemets/generalites-sur-les-guillemets) |
| `SRC-OQLF-SPACE-TYPES` | OQLF, « Types d'espacement » | Français, Québec/Canada | Définit l'espace insécable et l'espace fine insécable ; associe cette dernière à `?`, `!` et `;`. [Consulter](https://vitrinelinguistique.oqlf.gouv.qc.ca/24565/la-typographie/espacement/types-despacement) |
| `SRC-OQLF-COLON` | OQLF, « Emplois courants du deux-points » | Français, Québec/Canada | Espace insécable avant le deux-points, espace sécable après ; minuscule normalement après. [Consulter](https://vitrinelinguistique.oqlf.gouv.qc.ca/23325/la-ponctuation/deux-points/emplois-courants-du-deux-points) |
| `SRC-OQLF-ELLIPSIS` | OQLF, « Généralités sur les points de suspension » | Français, Québec/Canada | Trois points, pas d'espace avant, espace après selon contexte, rôle de ponctuation finale. [Consulter](https://vitrinelinguistique.oqlf.gouv.qc.ca/23395/la-ponctuation/points-de-suspension/generalites-sur-les-points-de-suspension) |
| `SRC-OQLF-WEB` | OQLF, « Typographie sur le Web » | Français Web, Québec/Canada | Confirme le maintien des règles générales et des espaces insécables sur le Web. [Consulter](https://vitrinelinguistique.oqlf.gouv.qc.ca/25025/banque-de-depannage-linguistique/la-redaction-et-la-communication/redaction-pour-le-web/typographie-sur-le-web) |
| `SRC-OQLF-SOCIAL` | OQLF, « Typographie et ponctuation dans les réseaux sociaux » | Français, support contraint | Atteste une dégradation sans espaces internes aux guillemets lorsque l'insécabilité est impossible. [Consulter](https://vitrinelinguistique.oqlf.gouv.qc.ca/25377/la-redaction-et-la-communication/redaction-dans-les-reseaux-sociaux/typographie-et-ponctuation) |
| `SRC-AF-CAPS` | Académie française, « Questions de langue » | Français de France | Première source pour les capitales géographiques ; relève davantage de l'orthographe que de la microtypographie. [Consulter](https://www.academie-francaise.fr/questions-de-langue) |
| `SRC-GPO-2016` | U.S. Government Publishing Office, *Style Manual*, 2016 | Anglais américain, publications fédérales | Source officielle de marche éditoriale, non norme universelle de l'anglais américain. [Consulter](https://www.govinfo.gov/content/pkg/GPO-STYLEMANUAL-2016/pdf/GPO-STYLEMANUAL-2016.pdf) |
| `SRC-GPO-FOOTNOTES` | GPO Style Manual, chapitre 15 | Anglais américain, publications fédérales | Place les appels de note après la ponctuation, sauf le tiret ; fines entre appels consécutifs. [Consulter](https://www.govinfo.gov/content/pkg/GPO-STYLEMANUAL-2016/pdf/GPO-STYLEMANUAL-2016-17.pdf) |
| `SRC-GOVUK` | Government Digital Service, GOV.UK style guide | Anglais britannique, contenus GOV.UK | Marche Web officielle : guillemets simples dans plusieurs emplois, sentence case et ponctuation minimale des listes. [Consulter](https://www.gov.uk/guidance/style-guide/a-to-z) |
| `SRC-RFDR-2024` | Rat für deutsche Rechtschreibung, *Amtliches Regelwerk* 2024 | Allemand standard de l'ensemble de l'espace germanophone | Norme orthographique officielle, y compris ponctuation ; distingue variations nationales. [Consulter](https://www.rechtschreibrat.com/amtliche-deutsche-rechtschreibung-ueberarbeitetes-regelwerk-und-neufassung-woerterverzeichnis-fuer-schule-und-verwaltung-verbindlich/) |
| `SRC-DUDEN-RULES` | Duden, synthèse des règles de ponctuation fondée sur le règlement officiel | Allemand général | Source secondaire reconnue, avec renvois aux paragraphes officiels. [Consulter](https://www.duden.de/sprachwissen/rechtschreibregeln) |
| `SRC-DUDEN-QUOTES` | Duden, combinaison des guillemets et de la ponctuation | Allemand général | Position logique de `?`, `!` et du point relativement aux guillemets. [Consulter](https://www.duden.de/sprachwissen/sprachratgeber/Anf%C3%BChrungszeichen-Kombination-mit-anderen-Satzzeichen) |
| `SRC-CH-SCHREIB` | Chancellerie fédérale suisse, *Schreibweisungen* | Allemand de l'administration fédérale suisse | Marche fédérale couvrant signes, nombres, abréviations, notes et organisation du texte. [Consulter](https://www.bk.admin.ch/de/schreibweisungen) |
| `SRC-CH-ORTHO` | Chancellerie fédérale suisse, *Leitfaden zur deutschen Rechtschreibung* | Allemand de l'administration fédérale suisse | « Orthographe maison » explicitement applicable aux textes officiels fédéraux. [Consulter](https://www.bk.admin.ch/de/rechtschreibleitfaden) |

### Sources nécessaires mais non encore intégralement dépouillées

| ID projeté | Source | Motif |
|---|---|---|
| `SRC-IN-LEXIQUE` | *Lexique des règles typographiques en usage à l'Imprimerie nationale* | Référence professionnelle déterminante pour `fr-FR`; acquisition et vérification page par page nécessaires |
| `SRC-RAMAT` | *Le Ramat de la typographie* | Comparaison France/Canada et usages éditoriaux ; ouvrage sous droits |
| `SRC-CHICAGO` | *Chicago Manual of Style*, édition courante | Preset éditorial américain distinct de GPO ; accès sous licence |
| `SRC-MLA` | *MLA Handbook*, édition courante | Preset académique américain potentiel |
| `SRC-NEW-HART` | *New Hart's Rules*, édition courante | Source professionnelle britannique déterminante |
| `SRC-DIN-5008` | DIN 5008, édition courante | Règles de présentation et de traitement du texte allemand ; norme sous licence |
| `SRC-DUDEN-TYPO` | Ouvrage Duden consacré à la composition et à la correction | Détails typographiques dépassant le règlement orthographique |

## 4. Registre initial des règles atomiques

### 4.1 Règles transversales Unicode et espaces

| ID atomique proposé | Prescription | Applicabilité | Force | État | Sources / observations |
|---|---|---|---|---|---|
| `unicode.normalization.form` | Produire une forme Unicode choisie, NFC recommandée comme politique technique | Tous presets | `safe` en NFC ; NFKC/NFKD potentiellement destructifs | `TO_VERIFY` | Politique technique, non règle orthotypographique ; doit rester désactivable |
| `space.collapse.repeated` | Réduire les espaces sécables répétées hors zones préformatées | Prose continue | `contextual` | `TO_VERIFY` | Ne pas appliquer aux tableaux texte, poésie, alignements ou code |
| `space.before.lowPunctuation` | Aucune espace avant `.`, `,` | Six variantes | `safe` hors nombres/abréviations | `VERIFIED` pour `fr-CA`; à recouper ailleurs | `SRC-OQLF-SPACING` |
| `space.after.punctuation` | Une espace sécable après la ponctuation lorsqu'un nouveau segment suit | Six variantes | `contextual` | `VERIFIED` partiel | Exceptions : fin de bloc, ponctuation adjacente, décimales, URL, heures |
| `space.numberUnit` | Une espace insécable entre valeur et symbole d'unité | `fr-CA` | `safe` si unité reconnue | `VERIFIED` | `SRC-OQLF-SPACING`, `SRC-OQLF-WEB` ; extension aux autres variantes à documenter |
| `space.numberPercent` | Une espace insécable entre nombre et `%` | `fr-CA` | `safe` si nombre reconnu | `VERIFIED` | `SRC-OQLF-SPACING`; ne pas généraliser à l'anglais |
| `number.groupDigits` | Grouper par trois les chiffres des quantités, de part et d’autre de la virgule | `fr-FR`, extension `fr-CA` à comparer | `diagnostic-only` initialement | `VERIFIED_SEMANTICS` pour IN 2002 | `SRC-IN-LEXIQUE` ; `U+202F` est la sortie projet candidate, `U+00A0` reste accepté ; voir la [spécification](groupement-chiffres-v0.1.md) |

### 4.2 Français — ponctuation et guillemets

| ID atomique proposé | `fr-CA` | `fr-FR` | Force | État | Sources / observations |
|---|---|---|---|---|---|
| `punctuation.colon.nbsp-before` | NBSP `U+00A0` | NBSP `U+00A0` dans le preset IN 2002 | `safe` après classification | `VERIFIED_MAPPING`, `fix` | `SRC-OQLF-SPACING`, `SRC-OQLF-COLON`, `SRC-IN-LEXIQUE` ; heures, ratios et syntaxes techniques exclus |
| `punctuation.colon.space-after` | Espace sécable `U+0020` | Espace sécable `U+0020` | `safe` après classification | `VERIFIED_MAPPING`, `fix` | Exécutée séparément de l’espace précédente ; mêmes exclusions techniques ; aucune espace imposée devant un signe fermant (nº 54), une virgule ou un point (nº 59) ; points de suspension signalés sans correction |
| `punctuation.semicolon.nnbsp-before` | aucune ou fine ; fine insécable préférée en composition | Fine insécable `U+202F` dans le preset IN 2002 | `editorial` selon le preset | `VERIFIED_MAPPING`, `fix` pour IN 2002 | `SRC-OQLF-SPACING`, `SRC-OQLF-SPACE-TYPES`, `SRC-IN-LEXIQUE` |
| `punctuation.semicolon.space-after` | Espace sécable `U+0020` | Espace sécable `U+0020` | `safe` après classification | `VERIFIED_MAPPING`, `fix` | Exécutée et diagnostiquée sous son identifiant propre ; aucune espace imposée devant un signe fermant (nº 54), une virgule ou un point (nº 59) ; points de suspension signalés sans correction |
| `punctuation.question.nnbsp-before` | aucune ou fine ; fine insécable préférée en composition | Fine insécable `U+202F` dans le preset IN 2002 | `editorial` selon le preset | `VERIFIED_MAPPING`, `fix` pour IN 2002 | Suites expressives et syntaxes protégées exclues |
| `punctuation.question.space-after` | Espace sécable `U+0020` | Espace sécable `U+0020` | `safe` après classification | `VERIFIED_MAPPING`, `fix` | Exécutée séparément ; suites expressives préservées ; aucune espace imposée devant un signe fermant (nº 54), une virgule ou un point (nº 59) ; points de suspension signalés sans correction |
| `punctuation.exclamation.nnbsp-before` | aucune ou fine ; fine insécable préférée en composition | Fine insécable `U+202F` dans le preset IN 2002 | `editorial` selon le preset | `VERIFIED_MAPPING`, `fix` pour IN 2002 | Suites expressives, `!important` et syntaxes protégées exclus |
| `punctuation.exclamation.space-after` | Espace sécable `U+0020` | Espace sécable `U+0020` | `safe` après classification | `VERIFIED_MAPPING`, `fix` | Exécutée séparément ; suites expressives et `!important` préservés ; aucune espace imposée devant un signe fermant (nº 54), une virgule ou un point (nº 59) ; points de suspension signalés sans correction |
| `quotes.primary.glyphs` | `«` et `»` | `«` et `»` attendu | `contextual` | `VERIFIED` / `TO_VERIFY` | `SRC-OQLF-QUOTES`; source `fr-FR` à acquérir |
| `quotes.primary.innerSpacing` | NBSP de part et d'autre du contenu | Traditionnellement espace insécable ou fine insécable selon marche | `contextual` | `VERIFIED` / `TO_VERIFY` | `SRC-OQLF-QUOTES`; le choix du point de code doit être explicite |
| `quotes.secondary.glyphs` | doubles anglais, puis simples au niveau suivant | À documenter selon marche | `editorial` | `VERIFIED` / `TO_VERIFY` | `SRC-OQLF-QUOTES` |
| `quotes.constrained.noInnerSpacing` | Autoriser `«texte»` quand l'insécabilité est techniquement impossible | Support contraint seulement | `editorial` | `VERIFIED` | `SRC-OQLF-SOCIAL`; ne doit pas contaminer les presets Unicode/HTML normaux |
| `ellipsis.glyph` | Normaliser trois points en `…` lorsque leur fonction d'ellipse est certaine | Même candidat | `contextual` | `VERIFIED` quant à la fonction, transformation à spécifier | `SRC-OQLF-ELLIPSIS` |
| `ellipsis.spacing` | Aucune espace avant ; espace après sauf ponctuation adjacente | À confirmer | `contextual` | `VERIFIED` / `TO_VERIFY` | `SRC-OQLF-ELLIPSIS` |
| `dash.parenthetical.glyph` | Demi-cadratin `–` dans l'exemple OQLF | À déterminer selon marche | `diagnostic-only` par défaut | `VERIFIED` / `TO_VERIFY` | `SRC-OQLF-SPACING`; conversion de `-` trop ambiguë sans parseur |
| `dash.parenthetical.spacing` | Espaces autour, avec insécabilité côté contenu de l'incise | À déterminer | `contextual` | `VERIFIED` / `TO_VERIFY` | `SRC-OQLF-SPACING` |
| `apostrophe.curly` | Transformer l'apostrophe typographique certaine en `’` | Candidat identique | `contextual` | `TO_VERIFY` | Nécessite source et protection des primes, code, translittérations et élisions étrangères |

### 4.3 Anglais américain et britannique

À ce stade, les lignes suivantes définissent surtout des **presets nommés**. Elles ne doivent pas encore être promues en `en-US/general` ou `en-GB/general`.

| ID atomique proposé | `en-US/gpo` | `en-GB/govuk` | Force | État | Sources / observations |
|---|---|---|---|---|---|
| `quotes.primary.glyphs` | Doubles typographiques attendus, à relever précisément dans GPO | Simples dans les emplois explicitement couverts par GOV.UK | `editorial` | `TO_VERIFY` / `VERIFIED` partiel | `SRC-GPO-2016`, `SRC-GOVUK` |
| `quotes.innerSpacing` | Aucune espace | Aucune espace | `safe` une fois les guillemets identifiés | `TO_VERIFY` / `VERIFIED` partiel | Exemples des deux guides |
| `footnote.marker.position` | Après la ponctuation sauf le tiret ; à l'intérieur d'une parenthèse si la note ne vise que son contenu | Non établi | `editorial` | `VERIFIED` / `TO_VERIFY` | `SRC-GPO-FOOTNOTES` |
| `footnote.consecutive.spacing` | Fine entre deux appels consécutifs | Non établi | `safe` sur structure connue | `VERIFIED` / `TO_VERIFY` | `SRC-GPO-FOOTNOTES` |
| `list.fragment.finalPunctuation` | À relever | GOV.UK exclut point final et point-virgule dans ses listes à fragments | `editorial` | `TO_VERIFY` / `VERIFIED` | `SRC-GOVUK`; nécessite entrée structurée, pas texte brut |
| `title.case.system` | À distinguer selon type de titre | GOV.UK emploie largement le sentence case | `editorial` | `TO_VERIFY` / `VERIFIED` partiel | Hors correction sûre en texte brut |
| `dash.parenthetical` | Em dash ou autre traitement à relever précisément | GOV.UK recommande des dashes avec parcimonie, mais le caractère/espacement doit être relevé par rubrique | `editorial` | `TO_VERIFY` | Ne jamais convertir automatiquement un hyphen-minus isolé sans contexte |
| `ellipsis.system` | À relever dans GPO | À relever dans GOV.UK | `editorial` | `TO_VERIFY` | Opposition possible entre caractère `…` et trois points espacés/non espacés |

### 4.4 Allemand d'Allemagne et de Suisse

| ID atomique proposé | `de-DE` | `de-CH` | Force | État | Sources / observations |
|---|---|---|---|---|---|
| `orthography.sharpS` | `ß` et capitale `ẞ` selon les règles communes | `ss` dans l'usage suisse à confirmer précisément dans le guide fédéral | `contextual` | `VERIFIED` général / `TO_VERIFY` suisse | `SRC-RFDR-2024`, `SRC-CH-ORTHO`; transformation `ß`→`ss` peut altérer des noms propres |
| `quotes.primary.glyphs` | Variantes allemandes possibles (`„…“`, ou chevrons selon marche) | Chevrons suisses attendus (`«…»`), à relever | `editorial` | `TO_VERIFY` | Ne pas déduire les glyphes du seul règlement orthographique |
| `quotes.innerSpacing` | Aucune espace attendue | Aucune espace attendue | `safe` après identification | `TO_VERIFY` | Vérification directe dans sources typographiques nécessaire |
| `quotes.punctuation.logical` | `?`/`!` dedans s'ils appartiennent à la citation, dehors s'ils appartiennent à la phrase porteuse | Même socle orthographique | `contextual` | `VERIFIED` | `SRC-DUDEN-QUOTES`, fondé sur le règlement officiel |
| `dash.parenthetical.glyph` | Gedankenstrich `–` attendu | À relever dans les *Schreibweisungen* | `diagnostic-only` par défaut | `TO_VERIFY` | Usage non déductible de la seule présence de `-` |
| `punctuation.spacing.basic` | Pas d'espace avant `. , ; : ? !`, espace après lorsque le contexte l'exige | Même candidat | `safe` avec exceptions | `TO_VERIFY` | À sourcer dans le texte officiel ou DIN/guide fédéral |
| `ellipsis.system` | Trois points ou glyphe selon norme typographique à préciser | À relever | `editorial` | `TO_VERIFY` | Le règlement orthographique traite la fonction ; le point de code reste une décision de composition |

## 5. Divergences déjà établies

### 5.1 Ponctuation haute française

L'OQLF admet, devant `!`, `?` et `;`, soit aucune espace, soit une espace fine ; sa page sur les types d'espacement décrit l'espace fine comme insécable et destinée à ces signes. Cela impose au moins deux profils canadiens possibles : composition soignée avec NNBSP et texte numérique simplifié sans espace. On ne doit pas substituer mécaniquement une NBSP pleine à cette divergence.

### 5.2 Support numérique contraint

L'OQLF maintient les espaces insécables dans la rédaction Web ordinaire, mais admet `«texte»` dans certains réseaux sociaux incapables d'assurer l'insécabilité. Le support est donc une dimension de preset, et non une exception cachée dans la règle des guillemets.

### 5.3 Guillemets anglais

Le guide GOV.UK atteste l'emploi de guillemets simples dans plusieurs catégories de contenus. Les futures sources américaines et britanniques éditoriales devront déterminer les couples primaire/secondaire de chaque preset. La conversion exige une pile de citations et ne peut être réduite à un remplacement global de `'` ou `"`.

### 5.4 Allemand commun et marche suisse

Le règlement du Conseil pour l'orthographe allemande forme un socle partagé, mais la Chancellerie suisse revendique explicitement une « orthographe maison ». `de-CH/federal` doit donc étendre le socle commun au lieu de dupliquer ou de remplacer implicitement `de`.

## 6. Contextes protégés obligatoires

Les règles ci-dessus ne sont sûres que si le moteur peut protéger ou typer les segments suivants :

- URL, URI, adresses électroniques et identifiants ;
- code inline, blocs de code et contenu préformaté ;
- balises, attributs et entités HTML ;
- syntaxe Markdown ;
- nombres décimaux, heures, versions et adresses IP ;
- signes mathématiques et primes ;
- émoticônes et séquences intentionnelles de ponctuation ;
- noms propres et citations dont la graphie doit être préservée ;
- texte déjà balisé par langue (`lang`) différente ;
- espaces ayant une fonction de mise en page.

La protection de ces contextes doit précéder les règles de ponctuation. Pour HTML et Markdown, un traitement fondé sur un arbre syntaxique est préférable à des expressions régulières appliquées au document brut.

## 7. Schéma minimal d'une fiche de règle

```ts
interface DocumentaryRule {
  id: string;
  description: string;
  locales: string[];
  presets: string[];
  media: Array<"unicode" | "html" | "markdown" | "constrained-text">;
  status: "VERIFIED" | "DIVERGENT" | "TO_VERIFY" | "OUT_OF_SCOPE";
  safety: "safe" | "contextual" | "editorial" | "diagnostic-only";
  sources: Array<{
    id: string;
    locator?: string;
    accessedAt: string;
  }>;
  inputClasses: string[];
  output: string | Record<string, string>;
  exceptions: string[];
  conflictsWith: string[];
  mustRunBefore: string[];
  examples: Array<{
    input: string;
    expected: string;
    rationale: string;
  }>;
}
```

Le champ `locator` devra contenir une section, un paragraphe ou une page précise avant stabilisation. Une URL seule ne suffit pas à garantir la traçabilité à long terme.

## 8. Décisions proposées pour la suite

1. Traiter la version 0.1 comme un inventaire de recherche, non comme la définition des presets.
2. Commencer la cartographie exhaustive par `fr-FR` et `fr-CA`, car leur divergence sur les espaces déterminera une grande partie du modèle atomique.
3. Acquérir ou consulter le *Lexique de l'Imprimerie nationale* avant de figer `fr-FR`.
4. Créer des presets institutionnels explicites : `en-US/gpo`, `en-GB/govuk` et `de-CH/federal`.
5. Ne créer les presets `general` qu'après confrontation d'au moins deux autorités indépendantes par région.
6. Séparer le futur catalogue en données de source, données de règle et vecteurs de conformité.
7. Versionner les sources et enregistrer leur date de consultation : les guides Web évoluent sans nécessairement conserver leurs anciennes formulations.

## 9. Prochain lot documentaire recommandé

Le lot 0.2 devrait produire :

- un relevé page/section complet des espaces et guillemets français ;
- une table comparative `fr-FR` / `fr-CA` portant sur `: ; ? ! « » % unités monnaies nombres tirets` ;
- les cas d'exception correspondants ;
- 5 à 10 vecteurs de test par règle ;
- une qualification séparée `fix`, `lint` ou `manual-review` ;
- une première analyse des conflits et de l'ordre d'exécution.

Ce lot permettra ensuite de spécifier un premier preset sans étendre prématurément la recherche aux capitales, titres d'œuvres, bibliographies ou règles grammaticales.
