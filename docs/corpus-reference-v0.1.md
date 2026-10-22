# Corpus de référence v0.1

Statut : outillage et domaine technique en place le 20 octobre 2026, prose
narrative et dialogues ajoutés le 22 octobre ; domaine administratif en
attente des actes officiels ;
[issue nº 83](https://github.com/orthotypography/orthotypography/issues/83),
préalable à l’extension du catalogue par lots retenue dans la
[feuille de route](roadmap.md) (audit du cœur, constat R2).

## 1. Objet

Mesurer les faux positifs du preset `fr-FR/imprimerie-nationale-2002` sur un
corpus écrit indépendamment des règles, plus large que les corpus de
non-régression de `tests/fixtures/corpus/` (2 075 caractères). Deux critères :

- **critère permanent** : aucune proposition sur le texte attendu, sauf les
  lacunes documentées dans `known-gaps.json` ;
- **mesure** : sur les textes bruts, nombre de diagnostics, distance au texte
  attendu avant et après correction, paragraphes rétablis et paragraphes
  dégradés.

Le corpus sert aussi de critère d’admission au preset pour les lots de règles
(feuille de route, tâche 3) : une règle candidate ne doit faire aucune
proposition sur le texte attendu.

## 2. Domaines et sources

| Fichier | Domaine | Source | Licence |
| --- | --- | --- | --- |
| `technique.txt` | texte technique : URL, chemins, versions, code, heures, unités | rédigé pour le projet | MIT |
| `prose.txt` | prose narrative | Maupassant, *Boule de suif*, début (jusqu’au départ de la diligence), édition Project Gutenberg nº 10746 d’après Ollendorff, 1907 | domaine public ; en-tête et licence Gutenberg retirés |
| `dialogues.txt` | dialogues et citations | Maupassant, *La Parure*, texte complet, *Contes du jour et de la nuit*, Marpon et Flammarion, 1885, transcription Wikisource | domaine public ; transcription sous CC BY-SA 4.0 |
| à venir | nombres et administration | actes officiels publiés sur Légifrance | actes non protégés par le droit d’auteur ; données de la DILA sous Licence Ouverte |

Visé : 30 000 à 50 000 caractères au total, soit environ 10 000 par domaine.
Les extraits du domaine public sont fournis par le responsable du projet, faute
d’accès verbatim à ces sites depuis l’environnement de l’agent ; le domaine
technique, sans source naturelle, est rédigé. `sources.json` consigne pour
chaque fichier l’URL, la date de consultation, la licence et l’état de la
relecture.

## 3. Texte attendu

Le texte attendu est composé à la main selon le *Lexique*, indépendamment de
ce que le cœur sait faire :

- espaces du tableau de la ponctuation : `U+00A0` avant le deux-points et à
  l’intérieur des guillemets, `U+202F` avant le point-virgule, le point
  d’interrogation et le point d’exclamation ;
- `U+2026` pour les points de suspension (transposition du projet,
  [dépouillement](depouillement-lexique-v0.3.md), § 5.4) ;
- groupement des chiffres par `U+202F` et `U+00A0` entre un nombre et le
  symbole d’unité, de pourcentage ou de monnaie ;
- `U+00A0` entre un nombre en chiffres et le nom qui le précède ou le suit,
  que le *Lexique* interdit de séparer en fin de ligne (rubrique Coupure :
  « 300/kilomètres », « 11 h/30 ») ;
- apostrophe typographique `U+2019`, ligatures (`œ`) et capitales accentuées
  (`À`) ;
- `U+00A0` entre une abréviation de civilité et le nom qui la suit
  (« Mme Loisel »), que le *Lexique* interdit de séparer (rubrique Coupure :
  « M./et Mme/Durand ») ;
- tiret d’incise et de dialogue en demi-cadratin `U+2013`, entouré d’espaces
  justifiantes (tableau Tiret) ;
- syntaxe technique laissée telle quelle ; le code en ligne figure entre
  accents graves et forme des segments protégés.

Pour les textes d’auteur, l’orthographe et la ponctuation de l’édition sont
conservées : le *Lexique* exclut de modifier la ponctuation des œuvres
(rubrique Ponctuation). Seule la composition est normalisée (espaces, glyphes,
ligatures, capitales accentuées), et les fautes manifestes de transcription
sont corrigées et signalées à la relecture.

Les écarts du cœur sont de deux natures : une proposition sur le texte attendu
(faux positif, à corriger ou à documenter) et une correction absente sur le
texte brut (règle non implémentée, hors preset ou en `lint`), qui n’est pas une
erreur du corpus.

## 4. Textes bruts

Le texte brut n’est pas rédigé : il est dérivé du texte attendu par des
conventions de saisie au clavier, fixées à l’avance et indépendantes des
règles :

- variante `spaced` : les espaces insécables deviennent des espaces-mots,
  `…` devient `...` et l’apostrophe `’` devient `'` ;
- variante `compact` : comme `spaced`, mais sans les espaces que la saisie
  courante omet avant `;`, `:`, `?`, `!` et `»`, et après `«`.

Le code protégé n’est pas modifié. La dérivation conserve un lien exact entre
brut et attendu, si bien que la distance mesurée ne dépend que des corrections
du cœur.

## 5. Mesure

`deno task corpus:reference` affiche, par fichier et par variante :

| Colonne | Contenu |
| --- | --- |
| On expected (gaps) | diagnostics sur le texte attendu, dans le mode par défaut de chaque règle, dont lacunes documentées |
| Diagnostics | diagnostics sur le texte brut, en mode `fix` |
| Distance before / after | caractères insérés ou supprimés pour passer du brut, puis du brut corrigé, au texte attendu |
| Restored | paragraphes dont la correction rétablit exactement le texte attendu |
| Worsened | paragraphes que la correction éloigne du texte attendu |

La commande échoue si une proposition sur le texte attendu n’est pas
documentée ; `tests/reference_corpus_test.ts` vérifie la même chose, ainsi que
l’absence de lacune périmée.

Relevé du 22 octobre 2026 :

| Fichier | Caractères | Sur l’attendu | Distance `spaced` | Distance `compact` | Paragraphes dégradés |
| --- | ---: | ---: | --- | --- | ---: |
| `prose.txt` | 12 227 | 0 | 304 → 218 | 261 → 218 | 0 |
| `dialogues.txt` | 16 197 | 7, documentées | 586 → 412 | 499 → 412 | 0 |
| `technique.txt` | 6 756 | 0 | 244 → 168 | 213 → 168 | 0 |

Sur la prose, le reste tient entièrement à l’apostrophe, que le cœur ne
convertit pas. Sur les dialogues, il tient à l’apostrophe, au glyphe des points
de suspension (règle hors preset) et à l’espace insécable après « Mme ». Les
sept propositions sur le texte attendu sont des signalements sans correction
de l’espace entre un point d’exclamation et des points de suspension (`!…`),
que la source ne prescrit pas (exception `suspension-points`, garde-fou) ;
elles figurent dans `known-gaps.json`. Sur le texte technique, il tient aussi aux règles hors preset ou
en `lint` (groupement des chiffres, espace avant les unités, glyphe des points
de suspension) et à l’espace insécable entre nombre et nom, non implémentée.

## 6. Relecture

Le texte attendu fait foi : il est relu à la main avant fusion, fichier par
fichier, et `reviewed` passe à `true` dans `sources.json`. Une divergence entre
le cœur et le texte attendu se tranche en revenant au *Lexique*, jamais en
alignant le texte sur le cœur.
