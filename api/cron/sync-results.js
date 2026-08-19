// Sincronización diaria: es lo que hace que el modelo "se vaya
// actualizando con los partidos que se van jugando" en vez de quedarse
// congelado en mayo de 2026, Y lo que alimenta el histórico público de
// aciertos (ver estadisticas.html). Programada como Vercel Cron (ver
// vercel.json) — Vercel la llama sola, no hace falta que nadie la
// ejecute a mano.
//
// Qué hace, paso a paso:
//   1. Pide a tu backend Python la lista real de equipos (/teams).
//   2. RESULTADOS: pide a The Odds API los partidos completados de los
//      últimos 2 días (su endpoint /scores, gratis, sin límite de
//      temporada), reconoce los equipos y manda los resultados a tu
//      backend (POST /sync-results) — actualiza el modelo, sube el
//      estado a GitHub, Y resuelve el histórico de predicciones de esos
//      partidos si los habíamos predicho antes.
//   3. HISTÓRICO: pide a The Odds API los próximos partidos con cuotas
//      (su endpoint /odds, el mismo que ya usa la web), predice cada uno
//      con el modelo real (mismas cuotas de mercado que vería un
//      usuario) y guarda esa "foto" en el backend (POST
//      /snapshot-predictions) — así queda registrado ANTES de que se
//      juegue, para poder comparar después contra el resultado real.
//      No duplica: si un partido ya tiene foto guardada, se salta.
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

// Cuota media 1X2 entre todas las casas que ofrece el evento — mismo
// criterio que usa la web (getOddsInputs en common.js) para que la
// predicción guardada en el histórico sea la misma que vería un usuario
// real ese día.
function averageMarketOdds(event) {
  const home = [], draw = [], away = [];
  for (const bookmaker of event.bookmakers || []) {
    const outcomes = bookmaker.markets?.[0]?.outcomes || [];
    const price = (name) => outcomes.find((o) => o.name === name)?.price;
    const h = price(event.home_team), d = price("Draw"), a = price(event.away_team);
    if (typeof h === "number") home.push(h);
    if (typeof d === "number") draw.push(d);
    if (typeof a === "number") away.push(a);
  }
  const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  return { odds_h: avg(home), odds_d: avg(draw), odds_a: avg(away) };
}

async function syncCompletedResults(base, ODDS_API_KEY, SYNC_SECRET, modelTeams) {
  const scoresRes = await fetch(
    `https://api.the-odds-api.com/v4/sports/soccer_spain_la_liga/scores/?apiKey=${ODDS_API_KEY}&daysFrom=2`
  );
  const events = await scoresRes.json();
  if (!scoresRes.ok || !Array.isArray(events)) {
    return { ok: false, error: `The Odds API (scores) respondió con estado ${scoresRes.status}: ${JSON.stringify(events).slice(0, 300)}` };
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
    return { ok: true, message: "Sin partidos nuevos completados que sincronizar.", unresolved };
  }

  const syncRes = await fetch(`${base}/sync-results`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sync-secret": SYNC_SECRET },
    body: JSON.stringify({ results }),
  });
  const syncJson = await syncRes.json();
  return { ok: syncRes.ok, sync: syncJson, unresolved };
}

async function snapshotUpcomingPredictions(base, ODDS_API_KEY, SYNC_SECRET, modelTeams) {
  const oddsRes = await fetch(
    `https://api.the-odds-api.com/v4/sports/soccer_spain_la_liga/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`
  );
  const events = await oddsRes.json();
  if (!oddsRes.ok || !Array.isArray(events)) {
    return { ok: false, error: `The Odds API (odds) respondió con estado ${oddsRes.status}: ${JSON.stringify(events).slice(0, 300)}` };
  }

  const skipped = [];

  // Primera pasada: resolver equipos y cuotas (rápido, sin red externa
  // aparte de lo ya descargado). Segunda pasada: pedir /predict a todos
  // los partidos resueltos EN PARALELO (Promise.all), no uno a uno — con
  // ~12 partidos y el backend recién "despertando" en Render, hacerlo en
  // serie podría superar el límite de tiempo de la función (ver
  // maxDuration en vercel.json).
  const candidates = [];
  for (const ev of events) {
    const home = resolveTeamName(ev.home_team, modelTeams);
    const away = resolveTeamName(ev.away_team, modelTeams);
    if (!home || !away) {
      skipped.push({ home: ev.home_team, away: ev.away_team, reason: !home ? "home no reconocido" : "away no reconocido" });
      continue;
    }

    const { odds_h, odds_d, odds_a } = averageMarketOdds(ev);
    if (!odds_h || !odds_d || !odds_a) {
      skipped.push({ home: ev.home_team, away: ev.away_team, reason: "sin cuotas 1X2 usables" });
      continue;
    }

    candidates.push({ ev, home, away, odds_h, odds_d, odds_a, matchDate: (ev.commence_time || "").slice(0, 10) });
  }

  const predictions = await Promise.all(candidates.map(async (c) => {
    try {
      const predictRes = await fetch(`${base}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_team: c.home, away_team: c.away, match_date: c.matchDate, season: seasonFromDate(c.matchDate),
          odds_h: c.odds_h, odds_d: c.odds_d, odds_a: c.odds_a,
        }),
      });
      const predictJson = await predictRes.json();
      if (!predictRes.ok || !predictJson.ok) {
        return { skipped: { home: c.home, away: c.away, reason: predictJson.error || `predict respondió ${predictRes.status}` } };
      }
      const { con_cuotas, sin_cuotas } = predictJson.data;
      return {
        snapshot: {
          match_id: c.ev.id,
          home_team: c.home,
          away_team: c.away,
          match_date: c.matchDate,
          season: seasonFromDate(c.matchDate),
          con_cuotas: { probabilities: con_cuotas.probabilities, prediction: con_cuotas.prediction },
          sin_cuotas: { probabilities: sin_cuotas.probabilities, prediction: sin_cuotas.prediction },
        },
      };
    } catch (error) {
      return { skipped: { home: c.home, away: c.away, reason: error.message } };
    }
  }));

  const snapshots = [];
  for (const p of predictions) {
    if (p.snapshot) snapshots.push(p.snapshot);
    else skipped.push(p.skipped);
  }

  if (snapshots.length === 0) {
    return { ok: true, message: "Sin predicciones nuevas que guardar en el histórico.", skipped };
  }

  const snapshotRes = await fetch(`${base}/snapshot-predictions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sync-secret": SYNC_SECRET },
    body: JSON.stringify({ snapshots }),
  });
  const snapshotJson = await snapshotRes.json();
  return { ok: snapshotRes.ok, snapshot: snapshotJson, skipped };
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

    const results = await syncCompletedResults(base, ODDS_API_KEY, SYNC_SECRET, modelTeams);
    const snapshot = await snapshotUpcomingPredictions(base, ODDS_API_KEY, SYNC_SECRET, modelTeams);

    return res.status(200).json({ ok: results.ok && snapshot.ok, results, snapshot });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
