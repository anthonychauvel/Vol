# Escale — Vol-main_20 (28/08/2026) — Itinéraire + Polarsteps + date prioritaire Radar

Nouveau fichier backend : `functions/api/poi.js` (OpenTripMap → **clé `OPENTRIPMAP_KEY` à ajouter
côté Cloudflare Pages**). SW bump **v82 → v83**.

- **🗺 Onglet Itinéraire** — nouvel outil. Tape une ville → lieux géolocalisés (OpenTripMap),
  coche ce que tu veux voir, choisis **départ / arrivée** (ou « n'importe lequel ») + **mode**
  (🚶 à pied / 🚌 transport / 🚗 voiture) → **ordre optimisé** (plus proche voisin + 2-opt, donc
  sans revenir sur ses pas) avec **carte Leaflet** (marqueurs numérotés + tracé), liste des étapes,
  distances et temps estimés. Leaflet chargé en **lazy-load** (n'alourdit pas le démarrage ;
  repli liste seule si la carte ne charge pas).
  ⚠️ v1 : tracé en lignes directes entre points (pas encore le routage rue-par-rue). Estimations
  de temps = distance × facteur détour / vitesse du mode.
- **🧭 Lien Polarsteps** — dans le header : colle l'URL de ton voyage (mémorisée en local), un tap
  l'ouvre, le ✎ la modifie.
- **📌 Date prioritaire (Radar)** — dans les réglages du Radar, un champ date : le Radar suit le
  prix de **cette date précise** depuis ton origine vers chaque **destination surveillée (★)**,
  et affiche l'**évolution** (▲/▼ vs dernier relevé). Carte en tête des résultats. Borné à 8
  destinations, mis en cache (mêmes clés `cal:`).

## À tester sur appareil
- **Clé OpenTripMap** obligatoire pour l'onglet Itinéraire (sinon message d'erreur clair).
- Itinéraire : recherche de lieux, cochage, optimisation, carte Leaflet (nécessite le réseau
  pour la carte + les tuiles OSM). Le lazy-load Leaflet via cdnjs.
- Date prioritaire : mets une date + des ★, recharge → la carte doit lister les prix de cette date.

---

# Escale — Vol-main_19 (28/08/2026) — aéroports voisins (premium) + re-skin néon

- **Aéroports voisins (PREMIUM uniquement)** — dans le calendrier d'une route (vue mois),
  bloc auto « Aussi depuis tes aéroports voisins (ce mois) » : compare le prix mini du mois
  depuis ton origine vs les 3 aéroports les plus proches (≤ 220 km), marque le moins cher.
  Borné à la vue mois (pas la vue 12 mois → éviterait 36 appels) et mis en cache (mêmes clés
  `cal:` → réchauffe la vue si tu ouvres ce voisin ensuite). Masqué en mode soft.
- **Re-skin « corsaire au néon »** — palette coucher de soleil façon Vice (rose/magenta/violet/
  orange + cyan néon), titres en dégradé façon lettrage, halo subtil. Identité pirate conservée.
  Palette **originale** (aucun asset/police Rockstar). Tout via variables CSS.
- SW bump **v81 → v82**.

---

# Escale — Vol-main_18 (28/08/2026) — 6 nouveautés

Retrait complet du CO₂ (v16) + phrase premium « je voyage avec tony » soft→premium seulement (v17),
puis ce gros lot de 6 améliorations. Toujours vanilla JS / localStorage, SW bump **v80 → v81**.

