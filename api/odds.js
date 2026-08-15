// Proxy hacia The Odds API (https://the-odds-api.com) para cuotas 1X2
// reales. El frontend (loadRealOdds en index.html) espera recibir
// directamente el array de eventos tal y como lo devuelve The Odds API
// (sin envolver en {ok, data}), así que este proxy lo reenvía tal cual.
//
// Variable de entorno requerida en Vercel: ODDS_API_KEY
// (clave gratuita en https://the-odds-api.com — el plan free da varios
// cientos de peticiones al mes).

export default async function handler(req, res) {
  const API_KEY = process.env.ODDS_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Falta configurar ODDS_API_KEY en las variables de entorno de Vercel.",
    });
  }

  const sportKey = req.query.league || "soccer_spain_la_liga";

  const params = new URLSearchParams({
    apiKey: API_KEY,
    regions: "eu",
    markets: "h2h",
    oddsFormat: "decimal",
  });

  try {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?${params.toString()}`
    );

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: `Respuesta no-JSON de The Odds API (estado ${response.status}): ${text.slice(0, 300)}`,
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data.message || `The Odds API respondió con estado ${response.status}.`,
      });
    }

    // Cachea 60s: las cuotas cambian, pero no hace falta pedirlas en cada tecla.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: `No se pudo contactar con The Odds API: ${error.message}`,
    });
  }
}
