export default async function handler(req, res) {
  const API_KEY = process.env.API_FOOTBALL_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Falta configurar API_FOOTBALL_KEY en las variables de entorno de Vercel.",
    });
  }

  // Parámetros opcionales desde la URL, por ejemplo:
  //   /api/matches                          -> próximos 10 partidos de LaLiga
  //   /api/matches?league=39&season=2026     -> próximos partidos de otra liga/temporada
  //   /api/matches?live=all                  -> todos los partidos en vivo ahora mismo
  const { league, season, next, live } = req.query;

  const params = new URLSearchParams();

  if (live) {
    // Modo "en vivo": ignora league/season/next y pide todos los partidos en juego.
    params.set("live", live); // normalmente "all"
  } else {
    // Modo "próximos partidos": por defecto LaLiga (140), temporada actual, 10 partidos.
    params.set("league", league || "140");
    params.set("season", season || String(new Date().getFullYear()));
    params.set("next", next || "10");
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?${params.toString()}`,
      {
        headers: {
          "x-apisports-key": API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        ok: false,
        error: `API-Football respondió con estado ${response.status}: ${errorText}`,
      });
    }

    const data = await response.json();

    // API-Football devuelve 200 incluso cuando hay un error de parámetros;
    // los errores reales vienen dentro de data.errors.
    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(400).json({
        ok: false,
        error: JSON.stringify(data.errors),
      });
    }

    return res.status(200).json({
      ok: true,
      data: data,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
