# Changelog — 23/08/2026

## ✅ 1. SerpApi (vols) — vérifié, aucun filtre restrictif

`functions/api/live.js`, fonction `callSerp()` (l'appel Google Flights réel, bouton ⚡) :
aucun `include_airlines` / `exclude_airlines` / `airline_stop` n'est envoyé. Les seuls
paramètres sont engine, departure_id, arrival_id, dates, type, currency, hl, gl,
deep_search, show_hidden, sort_by, api_key. Rien ne bloque les low-cost type Volotea
côté filtre — c'est bien le `deep_search`+`show_hidden`+`sort_by` déjà en place qui gère
ce problème (rien à corriger ici).

## 🐛 2. Corrigé — "Directs par aéroport" vide pour Brest

**Cause réelle** : ce mode filtrait `transfers===0` sur la liste "moins cher tout court"
(direct+correspondance mélangés, `direct=false`). Sur un petit aéroport comme Brest, la
correspondance est presque toujours moins chère qu'un vol direct → le résultat "unique"
par destination est presque toujours une correspondance → plus aucune ligne à `transfers===0`
à afficher, alors que des vols directs existent réellement en cache Travelpayouts.
Nantes, aéroport plus gros, a plus souvent un direct qui EST le moins cher → ça marchait.

**Fix** : `functions/api/anywhere.js` accepte maintenant `&direct=1` et le transmet à
Travelpayouts. `renderCompare()` (mode "Directs par aéroport") fait une requête dédiée
avec ce paramètre au lieu de filtrer la liste mélangée. Résultat : Brest doit maintenant
remonter ses vraies lignes directes (ex. vers Paris, Marseille…).

## ➕ 3. Ajouté — Kayak + Booking à côté de Skyscanner, partout

Nouvelle fonction `cmpLinksHtml()` réutilisée dans les 4 endroits où un lien de recherche
existait : Ma sélection, Comparer (mode ville verrouillée / directs par aéroport / meilleur
par ville), Croisé (par étape voyageur), Séjour. Aviasales était déjà là via Travelpayouts
(`c.link`) mais seulement en mode Comparer — il est maintenant affiché à côté des autres
partout où il est connu.

- **Skyscanner** : schéma d'URL confirmé (déjà utilisé, repris tel quel).
- **Kayak** : schéma d'URL confirmé (`kayak.fr/flights/ORIG-DEST/date[/date-retour]`).
- **Booking Vols** : ⚠️ Booking ne documente pas publiquement de schéma d'URL de
  pré-remplissage (contrairement aux deux autres). Le lien généré est une estimation
  raisonnable — **à tester** ; si ça n'ouvre pas la bonne recherche, dis-le-moi et
  j'ajusterai les noms de paramètres.

## 🐛 4. Corrigé — voiture : le lien ne correspondait pas au prix affiché

**Cause réelle** : `carCard()` (chaque résultat avec loueur réel, ex. "Dollar", prix réel
138,71 €) affichait quand même un lien générique "Chercher sur DiscoverCars (dates à
ressaisir)", qui renvoie vers un AUTRE comparateur avec d'autres prix. L'API
(`functions/api/cars.js`, Booking via RapidAPI) renvoie pourtant déjà un lien direct
par offre (`forward_url`) — il n'était juste jamais utilisé.

**Fix** : chaque carte utilise maintenant ce lien réel quand il existe → "Réserver chez
{loueur} · {prix} →" ouvre directement CETTE offre (même loueur, même prix, pré-rempli).
Le lien DiscoverCars générique ne sert plus que de repli quand l'API n'a rien renvoyé.

## ➕ 5. Ajouté — Rentalcars.com à la place du lien Google

Le bouton "Comparer d'autres loueurs →" pointait vers une recherche Google classique
(pas une agence). Il pointe maintenant vers Rentalcars.com (groupe Booking Holdings),
pré-rempli avec la ville et les dates. ⚠️ Même réserve que Booking Vols : le schéma
d'URL de pré-remplissage de Rentalcars n'est pas documenté publiquement, ces paramètres
sont une estimation raisonnable — à tester.

## Pas encore fait

- Marqueurs d'affiliation (DiscoverCars, Rentalcars, tp.media…) : toujours vides dans
  le code (`DISCOVERCARS_MARKER` etc.) — à remplir quand tu auras tes identifiants.
- Aucune clé/API ajoutée ou modifiée : `SERP_TOKEN`, `TP_TOKEN`, `RAPIDAPI_KEY` etc.
  restent tels quels côté Cloudflare.

---

# Round 2 — même session, suite à ton retour de test

## 🐛 6. Corrigé — liens Kayak/Aviasales/Booking illisibles (Séjour, Croisé, Ma sélection)

