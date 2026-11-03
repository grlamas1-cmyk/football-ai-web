// Cuotas de mercados "extra" de UN partido (ambos marcan, córners,
// tarjetas): The Odds API solo los da partido a partido. Lo usa el job
// diario del backend para los partidos de las próximas 48 h. Lista de
// mercados cerrada y caché de 1 h por el mismo motivo que /api/odds:
// cada mercado devuelto cuesta 1 crédito del plan gratuito.

const ALLOWED_MARKETS = new Set(["btts", "alternate_totals_corners", "alternate_totals_cards", "alternate_totals"]);

export default async function handler(req, res) {
  const API_KEY = process.env.ODDS_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ ok: false, error: "Falta configurar ODDS_API_KEY en las variables de entorno de Vercel." });
  }
  const eventId = String(req.query.eventId || "");
  if (!/^[a-f0-9]{32}$/.test(eventId)) {
    return res.status(400).json({ ok: false, error: "eventId no válido." });
  }
  const markets = String(req.query.markets || "btts")
    .split(",").map((m) => m.trim()).filter((m) => ALLOWED_MARKETS.has(m));
  if (markets.length === 0) {
    return res.status(400).json({ ok: false, error: "Ningún mercado permitido." });
  }
  const params = new URLSearchParams({ apiKey: API_KEY, regions: "eu", markets: [...new Set(markets)].sort().join(","), oddsFormat: "decimal" });

  try {
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer_spain_la_liga/events/${eventId}/odds?${params.toString()}`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      return res.status(response.status || 502).json({ ok: false, error: data?.message || `The Odds API respondió con estado ${response.status}.` });
    }
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ ok: false, error: `No se pudo contactar con The Odds API: ${error.message}` });
  }
}