1. **★ Mes trajets sauvegardés** — bouton « ★ Sauvegarder ce trajet » dans l'overlay calendrier.
   Panneau repliable « ★ Mes trajets » (sous le Radar, masqué si vide) : chaque trajet (aéroport +
   destination + dates) se relance en 1 tap (restaure l'état + ouvre le calendrier). localStorage
   `escale:trips:v1`, max 30.
2. **Invite d'installation PWA** — bannière discrète : bouton « Installer » via l'événement
   `beforeinstallprompt` (Chrome/Android), ou astuce « Partager → Sur l'écran d'accueil » sur iOS.
   Rejet mémorisé, jamais affichée si déjà installée. *Vise le point faible n°1 (installs à froid).*
3. **Bannière « cible atteinte » au lancement** — si des vols surveillés (Radar) passent sous ton
   prix cible 🎯, un bandeau s'affiche à l'ouverture (« X destinations sous ta cible Y€ — dès Z€ »).
   Tap → ouvre le Radar. Fermable pour la session. Aucune notif Android.
4. **Conseil d'achat** — dans l'historique perso : 🟢 bon moment / 🟠 plutôt attendre / ⚪ dans la
   moyenne, selon la position du prix actuel vs ton historique (≥ 3 relevés).
5. **Flexible ±3 jours** — dans le calendrier, quand une date est choisie : « −X€ en partant le … »
   si un jour à ±3 j est moins cher.
6. **Météo × prix (vue 12 mois)** — la heatmap année affiche la température par mois et surligne ⭐
   le **meilleur compromis météo/prix** (prix bas + ~24° confortable). Météo via `/api/weather` (cache CDN).

## À tester sur appareil
Syntaxe validée (`node --check`). À vérifier en conditions réelles :
- Sauvegarde/relance d'un trajet (restaure aéroport + dates + ouvre le calendrier).
- Bannière install : sur iOS l'astuce doit apparaître ~2,5 s après l'ouverture (si non installé) ;
  sur Chrome/Android le bouton « Installer » n'apparaît qu'après l'émission de l'événement.
- Bannière cible : mets un seuil 🎯 dans le Radar avec des zones surveillées → au rechargement,
  si un prix cache est sous le seuil, le bandeau doit sortir.
- Vue 12 mois : les températures + ⭐ (12 appels météo en plus des 12 prix ; cachés ensuite).

---

# Escale — Vol-main_17 (28/08/2026) — phrase premium + retrait CO₂

- **Premium** : la phrase est désormais **« je voyage avec tony »** (minuscules, insensible à la casse),
  demandée uniquement pour **soft → premium** ; **premium → soft** est direct, sans phrase.
  Corrigé aux deux endroits (bouton du header + Radar).
- **CO₂ retiré** partout (pastille Ma sélection, verdict calendrier, fonctions, CSS) — le « trou »
  après la durée disparaît. SW v79 → v80 (le retrait CO₂ était en v16, v79).

---

# Escale — Vol-main_15 (28/08/2026) — pastille CO₂ robuste

Le « trou » après la durée du trajet = l'emplacement de la pastille CO₂, qui sortait
vide. En isolé le calcul est correct — la cause la plus probable est un **shell servi
en cache par le service worker** (ancien `index.html` sans la pastille), surtout en
onglet privé maintenu ouvert entre deux déploiements.
Par sécurité, `co2ChipFor` est maintenant **blindé** : il retrouve les coordonnées par
**code d'aéroport** (`findAirport`/`DESTS`) même si l'objet origine/destination ne les
porte pas en ligne → la pastille s'affiche dès que les codes sont connus. SW bump **v77 → v78**.

> Si après **fermeture complète de l'onglet privé** puis réouverture le trou persiste sur
> une ville par défaut, tape dans la console :
> `document.querySelector('.dur').parentElement.innerHTML`
> — s'il contient `class="co2"`, la pastille est bien là (souci d'affichage) ; sinon elle
> sort vide et je creuse le cas précis.

---

# Escale — Vol-main_14 (28/08/2026) — correctif météo

La météo ne s'affichait pas (test en mode simplifié). Cause : l'appel **direct** du
navigateur à open-meteo (fragile selon domaine/SW/réseau).
**Correctif** : la météo passe maintenant par une **fonction `/api/weather`** (même
origine → gérée par le SW exactement comme `/api/prices`, et open-meteo est appelé
**côté serveur**, donc plus aucun souci CORS). Ajout d'un repli de coordonnées pour les
destinations par défaut passées sans lat/lng. SW bump **v76 → v77**.

> ⚠️ Comme `/api/prices`, la météo a besoin de l'environnement déployé (Cloudflare Pages
> ou `wrangler pages dev`) — elle ne marchera pas en ouvrant `index.html` en `file://`.
> Après déploiement, **recharge fort** (le SW peut servir l'ancien code en cache).

Nouveau fichier : `functions/api/weather.js`.

---

# Escale — Vol-main_13 (28/08/2026)

Grosse passe d'améliorations issue du PDF + propositions plus poussées.
**Séjour laissé strictement tel quel** (aucun onglet Budget, `renderStay` intact).
Tout est en **JS vanilla, localStorage only, sans nouveau fichier backend**.
SW : cache bump **escale-v75 → escale-v76**.

---

## Ce qui a été ajouté / changé

### Perf & robustesse
- **Cache client des prix (mémoire + localStorage, TTL 6 h)** — clé `escale:px:*`.
  Partagé entre *Ma sélection* et le calendrier. Évite de re-télécharger à chaque
  re-rendu et **protège le quota Travelpayouts gratuit**.
- **`fetchPrices` parallélisé** : au lieu d'un `await` par destination en série,
  récupération par **lots de 6 en parallèle**, cache-first (peint d'abord ce qui est
  déjà connu), et mémorise même les "sans prix" (pour ne pas re-tenter pendant 6 h).
- **Squelettes de chargement** (shimmer) à la place des `…` et du "Chargement des prix…"
  (Ma sélection + grille calendrier).

### Calendrier prix (overlay) — surface enrichie
- **Météo à destination** pour le mois affiché — Open-Meteo *archive* (gratuit, sans clé,
  appel client direct). Normales indicatives = **même mois l'an passé** (l'archive ne
  couvre pas le futur). Affiché en encart, chargé en asynchrone.
