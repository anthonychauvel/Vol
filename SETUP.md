# Escale — installation

Guide pas à pas. Compte le faire une seule fois.

Deux sources de prix cohabitent :

| | Source | Coût | Fraîcheur | Déclenchement |
|---|---|---|---|---|
| **Prix de base** | Travelpayouts (cache Aviasales) | gratuit, illimité | 2 à 7 jours | automatique |
| **Prix live ⚡** | Google Flights via SerpApi | 250 rech./mois gratuites | temps réel | sur appui du bouton seulement |

Le premier est **obligatoire**, le second est **facultatif** : sans clé SerpApi,
l'app masque simplement les boutons ⚡ et tout le reste fonctionne comme avant.

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

# Partie 2 — Prix live ⚡ (SerpApi) — facultatif

Le comparatif complet des API de tarifs (et pourquoi celle-ci) est dans **PRIX-LIVE-API.md**.
Version courte : Amadeus Self-Service a fermé le 17/07/2026, Kiwi et Skyscanner sont
passés sur invitation — SerpApi est ce qui reste avec le meilleur palier gratuit
(**250 recherches/mois**) sans dossier commercial.

## 1. Récupérer la clé

1. Compte gratuit sur **serpapi.com** (le plan Free est sélectionné par défaut).
2. La clé apparaît directement sur le tableau de bord.

## 2. Brancher la clé

Même endroit que le token Travelpayouts :

- Name : `SERP_TOKEN` — Value : ta clé — **Encrypt ✔**
- *(facultatif)* Name : `LIVE_TTL` — Value : durée du cache serveur en secondes.
  Défaut `21600` (6 h). Mets `43200` (12 h) pour économiser encore plus de crédits.

Redéploie.

## 3. Vérifier

`https://ton-site.pages.dev/api/live` doit répondre `{"configured":true,…}`.
S'il répond `{"configured":false}`, le secret n'est pas posé ou le déploiement n'a pas été relancé.

Puis une vraie requête :
`https://ton-site.pages.dev/api/live?origin=NTE&destination=DUB&depart=2026-03-06&return=2026-03-08`

## 4. Ne pas griller le quota

L'app est faite pour ça, mais autant savoir comment :

- Le live **ne part jamais tout seul** : uniquement sur le bouton ⚡ (ligne de destination,
  ou barre en haut du calendrier de prix).
- `/api/live` **met en cache 6 h** côté Cloudflare : recliquer la même route aux mêmes
  dates ne consomme aucun crédit (la réponse est marquée « en cache »).
- Un compteur local s'affiche en haut du calendrier de prix (« N appels live ce mois-ci »).
  C'est indicatif, calculé côté navigateur — le chiffre qui fait foi est sur le dashboard SerpApi.
- Plafond du palier gratuit : **50 recherches/heure**, 250/mois, sans report au mois suivant.

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
/icon-192.png
/icon-512.png
/functions/api/prices.js      → /api/prices     (prix d'une route, cache)
/functions/api/calendar.js    → /api/calendar   (calendrier de prix par jour, cache)
/functions/api/anywhere.js    → /api/anywhere   (le moins cher vers partout, cache)
/functions/api/cities.js      → /api/cities     (noms de villes IATA, sans token)
/functions/api/live.js        → /api/live       (prix temps réel, SerpApi, facultatif)
/SETUP.md
/PRIX-LIVE-API.md             (comparatif des API de tarifs, août 2026)
```

## Bon à savoir

- Les prix automatiques viennent du **cache Aviasales** (2 à 7 jours) : indicatifs,
  à reconfirmer sur la page de l'offre avant de payer. Le bouton ⚡ sert précisément à ça.
- `/api/cities` ne nécessite **pas** de token (fichiers publics).
- Le service worker est passé en `escale-v2` : au premier lancement après déploiement,
  l'ancien cache est purgé automatiquement.
- Installer en app sur iPhone : Safari ▸ Partager ▸ « Sur l'écran d'accueil ».
