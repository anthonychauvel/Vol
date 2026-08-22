# Escale — installation

Guide pas à pas. Compte le faire une seule fois.

Deux sources de prix cohabitent :

| | Source | Coût | Fraîcheur | Déclenchement |
|---|---|---|---|---|
| **Prix de base** | Travelpayouts (cache Aviasales) | gratuit, illimité | 2 à 7 jours | automatique |
| **Prix live ⚡** | Google Flights (SerpApi, puis SearchApi en relais) | 250 + 100 rech./mois gratuites | temps réel | sur appui du bouton seulement |

Le premier est **obligatoire**, le second est **facultatif** : sans clé SerpApi,
l'app masque simplement les boutons ⚡ et tout le reste fonctionne comme avant.
Quand le quota SerpApi arrive à 249/250, l'app **bascule seule** sur le relais
SearchApi.io ; les deux épuisés, elle revient au cache Aviasales sans rien casser.

---

# Partie 1 — Prix de base (Travelpayouts) — obligatoire

## 1. Le bon produit Travelpayouts (ne pas se tromper)

| Ce que tu vois | À quoi ça sert | Pour toi ? |
|---|---|---|
| **API de données** (Data API) | Récupérer des prix en cache pour ton site/app | ✅ **OUI, c'est celui-ci** |
| Marque blanche (White Label) | Un site de résa clé en main, tout fait | ❌ non |
| API de liens (partner links) | Transformer des liens en liens affiliés monétisés | ❌ non (outil perso) |
| API de recherche (Search API, temps réel) | Métamoteur temps réel — exige 50 000 visiteurs/mois + validation | ❌ non |

**Tu n'utilises que l'API de données.** Elle est en accès libre : pas de seuil de trafic, pas de demande à envoyer.

## 2. Récupérer le token

1. Crée un compte gratuit sur **travelpayouts.com**.
2. Si besoin, connecte le **programme Aviasales** dans ton tableau de bord (onglet Programmes / Programs) — c'est ce qui alimente les données de vols.
3. Va dans **Profil ▸ Jeton API** (Profile ▸ API token).
4. **Copie le token** (une courte chaîne, ex. `d3c81d4b9…`).

