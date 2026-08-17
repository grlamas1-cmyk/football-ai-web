// Sincronización diaria de resultados reales: es lo que hace que el
// modelo "se vaya actualizando con los partidos que se van jugando" en
// vez de quedarse congelado en mayo de 2026. Programada como Vercel
// Cron (ver vercel.json) — Vercel la llama sola, no hace falta que
// nadie la ejecute a mano.
//
// Qué hace, paso a paso:
//   1. Pide a tu backend Python la lista real de equipos (/teams).
//   2. Pide a The Odds API los partidos completados de los últimos 2
//      días (su endpoint /scores, gratis, sin límite de temporada).
//   3. Para cada partido completado, intenta reconocer los dos equipos
//      contra la lista real del modelo (misma lógica de alias que usa
//      el sitio, ver api/_lib/teamAliases.js). Si no reconoce alguno,
//      SE SALTA ese partido — mejor perderse una actualización que
//      etiquetar mal un resultado.
//   4. Manda los partidos reconocidos a tu backend Python
//      (POST /sync-results, protegido con SYNC_SECRET), que es quien
//      de verdad actualiza el modelo y sube el estado a GitHub.
//
// Variables de entorno requeridas en Vercel:
//   ODDS_API_KEY   — la misma que ya usas para las cuotas.
//   PYTHON_API_URL — la misma que ya usas para /api/predict.
//   SYNC_SECRET    — clave compartida con Render (debe ser IDÉNTICA a
//                    la variable SYNC_SECRET del backend Python).

import { resolveTeamName } from "../_lib/teamAliases.js";

function seasonFromDate(isoDate) {
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= 8 ? `${year}/${String(year + 1).slice(2)}` : `${year - 1}/${String(year).slice(2)}`;
}

export default async function handler(req, res) {
  // Si configuras CRON_SECRET en Vercel (opcional, Settings → Environment
  // Variables), Vercel manda automáticamente esta cabecera al disparar el
  // cron — así nadie más puede llamar a esta URL desde fuera y gastar tu
  // cupo de The Odds API. Si no la configuras, esto no bloquea nada.
  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: "No autorizado." });
  }

  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const PYTHON_API_URL = process.env.PYTHON_API_URL;
  const SYNC_SECRET = process.env.SYNC_SECRET;

  if (!ODDS_API_KEY || !PYTHON_API_URL || !SYNC_SECRET) {
    return res.status(500).json({
      ok: false,
      error: "Faltan variables de entorno (ODDS_API_KEY, PYTHON_API_URL y/o SYNC_SECRET) en Vercel.",
    });
  }

  const base = PYTHON_API_URL.replace(/\/+$/, "");

  try {
    const teamsRes = await fetch(`${base}/teams`);
    const teamsJson = await teamsRes.json();
    const modelTeams = teamsJson.teams || teamsJson.data?.teams || [];
    if (!teamsRes.ok || modelTeams.length === 0) {
      return res.status(502).json({ ok: false, error: "No se pudo obtener la lista de equipos del backend Python." });
    }

    const scoresRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/soccer_spain_la_liga/scores/?apiKey=${ODDS_API_KEY}&daysFrom=2`
    );
    const events = await scoresRes.json();
    if (!scoresRes.ok || !Array.isArray(events)) {
      return res.status(502).json({
        ok: false,
        error: `The Odds API (scores) respondió con estado ${scoresRes.status}: ${JSON.stringify(events).slice(0, 300)}`,
      });
    }

    const results = [];
    const unresolved = [];

    for (const ev of events) {
      if (!ev.completed || !Array.isArray(ev.scores)) continue;

      const homeEntry = ev.scores.find((s) => s.name === ev.home_team);
      const awayEntry = ev.scores.find((s) => s.name === ev.away_team);
      if (!homeEntry || !awayEntry) continue;

      const homeGoals = parseInt(homeEntry.score, 10);
      const awayGoals = parseInt(awayEntry.score, 10);
      if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) continue;

      const home = resolveTeamName(ev.home_team, modelTeams);
      const away = resolveTeamName(ev.away_team, modelTeams);
      if (!home || !away) {
        unresolved.push({ home: ev.home_team, away: ev.away_team, reason: !home ? "home no reconocido" : "away no reconocido" });
        continue;
      }

      const matchDate = (ev.commence_time || "").slice(0, 10);
      results.push({
        match_id: ev.id,
        home_team: home,
        away_team: away,
        match_date: matchDate,
        season: seasonFromDate(matchDate),
        home_goals: homeGoals,
        away_goals: awayGoals,
      });
    }

    if (results.length === 0) {
      return res.status(200).json({
        ok: true,
        message: "Sin partidos nuevos completados que sincronizar.",
        unresolved,
      });
    }

    const syncRes = await fetch(`${base}/sync-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": SYNC_SECRET },
      body: JSON.stringify({ results }),
    });
    const syncJson = await syncRes.json();

    return res.status(syncRes.ok ? 200 : 502).json({
      ok: syncRes.ok,
      sync: syncJson,
      unresolved,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