- **Vue « 12 mois » (heatmap)** — bascule *Mois / 12 mois*. Balaie 12 mois via
  `/api/calendar` (mis en cache → **réchauffe aussi la vue mois**), min par mois coloré.
  Tape un mois → détail jour par jour. Met en avant le mois le moins cher.
- **Détecteur de prix anormal** — repère les jours **< 55 % de la médiane** du mois
  (⚡ sur la case + encart "possible erreur tarifaire / promo courte"). Honnête :
  c'est un outlier *dans le mois*, pas une prédiction.
- **Historique de prix perso** — série `{date, prix}` par route (localStorage `escale:hist:*`,
  cap 40), construite au fil de tes consultations (Ma sélection + calendrier).
  Affiche tendance ▲/▼, sparkline, % depuis le 1ᵉʳ relevé, creux vu.
- **Export .ics** — bouton "📅 Ajouter au calendrier" (aller + retour) quand une date est choisie.
- **Partage** — bouton "↗ Partager cette route" (Web Share natif, repli presse-papier).
- **CO₂ estimé** ajouté à la ligne verdict du mois.

### Cap Libre
- Chaque **fenêtre** a maintenant **↗ Partager** et **📅 Calendrier** (sur la destination
  la moins chère de la fenêtre).

### Ma sélection
- **Pastille CO₂** (≈ kg, estimation aller éco.) à côté de la durée de chaque destination.

### Liens profonds & navigation
- **Partage = lien profond** : `#t=…&o=…&d=…&dep=…&ret=…&ow=…&b=…` rouvre Escale sur
  la même recherche (outil + aéroport + dates).
- **Réouverture sur le dernier outil utilisé** (`escale:lasttool`) quand il n'y a pas de lien.
- Boot refait proprement (`bootTool`) : lien profond → sinon dernier outil → sinon *simple*.

### Radar
- **Seuil de prix cible** (🎯) dans les réglages : surligne d'un badge "🎯 cible" toutes les
  lignes de résultat (baisses, deals de zone, croisé) **sous ton prix** — en post-rendu,
  toutes les lignes portent déjà `data-price`.
- **Fusion des deux panneaux de réglages** : `renderSettingsWithEdit()` n'est plus qu'un
  `renderSettings(true)` (un seul panneau à maintenir ; le mode éditeur masque juste la
  recherche/seuil pour ne pas voler le focus). Comportement identique.
- **Code mort supprimé** : handlers `rdNotify`/`rdPush` (les toggles n'étaient plus rendus
  depuis un moment) retirés de `bindSettings` et de l'ancien `renderSettingsWithEdit`.

### Nettoyage
- Suppression des 2 fichiers-octets parasites : **`Ff`** (racine) et **`functions/api/p`**
  (chacun ne contenait qu'un `\n`, aucune référence).

---

## Volontairement PAS fait

- **Onglet Budget / réanimation de Séjour** — laissé de côté sur ta consigne.
  `renderStay` et le mode `stay` sont intacts (dormants, non débranchés).
- **Extension auto « aéroports proches »** — **reportée exprès**. Elle **multiplie le
  fan-out d'appels** (chaque origine × voisins), ce qui va **à l'encontre du cache/
  parallélisation** qu'on vient d'ajouter et du quota Travelpayouts. Elle mérite une
  décision de design (voisins auto vs bouton "élargir" à la demande, rayon, nb max).
  Dis-moi si tu la veux et sous quelle forme, je la fais au prochain tour (idéalement
  en *opt-in au clic* pour ne pas cramer le quota).

## Push / notifications
Les toggles n'étaient déjà plus rendus ; j'ai retiré le code mort *frontend*.
Les fichiers backend dormants (`functions/api/push-subscribe.js`, `functions/api/cron.js`)
et les fonctions `enableBackgroundPush`/`disableBackgroundPush`/`notifyPermission` sont
**laissés en place** (inoffensifs, non appelés). Dis-moi si tu veux que je les purge aussi.

---

## À tester sur appareil (impossible à valider ici sans ton backend live)
La **syntaxe JS est validée** (`node --check`), mais ces points touchent le réseau/DOM réel :
1. **Météo** : CORS d'`archive-api.open-meteo.com` depuis ton domaine Cloudflare
   (l'appel est client-direct ; repli silencieux si ça échoue).
2. **Vue 12 mois** : le balayage `/api/calendar` sur 12 mois (lots de 4) — vérifier
   la charge/quota et que le cache réchauffe bien la vue mois.
3. **Lien profond** au chargement : `#t=…&o=…&dep=…` → aéroport + dates + bon outil.
4. **Seuil cible Radar** : badge "🎯 cible" bien posé sur les 3 types de lignes.
5. **.ics** : ouverture correcte dans l'appli Calendrier (aller + retour).
