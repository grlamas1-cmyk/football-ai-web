// Clasificación real de LaLiga. Dos fuentes, por este orden:
//
//   1) football-data.org (v4) — variable de entorno FOOTBALL_DATA_API_KEY.
//      Su plan GRATUITO cubre la TEMPORADA ACTUAL de las 12 competiciones
//      top (incluida LaLiga) — justo lo contrario de API-Football, cuyo
//      plan gratuito NO da acceso a la temporada en curso (solo 2022-2024,
//      comprobado en producción: "Free plans do not have access to this
//      season"). Consigue una clave gratis en https://www.football-data.org/client/register
//      (10 peticiones/minuto en el plan gratuito, de sobra para esta web).
//
//   2) API_FOOTBALL_KEY (API-Football) — se deja como alternativa por si
//      en algún momento subes de plan ahí; hoy fallará con el mismo
//      "Free plans do not have access to this season" si tu plan sigue
//      siendo gratuito.
//
// Si no hay ninguna clave configurada, o las dos fallan, se devuelve un
// error claro (nunca datos inventados).
//
// El frontend (loadRealStandings en index.html) espera SIEMPRE el mismo
// formato, el de API-Football: { response: [ { league: { standings:
// [ [ {rank, team:{name}, points, form, all:{played,win,draw,lose,
// goals:{for,against}}} , ... ] ] } } ] }. Por eso, cuando se usa
// football-data.org, su respuesta se normaliza aquí a esa misma forma
// — así el frontend no necesita saber de qué proveedor viene el dato.

// Mapeo de los IDs de liga de API-Football (los que ya usa esta web) a
// los códigos de competición de football-data.org.
const LEAGUE_ID_TO_FD_CODE = {
  "140": "PD", // LaLiga
  "39": "PL", // Premier League
  "78": "BL1", // Bundesliga
  "135": "SA", // Serie A
  "61": "FL1", // Ligue 1
  "2": "CL", // Champions League
};

async function fetchFromFootballData(leagueId) {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) return { ok: false, error: "FOOTBALL_DATA_API_KEY no configurada." };

  const code = LEAGUE_ID_TO_FD_CODE[leagueId] || "PD";

  const response = await fetch(`https://api.football-data.org/v4/competitions/${code}/standings`, {
    headers: { "X-Auth-Token": token },
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: `Respuesta no-JSON de football-data.org (estado ${response.status}): ${text.slice(0, 300)}` };
  }
  if (!response.ok) {
    return { ok: false, error: data.message || `football-data.org respondió con estado ${response.status}.` };
  }

  const table = data.standings?.find((s) => s.type === "TOTAL")?.table || data.standings?.[0]?.table;
  if (!table || table.length === 0) {
    return { ok: false, error: "football-data.org no devolvió tabla de clasificación." };
  }

  // Normalizado a la forma que ya espera el frontend (estilo API-Football).
  const normalized = {
    response: [
      {
        league: {
          standings: [
            table.map((row) => ({
              rank: row.position,
              team: { name: row.team.name },
              points: row.points,
              form: row.form || "",
              all: {
                played: row.playedGames,
                win: row.won,
                draw: row.draw,
                lose: row.lost,
                goals: { for: row.goalsFor, against: row.goalsAgainst },
              },
            })),
          ],
        },
      },
    ],
  };
  return { ok: true, data: normalized };
}

async function fetchFromApiFootball(leagueId, season) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return { ok: false, error: "API_FOOTBALL_KEY no configurada." };

  const params = new URLSearchParams({ league: leagueId, season });
  const response = await fetch(`https://v3.football.api-sports.io/standings?${params.toString()}`, {
    headers: { "x-apisports-key": apiKey },
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: `Respuesta no-JSON de API-Football (estado ${response.status}): ${text.slice(0, 300)}` };
  }
  if (!response.ok) {
    return { ok: false, error: `API-Football respondió con estado ${response.status}.` };
  }
  if (data.errors && Object.keys(data.errors).length > 0) {
    return { ok: false, error: JSON.stringify(data.errors) };
  }
  return { ok: true, data };
}

export default async function handler(req, res) {
  const { league, season } = req.query;
  const leagueId = league || "140";
  const seasonYear = season || String(new Date().getFullYear());

  const fromFootballData = await fetchFromFootballData(leagueId);
  if (fromFootballData.ok) {
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ ...fromFootballData.data, _source: "football-data.org" });
  }

  const fromApiFootball = await fetchFromApiFootball(leagueId, seasonYear);
  if (fromApiFootball.ok) {
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ ...fromApiFootball.data, _source: "API-Football" });
  }

  return res.status(502).json({
    ok: false,
    error: `Sin clasificación real disponible. football-data.org: ${fromFootballData.error} | API-Football: ${fromApiFootball.error}`,
  });
}
