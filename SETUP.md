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

# Aéroports de départ

L'app couvre désormais **72 aéroports** : 67 en France (métropole + outre-mer) et
5 frontaliers utiles (Bruxelles ×2, Amsterdam, Luxembourg, Genève).

- **Recherche** en haut : ville, code IATA ou nom de région, insensible aux accents
  (`nimes` trouve Nîmes, `bez` trouve Béziers).
- **Filtres par région** : Favoris, Tous, Île-de-France, Grand Ouest, Nord & Normandie,
  Grand Est, Alpes & Rhône, Centre & Auvergne, Sud-Ouest, Méditerranée, Corse,
  Outre-mer, Frontaliers.
- **★ Favoris** : touche l'étoile d'une tuile pour l'épingler. La vue Favoris s'ouvre
  par défaut. Réglage mémorisé sur l'appareil (`ESCALE_FAV_V1`).
- Le dernier aéroport choisi est **rechargé automatiquement** au lancement suivant.
- La mention **« saisonnier »** signale les plateformes à desserte réduite ou estivale.
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
/SETUP.md
/PRIX-LIVE-API.md             (comparatif des API de tarifs, août 2026)
```

## Bon à savoir

- Les prix automatiques viennent du **cache Aviasales** (2 à 7 jours) : indicatifs,
  à reconfirmer sur la page de l'offre avant de payer. Le bouton ⚡ sert précisément à ça.
- `/api/cities` ne nécessite **pas** de token (fichiers publics).
- Le service worker est passé en `escale-v3` : au premier lancement après déploiement,
  l'ancien cache est purgé automatiquement.
- **Icônes** : la marque (crâne au chapeau, longue-vue et rose des vents, sabres croisés)
  est déclinée en deux jeux. Les fichiers `icon-*.png` servent partout (iOS, favicon,
  en-tête de l'app) ; les `icon-maskable-*.png` ont une marge plus large pour survivre
  au rognage circulaire d'Android. Sur iPhone, l'icône de l'écran d'accueil ne se met à
  jour qu'après avoir **retiré puis réajouté** le raccourci.
- Pour enlever la marque de l'en-tête sans toucher aux icônes : supprime la ligne
  `<img class="mark" …>` dans `index.html`.
- Installer en app sur iPhone : Safari ▸ Partager ▸ « Sur l'écran d'accueil ».
