// Cloudflare Pages Function — PRIX LIVE (Google Flights via SerpApi).
// Emplacement : functions/api/live.js  →  /api/live
//
// Complète /api/prices (cache Aviasales, gratuit, illimité) par un tarif
// TEMPS RÉEL lu sur Google Flights. À déclencher UNIQUEMENT à la demande :
// le quota gratuit SerpApi est de 250 recherches / mois.
//
// Config (dashboard Cloudflare Pages ▸ Settings ▸ Variables and Secrets) :
//   Name : SERP_TOKEN   Value : ta clé SerpApi   [Encrypt ✔]
//   (facultatif) LIVE_TTL : durée du cache serveur en secondes, défaut 21600 (6 h)
//
// Sans SERP_TOKEN la fonction répond {configured:false} et l'app masque
// simplement le bouton « prix live » — rien ne casse.
//
// Appel : /api/live?origin=NTE&destination=DUB&depart=2026-03-06&return=2026-03-08

export async function onRequest(context) {
  const { request, env } = context;
  const p = new URL(request.url).searchParams;

  const origin      = (p.get("origin")      || "").toUpperCase();
  const destination = (p.get("destination") || "").toUpperCase();
  const depart = p.get("depart") || "";   // YYYY-MM-DD
  const ret    = p.get("return") || "";   // YYYY-MM-DD (vide = aller simple)

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=1800"
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: cors });

  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  // Pas de clé → l'app masque le bouton, aucun message d'erreur intrusif.
  if (!env.SERP_TOKEN) return json({ configured: false, reason: "SERP_TOKEN non configuré" });

  if (!origin || !destination || !depart)
    return json({ configured: true, error: "origin, destination et depart requis" }, 400);

  // --- cache serveur : une même route/dates ne consomme qu'un crédit par TTL ---
  const ttl = parseInt(env.LIVE_TTL || "21600", 10);
  const cacheKey = new Request(
    `https://escale.cache/live/${origin}-${destination}-${depart}-${ret || "ow"}`,
    { method: "GET" }
  );
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) {
    const body = await hit.json();
    return json({ ...body, cached: true });
  }

  const api = new URL("https://serpapi.com/search.json");
  api.searchParams.set("engine", "google_flights");
  api.searchParams.set("departure_id", origin);
  api.searchParams.set("arrival_id", destination);
  api.searchParams.set("outbound_date", depart);
  if (ret) api.searchParams.set("return_date", ret);
  api.searchParams.set("type", ret ? "1" : "2");   // 1 = aller-retour, 2 = aller simple
  api.searchParams.set("currency", "EUR");
  api.searchParams.set("hl", "fr");
  api.searchParams.set("gl", "fr");
  api.searchParams.set("deep_search", "false");
  api.searchParams.set("api_key", env.SERP_TOKEN);

  try {
    const r = await fetch(api.toString(), { headers: { Accept: "application/json" } });
    const j = await r.json();

    if (j && j.error)
      return json({ configured: true, price: null, error: String(j.error) }, 200);

    const all = [].concat(j?.best_flights || [], j?.other_flights || [])
                  .filter(o => typeof o?.price === "number");
    all.sort((a, b) => a.price - b.price);
    const best = all[0] || null;

    const legs = best?.flights || [];
    const out = {
      configured: true,
      source: "google_flights",
      origin, destination, depart, return: ret || null,
      price: best ? best.price : null,
      currency: "EUR",
      airlines: [...new Set(legs.map(f => f.airline).filter(Boolean))],
      stops: legs.length ? legs.length - 1 : null,
      duration: best?.total_duration ?? null,           // minutes, trajet aller
      departure_time: legs[0]?.departure_airport?.time || null,
      arrival_time: legs.length ? legs[legs.length - 1]?.arrival_airport?.time || null : null,
      offers: all.length,
      insights: j?.price_insights ? {
        lowest: j.price_insights.lowest_price ?? null,
        level: j.price_insights.price_level ?? null,     // low / typical / high
        typical: j.price_insights.typical_price_range ?? null
      } : null,
      url: j?.search_metadata?.google_flights_url || null,
      fetched_at: new Date().toISOString()
    };

    // On ne met en cache que les réponses utiles.
    if (out.price != null) {
      const store = new Response(JSON.stringify(out), {
        headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${ttl}` }
      });
      context.waitUntil(cache.put(cacheKey, store));
    }
    return json(out);

  } catch (e) {
    return json({ configured: true, price: null, error: "échec appel SerpApi", detail: String(e) }, 502);
  }
}