**Cause réelle trouvée** (pas une supposition) : la règle CSS `.cmplinks .cgo` ne
définissait que `margin-top`/`font-size` — pas la couleur ni le soulignement. Ces liens
héritaient donc leur style de `.cmpcard .cgo` (mode Comparer uniquement, `color:amber`),
qui ne s'applique QUE dans le mode Comparer. Ailleurs (Ma sélection, Croisé, Séjour, tous
en dehors de `.cmpcard`), aucune règle ne s'appliquait → retour au bleu souligné par
défaut du navigateur, illisible sur fond sombre. `.cmplinks .cgo` est maintenant
autonome (couleur + soulignement inclus), donc cohérent partout.

## 🐛 7. Corrigé — lien voiture "mort" (forward_url Booking/RapidAPI)

Confirmé par ton test : le lien par offre (`c.url`, renvoyé par l'API Booking via
RapidAPI) ne s'ouvre pas correctement en pratique — probablement un lien de session qui
expire avant que tu cliques. Retiré. Chaque carte affiche maintenant DEUX liens fixes :
le **site officiel du loueur** quand il est reconnu (Hertz, Europcar, Sixt, Avis,
Budget, Enterprise, National, Alamo, Dollar, Thrifty, Firefly, Goldcar, Interrent,
Keddy, OK Mobility, Record Go, Centauro, Green Motion, Payless, Fox — liste dans
`VENDOR_SITES`), et **DiscoverCars** (pré-rempli, déjà fiable) à côté. Pas de
pré-remplissage garanti sur le site du loueur (chaque loueur a son propre système),
mais le lien s'ouvre toujours vraiment, contrairement à l'ancien.

## ➕ 8. Ajouté — "📅 dates flexibles" dans les 4 modes

Le calendrier de prix par jour existait déjà (mode Ma sélection, tape sur une
destination). Il est maintenant accessible partout : un bouton "📅 dates flexibles"
a été ajouté dans `cmpLinksHtml()` — donc automatiquement dans Ma sélection, Comparer,
Croisé et Séjour, sans dupliquer le code. `openPriceCal()` accepte maintenant un aéroport
de départ explicite (avant : uniquement l'origine globale), donc ça fonctionne même
pour un trajet secondaire (ex. Nantes dans une carte Comparer alors que ton origine
globale est Brest).

---

# Round 3 — suite à ton 2e retour de test

## ➕ 9. Ajouté — Rentalcars sur chaque vignette voiture

Chaque carte affiche maintenant 3 liens : loueur officiel (si reconnu) + DiscoverCars
+ Rentalcars, tous les trois pré-remplis avec la même ville/dates que la recherche.

## ➕ 10. Amélioré — calendrier "dates flexibles" : transparence sur les données rares

**Pas un bug à proprement parler, mais un vrai problème réel.** Ce calendrier vient du
cache Travelpayouts (recherches passées d'autres personnes), pas d'un scan en direct
comme Kayak. Sur une route peu recherchée (petit aéroport, destination moins courante),
le cache est mécaniquement clairsemé — c'est une histoire de source de données, pas
un filtre trop strict à corriger. Rien de comparable en gratuit à l'échelle de Kayak
sans consommer massivement le quota SerpApi (250/mois pour toute l'app — remplir un
mois entier en direct viderait le quota en une poignée de calendriers ouverts).

Ce que j'ai fait à la place : quand il y a peu ou pas de prix en cache, un message
l'explique clairement (au lieu d'une grille presque vide sans explication) + un lien
"Voir un calendrier complet sur Kayak →" pour cette route précise, pour que tu aies
la vue complète en un tap quand le cache ne suffit pas.

## ❓ 11. Pas résolu — bouton "prix live" absent en Séjour

J'ai relu le code en détail (template de carte, CSS `.dest`/`.live`/`.go`, la fonction
`syncButtons()`, le filtre `applyStopsListDom()`, et surtout le mécanisme qui active
`LIVE_OK`) : structurellement tout est correct, et `renderDispatch()` relance bien
`renderStay()` dès que le statut "prix live" est confirmé disponible. Je ne trouve pas
de défaut de code qui ferait disparaître ce bouton précisément en Séjour — et je n'ai
touché à aucune de ces parties cette session, donc si c'est réel, ce n'est probablement
pas quelque chose que j'ai cassé aujourd'hui.

Piste la plus probable : `LIVE_OK` démarre à `false` et ne passe à `true` qu'après une
vérification en tâche de fond au chargement de la page — si tu arrives sur Séjour très
vite après ouverture de l'appli, ce premier rendu peut se faire avant que la vérification
soit revenue, et ça devrait se corriger tout seul juste après. Est-ce que ça persiste
même après un rechargement complet de la page (pas juste changer d'onglet et revenir) ?
Et est-ce que le bouton ⚡ fonctionne au même moment sur Ma sélection/Comparer ?


