// Proxy hacia The Odds API (https://the-odds-api.com): cuotas reales de
// LaLiga de ~20 casas europeas. Devuelve el array de eventos tal cual
// (sin envolver en {ok, data}), que es lo que esperan common.js y el job
// diario del backend.
//
// ?markets= admite h2h (1X2), totals (más/menos goles) y spreads
// (hándicap asiático). OJO: The Odds API cobra 1 crédito por mercado en
// cada llamada (plan gratuito: 500/mes), por eso la lista está cerrada y
// la respuesta se cachea 30 min en el edge de Vercel — con el caché de
// 60 s que había antes, unas pocas visitas al día bastaban para agotar el
// cupo mensual.
//
// ?sport= elige la liga (lista cerrada, ver leagues.py del backend; por
// defecto LaLiga). ?events=1 devuelve solo el calendario, SIN cuotas:
// ese endpoint de The Odds API no gasta créditos y el job lo usa para no
// pedir cuotas los días sin partido.
//
// Reenvía el saldo de créditos (cabeceras X-Odds-Remaining / X-Odds-Used)
// para que el job diario no agote el plan gratuito.
//
// Variable de entorno requerida en Vercel: ODDS_API_KEY

const ALLOWED_MARKETS = new Set(["h2h", "totals", "spreads"]);
const ALLOWED_SPORTS = new Set(["soccer_spain_la_liga", "soccer_italy_serie_a", "soccer_epl", "soccer_germany_bundesliga"]);

export default async function handler(req, res) {
  const API_KEY = process.env.ODDS_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ ok: false, error: "Falta configurar ODDS_API_KEY en las variables de entorno de Vercel." });
  }

  const sport = ALLOWED_SPORTS.has(String(req.query.sport)) ? String(req.query.sport) : "soccer_spain_la_liga";
  if (req.query.events) {
    try {
      const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${encodeURIComponent(API_KEY)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data)) {
        return res.status(response.status || 502).json({ ok: false, error: data?.message || `The Odds API respondió con estado ${response.status}.` });
      }
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600");
      return res.status(200).json(data);
    } catch (error) {
      return res.status(502).json({ ok: false, error: `No se pudo contactar con The Odds API: ${error.message}` });
    }
  }

  const markets = String(req.query.markets || "h2h")
    .split(",").map((m) => m.trim()).filter((m) => ALLOWED_MARKETS.has(m));
  const params = new URLSearchParams({
    apiKey: API_KEY,
    regions: "eu",
    markets: (markets.length ? [...new Set(markets)].sort() : ["h2h"]).join(","),
    oddsFormat: "decimal",
  });

  try {
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?${params.toString()}`);
    for (const [from, to] of [["x-requests-remaining", "X-Odds-Remaining"], ["x-requests-used", "X-Odds-Used"]]) {
      const value = response.headers.get(from);
      if (value) res.setHeader(to, value);
    }
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ ok: false, error: `Respuesta no-JSON de The Odds API (estado ${response.status}): ${text.slice(0, 300)}` });
    }
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: data.message || `The Odds API respondió con estado ${response.status}.` });
    }
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ ok: false, error: `No se pudo contactar con The Odds API: ${error.message}` });
  }
}
