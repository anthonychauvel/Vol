# Prix en direct — quelle API ? (état du marché, août 2026)

Recherche faite le 21/08/2026. Les tarifs bougent : revérifie la page de prix avant de payer.

## Le point important : le paysage a changé cet été

**Amadeus Self-Service est mort.** Le portail a été fermé le **17 juillet 2026**,
les clés existantes ne fonctionnent plus, et il n'y a plus d'inscription possible
pour un développeur indépendant. Il ne reste qu'Amadeus Enterprise, qui suppose en
général une accréditation IATA/ARC. C'était historiquement *la* réponse
« API de vols gratuite pour prototyper » — elle n'existe plus. Beaucoup de tutoriels
en ligne ne sont pas à jour là-dessus.

**Kiwi.com Tequila** a fermé son inscription libre la même année : c'est devenu du
partenariat sur invitation. Via Travelpayouts, il faut 50 000 visiteurs/mois.

**Skyscanner officiel** : partenariat commercial, validation au cas par cas,
souvent 100 000 visiteurs/mois exigés. Pas une option pour une app perso.

**Google Flights n'a pas d'API publique.** QPX Express a été arrêté en 2018 et jamais
remplacé. Tout ce qui s'appelle « Google Flights API » est un service tiers qui lit
la page pour toi et te la rend en JSON.

## Ce qui reste accessible sans dossier commercial

| Service | Palier gratuit | 1er palier payant | Type de données |
|---|---|---|---|
| **SerpApi** (Google Flights) | **250 recherches/mois**, 50/heure | 25 $/mois → 1 000 rech. | Temps réel, lu sur Google Flights |
| SearchApi.io | 100 requêtes | 40 $/mois | Idem (Google Flights) |
| Scrappa | 500 crédits/mois | prépayé, ~10 $/33 000 crédits | Idem |
| HasData | 66 recherches (one-shot) | 49 $/mois ≈ 13 000 rech. | Idem |
| FlightAPI.io | 20 à 100 appels (doc contradictoire) | 49 $/mois ≈ 30 000 crédits | Prix multi-compagnies + liens |
| Duffel | mode test gratuit (données bidon) | 3 $ par réservation confirmée | Vraie réservation NDC, 300+ compagnies |
| Sky Scrapper (via RapidAPI) | ~100 requêtes/mois | variable | Non officiel, fraîcheur incertaine |
| **Travelpayouts Data API** *(ce que tu utilises)* | **gratuit, sans quota mensuel** | — | Cache Aviasales (2–7 j) |

Non retenus ici parce qu'ils ne donnent **pas de prix** : Aviationstack, AeroDataBox,
FlightAware — ce sont des API d'état de vol (retards, portes, positions).

## Ce que j'ai retenu pour Escale : SerpApi

Raisons :

1. **250 recherches/mois gratuites**, c'est le palier gratuit le plus large de la liste
   pour du vrai temps réel — et pour un usage perso c'est largement suffisant.
2. Aucune validation, aucun seuil de trafic : tu crées un compte, tu as la clé.
3. Les données viennent de Google Flights : c'est exactement ce que tu verrais en
   ouvrant le site, prix compris, avec en bonus `price_insights`
   (« prix bas / normal / élevé » pour cette route).
4. Un moteur `google_travel_explore` existe aussi, qui correspond pile à ton mode
   « N'importe où » — piste pour plus tard.

Réserves à connaître :

- **Pas de report des crédits** d'un mois sur l'autre, et pas de paiement à l'usage :
  au-delà de 250, c'est 25 $/mois minimum.
- Débit plafonné à **50 recherches/heure** sur le palier gratuit.
- Ce n'est pas une API de réservation : tu obtiens le prix et le lien, l'achat se
  fait toujours chez le vendeur.

## Comment l'app dépense le quota

L'architecture est volontairement à deux vitesses, pour ne jamais griller 250 appels
en une session :

- **Par défaut, rien ne change.** Tous les prix affichés automatiquement (liste,
  calendrier couleur, mode « n'importe où ») viennent toujours de Travelpayouts :
  gratuit, illimité, mais en cache 2 à 7 jours.
- **Le prix live ne part que sur appui du bouton ⚡.** Jamais en fond, jamais au
  chargement, jamais en boucle sur une liste.
- **Cache serveur de 6 h** dans `/api/live` (Cloudflare Cache API) : recliquer la
  même route aux mêmes dates ne consomme **aucun** crédit. Réglable via la variable
  `LIVE_TTL`.
- **Compteur local** affiché dans le calendrier de prix, pour que tu voies où tu en es.

En pratique : ~8 vérifications live par jour tiennent dans le palier gratuit.

## Si tu veux passer au live partout un jour

Deux chemins, dans cet ordre de bon sens :

1. **Rester sur SerpApi et payer 25 $/mois** (1 000 recherches). Le code ne bouge pas.
2. **Passer à FlightAPI.io ou SearchApi.io** vers 49 $/mois si tu montes à plusieurs
   dizaines de milliers d'appels — à ce volume le prix unitaire y est meilleur.

Duffel n'a de sens que le jour où tu voudrais **vendre** des billets depuis l'app :
là c'est 3 $ par commande confirmée, sans besoin d'accréditation IATA, ce qui en fait
le vrai successeur d'Amadeus Self-Service pour les petits acteurs.

## Rappel : les limites côté Travelpayouts

Le Data API n'a pas de quota mensuel, mais des limites **par minute** :

| Méthode utilisée par Escale | Limite |
|---|---|
| `/v3/prices_for_dates` (`/api/prices`, `/api/anywhere`) | 600 req/min |
| `/v3/grouped_prices` (`/api/calendar`) | 600 req/min |

Au-delà, réponse **429** et blocage jusqu'à la fin de la minute. Les en-têtes
`X-Rate-Limit-Remaining` et `X-Rate-Limit-Reset` permettent de suivre ça. Aucun risque
d'y toucher avec un usage perso, mais c'est bon à savoir si un jour la liste de
destinations s'allonge beaucoup (chaque destination = 1 requête dans `/api/prices`).
