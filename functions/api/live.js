// Cloudflare Pages Function — PRIX LIVE avec bascule automatique de fournisseur.
// Emplacement : functions/api/live.js  →  /api/live
//
// CHAÎNE DE FOURNISSEURS (dans l'ordre) :
//   1. SerpApi      — Google Flights — 250 recherches/mois gratuites
//   2. SearchApi.io — Google Flights — 100 requêtes gratuites (relais)
//   3. épuisé       — l'app retombe sur les prix en cache Travelpayouts
//
// COMPTAGE
//   • SerpApi : on lit le VRAI compteur du compte via https://serpapi.com/account.json
//     (gratuit, ne consomme aucun crédit). C'est le chiffre qui fait foi, pas une
//     estimation locale : il reste juste même si tu appelles l'API depuis ailleurs.
//   • SearchApi : pas de compteur public → compteur interne (KV si disponible,
//     sinon Cache API) + coupure immédiate si le fournisseur renvoie une erreur de quota.
//
// VARIABLES (Cloudflare Pages ▸ Settings ▸ Variables and Secrets)
//   SERP_TOKEN        clé SerpApi                              [Encrypt ✔]
//   SEARCHAPI_TOKEN   clé SearchApi.io (facultatif, le relais) [Encrypt ✔]
//   SERP_BUDGET       seuil de bascule, défaut 249 (sur 250)
//   SEARCHAPI_BUDGET  seuil de bascule, défaut 99  (sur 100)
//   LIVE_TTL          cache serveur des résultats en s, défaut 21600 (6 h)
//   ESCALE_KV         binding KV facultatif mais recommandé (compteur durable)
//
// APPELS
//   /api/live                          → état des quotas (aucun crédit consommé)
//   /api/live?origin=NTE&destination=DUB&depart=2026-03-06&return=2026-03-08

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });
const month = () => new Date().toISOString().slice(0, 7);

/* ---------------------------------------------------------------- compteur
   KV si le binding existe (durable, global), sinon Cache API (best-effort).
   Le compteur ne sert que pour SearchApi : SerpApi a son propre compteur officiel. */
function ledger(env) {
  const kv = env.ESCALE_KV || null;
  const key = (id) => `escale:usage:${id}:${month()}`;
  const url = (id) => `https://escale.ledger/${id}/${month()}`;

  async function read(id) {
    try {
      if (kv) {
        const v = await kv.get(key(id), "json");
        return v || { used: 0, tripped: false };
      }
      const hit = await caches.default.match(new Request(url(id)));
      return hit ? await hit.json() : { used: 0, tripped: false };
    } catch (_) { return { used: 0, tripped: false }; }
  }
  async function write(id, v) {
    try {
      if (kv) { await kv.put(key(id), JSON.stringify(v), { expirationTtl: 60 * 60 * 24 * 40 }); return; }
      await caches.default.put(
        new Request(url(id)),
        new Response(JSON.stringify(v), {
          headers: { "Content-Type": "application/json", "Cache-Control": "max-age=3456000" }
        })
      );
    } catch (_) {}
  }
  return {
    backend: kv ? "kv" : "cache",
    read,
    async bump(id) { const v = await read(id); v.used = (v.used || 0) + 1; await write(id, v); return v; },
    async trip(id) { const v = await read(id); v.tripped = true; await write(id, v); return v; }
  };
}

/* ------------------------------------------------- compteur officiel SerpApi
   account.json est gratuit et NE CONSOMME PAS de recherche. Mis en cache 60 s
   pour ne pas le rappeler à chaque double-tap. */
