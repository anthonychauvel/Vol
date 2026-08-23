// Service worker minimal pour Escale.
// - Le "shell" (page + icônes) est mis en cache → lancement instantané et hors-ligne.
// - Les appels /api/ passent toujours par le réseau (données fraîches, jamais en cache).

const CACHE = "escale-v24";
const SHELL = ["./", "./index.html", "./manifest.json",
  "./icon-192.png", "./icon-512.png",
  "./icon-maskable-192.png", "./icon-maskable-512.png", "./favicon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Jamais de cache pour l'API prix/calendrier : toujours le réseau.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({ error: "hors-ligne" }), { headers: { "Content-Type": "application/json" } })
    ));
    return;
  }
  // Shell : cache d'abord, réseau en repli.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