Le même token marche pour les quatre fonctions de base (prix, calendrier, n'importe où, villes).

## 3. Brancher le token sur Cloudflare (jamais dans le code)

1. Dashboard **Cloudflare Pages** ▸ ton projet ▸ **Settings**.
2. **Variables and Secrets** ▸ **Add**.
3. Name : `TP_TOKEN` — Value : ton token — coche **Encrypt** (pour en faire un secret).
4. **Save**, puis **redéploie** (Deployments ▸ Retry deployment, ou pousse un commit).

Le token reste côté serveur, jamais exposé dans le navigateur.

## 4. Vérifier

Ouvre `https://ton-site.pages.dev/api/prices?origin=NTE&destination=DUB&depart=2026-03-06&return=2026-03-08`
- Tu dois voir un JSON avec un `price`.
- Si `TP_TOKEN non configuré` → le secret n'est pas posé (ou pas redéployé).
- Si `price: null` → pas de tarif en cache pour cette route/période (normal sur routes rares) : essaie une grande route (NTE→BCN) pour tester.

---

# Partie 2 — Prix live ⚡ — facultatif

Le comparatif complet des API de tarifs est dans **PRIX-LIVE-API.md**.
L'app enchaîne **deux fournisseurs gratuits**, puis retombe sur le cache :

```
1. SerpApi       Google Flights   250 recherches/mois   ← par défaut
2. SearchApi.io  Google Flights   100 requêtes/mois     ← relais automatique
3. épuisé        → prix du cache Aviasales uniquement (rien ne casse)
```

## 1. Récupérer les clés

- **serpapi.com** — compte gratuit, plan Free par défaut, clé visible sur le dashboard.
- **searchapi.io** — compte gratuit (facultatif, c'est le relais).

## 2. Brancher les clés

Cloudflare Pages ▸ Settings ▸ **Variables and Secrets** :

| Name | Value | Obligatoire |
|---|---|---|
| `SERP_TOKEN` | clé SerpApi — **Encrypt ✔** | pour le live |
| `SEARCHAPI_TOKEN` | clé SearchApi.io — **Encrypt ✔** | non (relais) |
| `SERP_BUDGET` | seuil de bascule, défaut `249` | non |
| `SEARCHAPI_BUDGET` | seuil de bascule, défaut `99` | non |
| `LIVE_TTL` | cache résultat en secondes, défaut `21600` (6 h) | non |

Redéploie après chaque ajout.

## 3. Le compteur — c'est le vrai, pas une estimation

SerpApi expose `account.json`, **gratuit et qui ne consomme aucune recherche**.
L'app le consulte avant chaque appel live et lit `this_month_usage` : le chiffre
qui fait foi, celui de ton compte. Il reste juste même si tu utilises ta clé
depuis un autre projet, et il se remet à zéro tout seul au renouvellement.

À **249 sur 250**, la bascule vers SearchApi est automatique et silencieuse —
tu ne peux structurellement pas dépasser le quota gratuit. Deux garde-fous en plus :

- **Coupure sur erreur** : si un fournisseur répond « quota dépassé » (par exemple
  parce qu'il a été consommé ailleurs), il est marqué hors service pour le mois et
  la requête part immédiatement sur le suivant — l'utilisateur ne voit rien.
- **Marge de 1** : le seuil 249 laisse un crédit de sécurité contre les
  courses entre deux appels simultanés.

SearchApi n'a pas d'équivalent public, donc son compteur est interne.

## 4. Compteur durable : brancher un KV (recommandé)

Sans KV, le compteur du relais vit dans le Cache API : ça marche, mais c'est
par centre de données et ça peut être purgé — donc légèrement optimiste.

1. Cloudflare ▸ **Storage & Databases ▸ KV** ▸ *Create namespace* (ex. `escale`).
2. Ton projet Pages ▸ Settings ▸ **Bindings** ▸ *Add* ▸ **KV namespace**
   Variable name : `ESCALE_KV` — Namespace : celui créé.
3. Redéploie.

Gratuit dans le plan Cloudflare de base, et `/api/live` t'indique quel mode est
actif (`"backend":"kv"` ou `"cache"`).

## 5. Vérifier

`https://ton-site.pages.dev/api/live` (sans paramètre) renvoie l'état complet
sans consommer un seul crédit :

```json
{
  "configured": true, "backend": "kv", "active": "serpapi", "total_left": 336,
  "providers": [
    {"id":"serpapi","used":13,"budget":249,"left":236,"counter":"compte SerpApi (officiel)","available":true},
    {"id":"searchapi","used":0,"budget":99,"left":99,"counter":"local (kv)","available":true}
  ]
}
```

Puis une vraie requête :
`…/api/live?origin=NTE&destination=DUB&depart=2026-03-06&return=2026-03-08`
→ la réponse contient `"provider":"serpapi"` (ou `"searchapi"` après bascule).

## 6. Ce que tu vois dans l'app

- Le reste des deux quotas s'affiche en haut du calendrier de prix :
  `SerpApi 236/249 · relais 99/99`.
- Chaque résultat live indique sa provenance : `· SerpApi`, `· relais SearchApi`
  ou `· en cache`.
- Quota épuisé → les boutons ⚡ se verrouillent avec le message
  « quota live épuisé ce mois — prix en cache uniquement ». Le reste de l'app
  continue normalement.
- Le live **ne part jamais tout seul** : uniquement sur appui du bouton ⚡.
- `/api/live` met en cache 6 h : recliquer la même route aux mêmes dates coûte 0 crédit.

---

# Prix vol au plus juste (croisement 2 sources)

Quand tu demandes le tarif réel (⚡), le prix affiché est celui de **Google Flights (live, réservable
maintenant)**. En parallèle, l'app interroge **Aviasales/Travelpayouts** (gratuit) et l'affiche **à titre
indicatif** à côté (« Aviasales : ~150 € vu récemment, à confirmer ») — car Aviasales est un **cache**
(prix constaté ≤ 7 j), pas un tarif live : il n'est donc **jamais substitué** au prix Google. Si Aviasales
est plus bas, l'écart est signalé (« −64 €, à confirmer ») pour t'inviter à vérifier, sans te promettre un
tarif qui pourrait ne plus exister. Si le quota Google est épuisé, Aviasales s'affiche mais **clairement
marqué indicatif**.

# Prix réel (⚡) partout & retour-en-haut

Le bouton **⚡** (prix réel Google Flights) est désormais disponible non seulement dans « Ma sélection »,
mais aussi dans **Séjour** (met à jour le vol et recalcule le total du séjour), **Comparateur** (tarif réel
depuis le meilleur départ de chaque ligne) et **Croisé** (recalcule le total pour tous les voyageurs).
Rappel : appel à la demande, quota partagé — donc uniquement sur clic.

Une **flèche ↑** flottante (en bas à droite) apparaît dès qu'on descend et ramène en haut de page d'un tap.

Séjour corrigé : la recherche d'hôtel « à partir de » se fait désormais en **mode large** (sans filtre de
distance/catégorie) pour toujours proposer un prix indicatif ; si le cache est vide, le ⚡ ou l'onglet Hôtels
prennent le relais.

# Barre d'outils (navigation principale)

En haut de l'app, une barre d'outils sépare le **mode simplifié** (assistant pas à pas, recherche rapide
vol + destination + sur place) des **outils spécialisés**, chacun avec son propre écran focalisé :
**Comparateur**, **Croisé**, **Séjour**, **Hôtels**, **Voiture**, **Taxi**, **Activités**. Choisir un outil masque
le reste et n'affiche que ce dont il a besoin (ex. « Voiture » = dates + recherche voiture). Le simplifié
reste l'assistant 4 étapes ; les onglets avancés (Comparateur/Croisé/Séjour) sont désormais **en haut**,
plus enfouis dans l'étape Destination. Aucune fonction n'est perdue — tout est réorganisé.

# Assistant pas à pas

Au lancement, l'app s'ouvre en mode **assistant** : une étape à la fois (Départ · Dates ·
Destination · Sur place), avec une barre d'étapes en haut et des boutons Précédent/Suivant.
La navigation est **libre** (on peut sauter à n'importe quelle étape en la touchant). Le bouton
**« Tout voir »** repasse à la page longue classique (toutes les sections d'un coup). **Aucune
option n'est perdue** — elles sont juste réparties sur 4 écrans.

# Retirer / ajouter des villes

Chaque destination a une **croix ✕** pour la retirer (y compris les villes par défaut ; le retrait
est mémorisé). Un lien **« rétablir les villes masquées »** apparaît en bas de liste pour tout
remettre. Les villes **ajoutées** (recherche monde) remontent **en tête de liste** ; idem pour un
aéroport de départ ajouté (il passe en tête des favoris).

# Onglets Vols

Cinq modes, tous alimentés par le cache Travelpayouts (gratuit, illimité) sauf le ⚡ live :

- **Ma sélection** : ta liste de destinations (monde entier), calendrier de prix, ⚡ à la demande.
- **N'importe où** : le vol le moins cher vers partout depuis un départ.
- **Comparateur** : jusqu'à **5 aéroports de départ** → toutes les villes desservies, triées par un
  **score prix↔durée** réglable au curseur. Idéal quand plusieurs aéroports te sont accessibles et
  que tu n'as pas d'idée de destination. Le meilleur départ est indiqué pour chaque ville.
- **Croisé** : **2 à 3 voyageurs**, chacun son aéroport (ex. Bretagne + Bruxelles) → uniquement les
  destinations que **tout le monde** peut rejoindre, avec 3 tris : **coût total**, **équitable**
  (personne ne paie trop), **durée moyenne**. Chaque carte détaille prix + durée par voyageur.
- **Séjour** : vol + hôtel combinés, coût total du voyage par destination.

Un **filtre Direct / Avec escale / Tous** (sous le filtre durée) s'applique à **Ma sélection**,
**N'importe où** et **Comparateur** : les vols **directs sont remontés en tête** (liseré vert,
mention « direct »), pratique pour repérer d'un coup d'œil ce qui est joignable sans escale depuis
un aéroport. L'info escale vient du cache (le tarif le moins cher trouvé) : indicative, comme les prix.

Le **Comparateur** a deux vues : « Meilleur par ville » (la moins chère tous départs confondus) et
« **Directs par aéroport** » (un groupe par aéroport listant toutes ses lignes directes, d'un coup d'œil).
Tu peux aussi **verrouiller une destination** précise → l'app compare alors tes aéroports entre eux
(« quel départ est le moins cher vers Lisbonne ? »). Le **Croisé** accepte des **villes d'arrivée forcées** :
même si un voyageur n'a pas la ville en cache, elle s'affiche avec « — » sur son tronçon (à compléter en ⚡).

Les départs du Comparateur et les voyageurs du Croisé sont mémorisés (`ESCALE_CMP_V1`,
`ESCALE_CROSS_V1`). Chaque vue interroge une fois `/api/anywhere` par départ — gratuit et sans
quota. Le ⚡ live reste réservé à la vérification d'une route précise, une fois repérée.

# Hôtels & voiture

- **Escale à terre** : hôtels via le cache Hotellook (`/api/hotels`, ton `TP_TOKEN`, gratuit) ou
  ⚡ Google Hotels (mêmes crédits que les vols). Filtres : distance au centre, note mini, catégorie,
  **chambre privative uniquement** (exclut auberges de jeunesse et dortoirs), voyageurs.
- **Hôtels — 3 sources** : « Cache gratuit » (Hotellook, illimité, sans photo/note), **« 📸 Booking (photos) »**
  (`/api/stays`, RapidAPI) qui affiche **grande photo + note /10 + mot (Excellent…) + nb d'avis + prix barré**,
  et « ⚡ Google Hotels » (temps réel multi-vendeurs). Les filtres (distance, catégorie, privative, voyageurs)
  s'appliquent aux trois. Booking et voiture partagent la clé `RAPIDAPI_KEY` et le quota 530/mois → sur bouton,
  cache 6 h. Sans clé, le bouton Booking se masque et le cache Hotellook / ⚡ restent.
- **Quoi voir** (🗺️, outil « À voir ») : `/api/seewhat` — musées, monuments, châteaux, plages, parcs, points
  de vue autour de la destination, via **OpenStreetMap / Overpass** : **gratuit, sans clé, sans quota**,
  couvre même les petites villes. Complète les activités Booking (« quoi réserver ») par un « quoi voir »
  avec catégorie, distance et lien (Wikipédia / site / carte OSM).
- **Transfert aéroport** (🚕) : `/api/taxi` — saisis l'adresse/hôtel d'arrivée, l'app cherche les transferts
  depuis l'aéroport de destination (catégorie, prix, capacité, bagages, durée, accueil pancarte, annulation),
  triés par prix.
- **Activités & visites** (🎟️) : `/api/attractions` — les activités de la destination avec photo, note /5,
  badge « top vente », prix « dès X € » et lien de réservation ; triées par note.
- **Louer une voiture** : bouton « prix réels » (Booking via RapidAPI, `/api/cars`) qui affiche
  modèle, loueur, note /10, transmission, places, km illimités, annulation gratuite et prix total +
  par jour, triés par prix, avec bouton « Réserver ». Réutilise la ville + les dates déjà connues.
  Fonctionne en 2 temps côté serveur (auto-complete → recherche). À défaut de clé, le lien
  **Discover Cars** pré-rempli reste affiché (pour l'affilier, renseigne `DISCOVERCARS_MARKER`).

  Config voiture : ajoute dans Cloudflare la variable `RAPIDAPI_KEY` (clé RapidAPI, **Encrypt ✔**) et,
  au besoin, `RAPIDAPI_HOST` (défaut `booking-com18.p.rapidapi.com`) et `CARS_TTL` (cache, défaut 6 h).
  Quota RapidAPI Basic : **530 requêtes/mois** partagées — donc la recherche voiture ne part que **sur
  bouton**, jamais en fond, et le résultat est mis en cache 6 h (recliquer la même ville/dates = 0 crédit).

# Aéroports de départ

L'app couvre **72 aéroports** de référence en France (67 métropole + outre-mer) et
5 frontaliers (Bruxelles ×2, Amsterdam, Luxembourg, Genève) — mais tu n'y es pas
limité : la recherche accepte **n'importe quelle ville ou aéroport du monde**, en
départ comme en destination.

- **Recherche** en haut : ville, code IATA ou nom de région, insensible aux accents
  (`nimes` trouve Nîmes, `bez` trouve Béziers).
- **Filtres par région** : Favoris, Tous, Île-de-France, Grand Ouest, Nord & Normandie,
  Grand Est, Alpes & Rhône, Centre & Auvergne, Sud-Ouest, Méditerranée, Corse,
  Outre-mer, Frontaliers.
- **★ Favoris** : touche l'étoile d'une tuile pour l'épingler. La vue Favoris s'ouvre
  par défaut. Réglage mémorisé sur l'appareil (`ESCALE_FAV_V1`).
- Le dernier aéroport choisi est **rechargé automatiquement** au lancement suivant.
- La mention **« saisonnier »** signale les plateformes à desserte réduite ou estivale.
- **Recherche mondiale** : tape une ville hors liste (Miami, Pékin, Fort-de-France…),
  une suggestion « Ajouter » apparaît sous le champ. Le lieu ajouté est **mémorisé**
  sur l'appareil (`ESCALE_ORIG_CUSTOM_V1` pour les départs, `ESCALE_DEST_CUSTOM_V1`
  pour les destinations) et reste dans ta liste aux prochaines ouvertures.
- Les départs ajoutés apparaissent sous le filtre **★ Mes ajouts** ; une destination
  ajoutée se retire avec la petite croix sur sa carte.
- L'autocomplétion passe par `/api/place` (proxy Travelpayouts, **sans token**), avec
  repli direct sur l'endpoint public si la fonction n'est pas encore déployée.
- Les **destinations** par défaut couvrent désormais le monde (Amériques, Afrique,
  Moyen-Orient, Asie, Océanie, outre-mer) en plus de l'Europe.
- Les listes de compagnies sont **indicatives** : elles bougent chaque saison. Les
  aéroports sans liste affichent un message honnête plutôt qu'une liste inventée.

## Arborescence du repo

```
/index.html
/manifest.json
/sw.js
/icon-192.png              ← icône « any »
/icon-512.png              ← icône « any » + marque affichée dans l'en-tête
/icon-maskable-192.png     ← icône « maskable » (Android, marge de sûreté)
/icon-maskable-512.png     ← icône « maskable »
/favicon.png               ← onglet navigateur
/functions/api/prices.js      → /api/prices     (prix d'une route, cache)
/functions/api/calendar.js    → /api/calendar   (calendrier de prix par jour, cache)
/functions/api/anywhere.js    → /api/anywhere   (le moins cher vers partout, cache)
/functions/api/cities.js      → /api/cities     (noms de villes IATA, sans token)
/functions/api/live.js        → /api/live       (prix temps réel, bascule SerpApi → SearchApi)
/functions/api/place.js       → /api/place      (recherche ville/aéroport monde, sans token)
/functions/api/hotels.js      → /api/hotels     (hôtels en cache Hotellook, ton TP_TOKEN)
/functions/api/cars.js        → /api/cars       (location voiture, Booking via RapidAPI)
/functions/api/stays.js       → /api/stays      (hôtels Booking : photos + notes, RapidAPI)
/functions/api/taxi.js        → /api/taxi       (transfert aéroport, RapidAPI)
/functions/api/attractions.js → /api/attractions (activités & visites, RapidAPI)
/functions/api/seewhat.js     → /api/seewhat    (quoi voir : POI OpenStreetMap, gratuit sans clé)
/SETUP.md
/PRIX-LIVE-API.md             (comparatif des API de tarifs, août 2026)
```

## Bon à savoir

- Les prix automatiques viennent du **cache Aviasales** (2 à 7 jours) : indicatifs,
  à reconfirmer sur la page de l'offre avant de payer. Le bouton ⚡ sert précisément à ça.
- `/api/cities` ne nécessite **pas** de token (fichiers publics).
- Le service worker est passé en `escale-v6` : au premier lancement après déploiement,
  l'ancien cache est purgé automatiquement.
- **Icônes** : la marque (crâne au chapeau, longue-vue et rose des vents, sabres croisés)
  est déclinée en deux jeux. Les fichiers `icon-*.png` servent partout (iOS, favicon,
  en-tête de l'app) ; les `icon-maskable-*.png` ont une marge plus large pour survivre
  au rognage circulaire d'Android. Sur iPhone, l'icône de l'écran d'accueil ne se met à
  jour qu'après avoir **retiré puis réajouté** le raccourci.
- Pour enlever la marque de l'en-tête sans toucher aux icônes : supprime la ligne
  `<img class="mark" …>` dans `index.html`.
- **Thème « Laiton & Abysse »** : interface corsaire métallisée — plaque de laiton
  rivetée en tête (avec un reflet qui balaie l'or au chargement), boutons en doublons
  frappés, patine vert-de-gris pour les vols directs. Le reflet et l'animation d'éveil
  de la marque respectent « Réduire les animations » (réglages système).
- Installer en app sur iPhone : Safari ▸ Partager ▸ « Sur l'écran d'accueil ».
