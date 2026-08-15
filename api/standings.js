// Proxy hacia API-Football (/standings) para la clasificación real de
// LaLiga. Reutiliza la misma clave que api/matches.js.
//
// Antes de esta función, index.html ya llamaba a /api/standings (ver
// loadRealStandings en el <script>), pero este archivo no existía en el
// repo: la petición siempre fallaba y la web se quedaba con las
// tarjetas de estadísticas de ejemplo, sin avisar de forma visible.
//
// El frontend espera la respuesta de API-Football tal cual (sin
// envolver en {ok, data}), igual que hace api/odds.js con The Odds API.

export default async function handler(req, res) {
  const API_KEY = process.env.API_FOOTBALL_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Falta configurar API_FOOTBALL_KEY en las variables de entorno de Vercel.",
    });
  }

  const { league, season } = req.query;

  const params = new URLSearchParams({
    league: league || "140",
    season: season || String(new Date().getFullYear()),
  });

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/standings?${params.toString()}`,
      {
        headers: {
          "x-apisports-key": API_KEY,
        },
      }
    );

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: `Respuesta no-JSON de API-Football (estado ${response.status}): ${text.slice(0, 300)}`,
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `API-Football respondió con estado ${response.status}.`,
      });
    }

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(400).json({
        ok: false,
        error: JSON.stringify(data.errors),
      });
    }

    // Cachea 5 minutos en el edge: la clasificación no cambia entre jornadas.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: `No se pudo contactar con API-Football: ${error.message}`,
    });
  }
}
