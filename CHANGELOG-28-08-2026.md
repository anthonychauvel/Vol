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
