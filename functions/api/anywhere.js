// Cloudflare Pages Function — recherche « n'importe où » (façon Explore).
// Emplacement : functions/api/anywhere.js  →  /api/anywhere
//
// Renvoie le vol le moins cher VERS CHAQUE destination au départ d'un aéroport.
// Utilise aviasales/v3/prices_for_dates avec seulement l'origine + unique=true.
//
// Appel : /api/anywhere?origin=NTE&month=2026-03&oneway=0

export async function onRequest(context) {
  const { request, env } = context;
  const p = new URL(request.url).searchParams;

  const origin = (p.get("origin") || "").toUpperCase();
  const month  = p.get("month") || "";        // YYYY-MM (optionnel)
  const oneway = p.get("oneway") === "1";

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=3600"
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!origin)
    return new Response(JSON.stringify({ error: "origin requis" }), { status: 400, headers: cors });
  if (!env.TP_TOKEN)
    return new Response(JSON.stringify({ error: "TP_TOKEN non configuré" }), { status: 500, headers: cors });

  const api = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  api.searchParams.set("origin", origin);              // pas de destination = partout
  api.searchParams.set("unique", "true");              // 1 résultat par destination
  api.searchParams.set("sorting", "price");
  api.searchParams.set("one_way", oneway ? "true" : "false");
  api.searchParams.set("direct", "false");
  api.searchParams.set("currency", "eur");
  api.searchParams.set("limit", "1000");
  if (month) {
    api.searchParams.set("departure_at", month);
    if (!oneway) api.searchParams.set("return_at", month);
  }
  api.searchParams.set("token", env.TP_TOKEN);

  try {
    const r = await fetch(api.toString(), { headers: { "Accept": "application/json" } });
    const j = await r.json();
    const rows = Array.isArray(j?.data) ? j.data : [];
    const out = rows.map(o => ({
      destination: o.destination,
      price: o.price,
      transfers: o.transfers ?? null,
      duration_to: o.duration_to ?? null,   // durée aller (min) — pour le filtre durée
      departure_at: o.departure_at || null,
      return_at: o.return_at || null,
      link: o.link ? "https://www.aviasales.com" + o.link : null
    })).filter(o => typeof o.price === "number")
       .sort((a, b) => a.price - b.price);

    return new Response(JSON.stringify({ origin, month: month || null, count: out.length, results: out }),
      { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: "échec appel Travelpayouts", detail: String(e) }),
      { status: 502, headers: cors });
  }
}
