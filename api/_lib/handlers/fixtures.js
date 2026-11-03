// Partidos de LaLiga de football-data.org (últimas 3 semanas y próximos
// 10 días) con el árbitro designado. Lo usa el job diario del backend:
// el árbitro mejora claramente el modelo de tarjetas, y football-data.co.uk
// (la fuente de estadísticas) no lo publica para España.
//
// Variable de entorno requerida en Vercel: FOOTBALL_DATA_API_KEY (la misma
// que ya usa /api/standings). Si el plan gratuito no trae árbitros, la
// lista sale sin ellos y el modelo sigue sin árbitro (no se inventa nada).

export default async function handler(req, res) {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    return res.status(500).json({ ok: false, error: "Falta configurar FOOTBALL_DATA_API_KEY en Vercel." });
  }
  const day = (offset) => new Date(Date.now() + offset * 86400e3).toISOString().slice(0, 10);
  const params = new URLSearchParams({ dateFrom: day(-21), dateTo: day(10) });
  try {
    const response = await fetch(`https://api.football-data.org/v4/competitions/PD/matches?${params}`, { headers: { "X-Auth-Token": token } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      return res.status(response.status || 502).json({ ok: false, error: data?.message || `football-data.org respondió con estado ${response.status}.` });
    }
    const matches = (data.matches || []).map((m) => ({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      matchday: m.matchday,
      home: m.homeTeam?.name,
      away: m.awayTeam?.name,
      score: m.score?.fullTime ?? null,
      referee: (m.referees || []).find((r) => r.type === "REFEREE")?.name || null,
    }));
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({ ok: true, matches });
  } catch (error) {
    return res.status(502).json({ ok: false, error: `No se pudo contactar con football-data.org: ${error.message}` });
  }
}
