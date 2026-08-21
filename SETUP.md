# Escale — installation

Guide pas à pas pour activer les prix. Compte le faire une seule fois.

## 1. Le bon produit Travelpayouts (ne pas se tromper)

Sur le site Travelpayouts, tu vois plusieurs outils. Voici lequel te concerne :

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

C'est la seule clé dont l'app a besoin. Le même token marche pour les trois fonctions (prix, calendrier, n'importe où).

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

## Arborescence du repo

```
/index.html
/manifest.json
/sw.js
/icon-192.png
/icon-512.png
/functions/api/prices.js      → /api/prices     (prix d'une route)
/functions/api/calendar.js    → /api/calendar   (calendrier de prix par jour)
/functions/api/anywhere.js    → /api/anywhere    (le moins cher vers partout)
/functions/api/cities.js      → /api/cities      (noms de villes IATA, sans token)
```

## Bon à savoir

- Les prix viennent du **cache Aviasales** (2 à 7 jours) : indicatifs, à reconfirmer sur la page de l'offre avant de payer.
- `/api/cities` ne nécessite **pas** de token (fichiers publics).
- Installer en app sur iPhone : Safari ▸ Partager ▸ « Sur l'écran d'accueil ».