async function serpAccount(env, ctx) {
  const ck = new Request("https://escale.cache/serp-account");
  try {
    const hit = await caches.default.match(ck);
    if (hit) return await hit.json();
  } catch (_) {}
  try {
    const r = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(env.SERP_TOKEN)}`,
      { headers: { Accept: "application/json" } });
    const j = await r.json();
    const out = {
      used: typeof j.this_month_usage === "number" ? j.this_month_usage : null,
      limit: typeof j.searches_per_month === "number" ? j.searches_per_month : null,
      left: typeof j.total_searches_left === "number" ? j.total_searches_left : null,
      hour_used: j.this_hour_searches ?? null,
      hour_limit: j.account_rate_limit_per_hour ?? null,
      renewal: j.plan_renewal_date || null,
      ok: true
    };
    ctx.waitUntil(caches.default.put(ck, new Response(JSON.stringify(out), {
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=60" }
    })));
    return out;
  } catch (_) {
    return { ok: false, used: null, limit: null, left: null };
  }
}

/* ------------------------------------------------------------- normalisation
   SerpApi et SearchApi renvoient la même forme (best_flights / other_flights),
   d'où un seul parseur pour les deux. */
function normalize(j, provider) {
  const all = [].concat(j?.best_flights || [], j?.other_flights || [])
                .filter(o => typeof o?.price === "number");
  all.sort((a, b) => a.price - b.price);
  const best = all[0] || null;
  const legs = best?.flights || [];
  const meta = j?.search_metadata || {};
  return {
    price: best ? best.price : null,
    currency: "EUR",
    airlines: [...new Set(legs.map(f => f.airline).filter(Boolean))],
    stops: legs.length ? legs.length - 1 : null,
    duration: best?.total_duration ?? null,
    departure_time: legs[0]?.departure_airport?.time || null,
    arrival_time: legs.length ? legs[legs.length - 1]?.arrival_airport?.time || null : null,
    offers: all.length,
    insights: j?.price_insights ? {
      lowest: j.price_insights.lowest_price ?? null,
      level: j.price_insights.price_level ?? null,
      typical: j.price_insights.typical_price_range ?? null
    } : null,
    url: meta.google_flights_url || meta.request_url || null,
    provider
  };
}

const quotaError = (t) => /quota|run out|exceed|limit|insufficient|credit|402|429/i.test(String(t || ""));

/* ---------------------------------------------------------------- requêtes */
async function callSerp(env, o, d, dep, ret) {
  const u = new URL("https://serpapi.com/search.json");
  u.searchParams.set("engine", "google_flights");
  u.searchParams.set("departure_id", o);
  u.searchParams.set("arrival_id", d);
  u.searchParams.set("outbound_date", dep);
  if (ret) u.searchParams.set("return_date", ret);
  u.searchParams.set("type", ret ? "1" : "2");         // 1 = A/R, 2 = aller simple
  u.searchParams.set("currency", "EUR");
  u.searchParams.set("hl", "fr");
  u.searchParams.set("gl", "fr");
  u.searchParams.set("api_key", env.SERP_TOKEN);
  const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  return await r.json();
}

async function callSearchApi(env, o, d, dep, ret) {
  const u = new URL("https://www.searchapi.io/api/v1/search");
  u.searchParams.set("engine", "google_flights");
  u.searchParams.set("departure_id", o);
  u.searchParams.set("arrival_id", d);
  u.searchParams.set("outbound_date", dep);
  if (ret) u.searchParams.set("return_date", ret);
  u.searchParams.set("flight_type", ret ? "round_trip" : "one_way");
  u.searchParams.set("currency", "EUR");
  u.searchParams.set("hl", "fr");
  u.searchParams.set("gl", "fr");
  u.searchParams.set("api_key", env.SEARCHAPI_TOKEN);
  const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  return await r.json();
}

/* ------------------------------------------------------------ état des quotas */
async function status(env, ctx) {
  const led = ledger(env);
  const out = { configured: false, backend: led.backend, providers: [], active: null, total_left: 0 };

  if (env.SERP_TOKEN) {
    const budget = parseInt(env.SERP_BUDGET || "249", 10);
    const acc = await serpAccount(env, ctx);
    const local = await led.read("serpapi");
    const used = acc.used != null ? acc.used : (local.used || 0);
    const left = Math.max(0, budget - used);
    out.providers.push({
      id: "serpapi", label: "SerpApi · Google Flights",
      used, budget, left,
      counter: acc.ok ? "compte SerpApi (officiel)" : "local (compte injoignable)",
      hour_used: acc.hour_used, hour_limit: acc.hour_limit,
      renewal: acc.renewal,
      available: left > 0 && !local.tripped
    });
  }
  if (env.SEARCHAPI_TOKEN) {
    const budget = parseInt(env.SEARCHAPI_BUDGET || "99", 10);
    const l = await led.read("searchapi");
    const left = Math.max(0, budget - (l.used || 0));
    out.providers.push({
      id: "searchapi", label: "SearchApi.io · Google Flights (relais)",
      used: l.used || 0, budget, left,
      counter: "local (" + led.backend + ")",
      available: left > 0 && !l.tripped
    });
  }

  out.configured = out.providers.length > 0;
  const first = out.providers.find(p => p.available);
  out.active = first ? first.id : null;
  out.total_left = out.providers.reduce((a, p) => a + (p.available ? p.left : 0), 0);
  out.exhausted = out.configured && !out.active;
  return out;
}

/* -------------------------------------------------------------- handler */
export async function onRequest(context) {
  const { request, env } = context;
  const p = new URL(request.url).searchParams;
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

  const origin      = (p.get("origin")      || "").toUpperCase();
  const destination = (p.get("destination") || "").toUpperCase();
  const depart = p.get("depart") || "";
  const ret    = p.get("return") || "";

  const st = await status(env, context);

  // Aucun paramètre → simple état des quotas, aucun crédit consommé.
  if (!origin && !destination && !depart) return json(st);

  if (!st.configured) return json({ configured: false, reason: "aucune clé de prix live configurée" });
  if (!origin || !destination || !depart)
    return json({ ...st, error: "origin, destination et depart requis" }, 400);

  // --- cache résultat : même route + mêmes dates = 0 crédit pendant LIVE_TTL ---
  const ttl = parseInt(env.LIVE_TTL || "21600", 10);
  const ck = new Request(`https://escale.cache/live/${origin}-${destination}-${depart}-${ret || "ow"}`);
  try {
    const hit = await caches.default.match(ck);
    if (hit) return json({ ...(await hit.json()), cached: true, quota: st });
  } catch (_) {}

  if (st.exhausted)
    return json({ configured: true, price: null, exhausted: true, quota: st,
                  note: "quota live épuisé pour ce mois — les prix affichés restent ceux du cache Aviasales" });

  const led = ledger(env);
  const tried = [];

  for (const prov of st.providers) {
    if (!prov.available) continue;
    try {
      const raw = prov.id === "serpapi"
        ? await callSerp(env, origin, destination, depart, ret)
        : await callSearchApi(env, origin, destination, depart, ret);

      const err = raw?.error || raw?.message;
      if (err) {
        tried.push({ provider: prov.id, error: String(err) });
        if (quotaError(err)) { await led.trip(prov.id); continue; }   // → fournisseur suivant
        continue;
      }

      await led.bump(prov.id);                       // compteur interne (relais + secours)
      const out = { configured: true, origin, destination, depart, return: ret || null,
                    ...normalize(raw, prov.id), fetched_at: new Date().toISOString() };

      if (out.price != null) {
        context.waitUntil(caches.default.put(ck, new Response(JSON.stringify(out), {
          headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${ttl}` }
        })));
      }
      // état recalculé après consommation, pour que l'app affiche le bon reste
      return json({ ...out, tried, quota: await status(env, context) });

    } catch (e) {
      tried.push({ provider: prov.id, error: String(e) });
    }
  }

  return json({ configured: true, price: null, tried, quota: await status(env, context),
                error: "aucun fournisseur n'a pu répondre" }, 502);
}
