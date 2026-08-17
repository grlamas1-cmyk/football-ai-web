/* Lógica compartida por todas las páginas de Football Analytics Pro:
   reconocimiento de nombres de equipo (alias + tolerancia a erratas),
   y carga de datos reales (partidos, cuotas, clasificación) desde las
   funciones serverless de este mismo sitio (/api/*).

   A propósito NO pinta nada en el DOM — cada página (partidos.html,
   cuotas.html...) llama a estas funciones para obtener los datos y
   luego decide cómo mostrarlos, porque cada página tiene sus propios
   elementos. Así este archivo sirve para las 6 páginas sin repetir
   código, sin necesitar un framework ni un paso de build.

   Cárgalo ANTES del <script> propio de cada página:
   <script src="common.js"></script>
*/

/* ---------------------------------------------------------
   Configuración de la liga (solo LaLiga: ver decisión de producto)
--------------------------------------------------------- */
const LEAGUE_ID = 140;                          // 140 = LaLiga (API-Football)
const SPORT_KEY = "soccer_spain_la_liga";        // The Odds API
const SEASON = new Date().getFullYear();

// Temporada europea (agosto→mayo) a partir de una fecha ISO.
function seasonFromDate(isoDate){
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= 8
    ? `${year}/${String(year + 1).slice(2)}`
    : `${year - 1}/${String(year).slice(2)}`;
}

/* ---------------------------------------------------------
   Reconocimiento de nombres de equipo — alias, apodos y
   tolerancia a erratas contra la lista real que conoce el modelo.
--------------------------------------------------------- */
const TEAM_ALIASES = {
  "real madrid": "Real Madrid",
  "madrid cf": "Real Madrid",
  "merengues": "Real Madrid",
  "fc barcelona": "Barcelona",
  "barcelona": "Barcelona",
  "barça": "Barcelona",
  "barsa": "Barcelona",
  "barza": "Barcelona",
  "culés": "Barcelona",
  "cules": "Barcelona",
  "atletico de madrid": "Atl. Madrid",
  "atletico madrid": "Atl. Madrid",
  "atlético de madrid": "Atl. Madrid",
  "atleti": "Atl. Madrid",
  "at. madrid": "Atl. Madrid",
  "colchoneros": "Atl. Madrid",
  "athletic club": "Ath Bilbao",
  "athletic bilbao": "Ath Bilbao",
  "athletic": "Ath Bilbao",
  "leones": "Ath Bilbao",
  "real betis": "Betis",
  "betis": "Betis",
  "béticos": "Betis",
  "beticos": "Betis",
  "verdiblancos": "Betis",
  "celta": "Celta Vigo",
  "celta de vigo": "Celta Vigo",
  "sevilla fc": "Sevilla",
  "sevilla": "Sevilla",
  "villarreal cf": "Villarreal",
  "villarreal": "Villarreal",
  "submarino amarillo": "Villarreal",
  "real sociedad": "Real Sociedad",
  "la real": "Real Sociedad",
  "ca osasuna": "Osasuna",
  "osasuna": "Osasuna",
  "el sadar": "Osasuna",
  "deportivo alaves": "Alaves",
  "deportivo alavés": "Alaves",
  "alaves": "Alaves",
  "alavés": "Alaves",
  "getafe cf": "Getafe",
  "getafe": "Getafe",
  "azulones": "Getafe",
  "rayo vallecano": "Rayo Vallecano",
  "rayo": "Rayo Vallecano",
  "vallecano": "Rayo Vallecano",
  "rcd espanyol de barcelona": "Espanyol",
  "rcd espanyol": "Espanyol",
  "espanyol": "Espanyol",
  "español": "Espanyol",
  "espanol": "Espanyol",
  "pericos": "Espanyol",
  "valencia cf": "Valencia",
  "valencia": "Valencia",
  "che": "Valencia",
  "elche cf": "Elche",
  "elche": "Elche",
  "levante ud": "Levante",
  "levante": "Levante",
  "mallorca": "Mallorca",
  "rcd mallorca": "Mallorca",
  "girona": "Girona",
  "girona fc": "Girona",
  "malaga cf": "Malaga",
  "malaga": "Malaga",
  "málaga": "Malaga",
  "boquerones": "Malaga",
  // Racing de Santander no tiene historial en el modelo (ver
  // COLD_START_TEAMS más abajo); se deja pasar igualmente porque
  // predict.py ya lo admite como equipo "en frío".
  "racing de santander": "Racing Santander",
  "r. racing club": "Racing Santander",
  "real racing club": "Racing Santander",
  "racing santander": "Racing Santander",
  "racinguistas": "Racing Santander",
  "racing": "Racing Santander",
  // RC Deportivo: clave real en el modelo es "La Coruna" (sin
  // "Deportivo" delante).
  "rc deportivo": "La Coruna",
  "rc deportivo la coruna": "La Coruna",
  "rc deportivo la coruña": "La Coruna",
  "deportivo de la coruna": "La Coruna",
  "deportivo de la coruña": "La Coruna",
  "deportivo": "La Coruna",
  "depor": "La Coruna",
  "la coruna": "La Coruna",
  "la coruña": "La Coruna",
};

function normalizeKey(name){
  return (name || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[.]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

// Normaliza las claves de TEAM_ALIASES una vez, para que coincidan
// siempre con normalizeKey() aunque se hayan escrito con tilde arriba
// (ej. "barça").
(function normalizeAliasKeysInPlace(){
  const normalized = {};
  Object.keys(TEAM_ALIASES).forEach(k => { normalized[normalizeKey(k)] = TEAM_ALIASES[k]; });
  Object.keys(TEAM_ALIASES).forEach(k => delete TEAM_ALIASES[k]);
  Object.assign(TEAM_ALIASES, normalized);
})();

// Equipos que el backend acepta a propósito aunque NO aparezcan en
// /api/teams (no tienen historial de entrenamiento): predict.py los
// trata como "en frío" en vez de rechazarlos.
const COLD_START_TEAMS = ["Racing Santander"];

// Distancia de Levenshtein — tolera erratas de escritura.
function levenshteinDistance(a, b){
  const m = a.length, n = b.length;
  if(m === 0) return n;
  if(n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for(let j = 0; j <= n; j++) prev[j] = j;
  for(let i = 1; i <= m; i++){
    curr[0] = i;
    for(let j = 1; j <= n; j++){
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function fuzzyFindTeam(key, candidateNames){
  if(key.length < 4) return null;
  let scored = candidateNames.map(name => {
    const normName = normalizeKey(name);
    const dist = levenshteinDistance(key, normName);
    const maxLen = Math.max(key.length, normName.length);
    return { name, dist, similarity: 1 - dist / maxLen };
  });
  scored = scored.filter(s => s.similarity >= 0.72 || s.dist <= 2);
  if(scored.length === 0) return null;
  scored.sort((a, b) => a.dist - b.dist);
  if(scored.length > 1 && scored[0].dist === scored[1].dist) return null;
  return scored[0].name;
}

// Lista real de equipos que conoce el modelo (GET /teams a través de
// /api/teams). Llama a loadModelTeams() al principio de cada página.
let MODEL_TEAMS = [];
let MODEL_TEAMS_READY = false;

async function loadModelTeams(){
  try {
    const res = await fetch("/api/teams");
    const data = await res.json();
    if(!res.ok || data.ok === false) throw new Error(data.error || "No disponible");
    MODEL_TEAMS = data.data?.teams || data.teams || [];
    MODEL_TEAMS_READY = Array.isArray(MODEL_TEAMS) && MODEL_TEAMS.length > 0;
  } catch (err) {
    console.warn("No se pudo cargar la lista de equipos del modelo (/api/teams): " + err.message);
  }
}

// Resuelve el nombre que escribe/menciona el usuario al nombre exacto
// que espera el modelo. Devuelve { name, ambiguous, candidates,
// noHistory, coldStart }.
function resolveModelTeamName(input){
  const key = normalizeKey(input);

  if(TEAM_ALIASES[key]){
    const aliasTarget = TEAM_ALIASES[key];
    if(COLD_START_TEAMS.includes(aliasTarget)){
      return { name: aliasTarget, ambiguous: false, candidates: [], noHistory: false, coldStart: true };
    }
    if(MODEL_TEAMS_READY && !MODEL_TEAMS.includes(aliasTarget)){
      const fuzzy = MODEL_TEAMS.find(t => normalizeKey(t) === normalizeKey(aliasTarget));
      if(fuzzy) return { name: fuzzy, ambiguous: false, candidates: [], noHistory: false };
      return { name: null, ambiguous: false, candidates: [], noHistory: true };
    }
    return { name: aliasTarget, ambiguous: false, candidates: [], noHistory: false };
  }

  if(MODEL_TEAMS_READY){
    const exact = MODEL_TEAMS.find(t => normalizeKey(t) === key);
    if(exact) return { name: exact, ambiguous: false, candidates: [], noHistory: false };

    const partials = MODEL_TEAMS.filter(t =>
      normalizeKey(t).includes(key) || key.includes(normalizeKey(t))
    );
    if(partials.length === 1) return { name: partials[0], ambiguous: false, candidates: [], noHistory: false };
    if(partials.length > 1) return { name: null, ambiguous: true, candidates: partials, noHistory: false };

    const fuzzyVsModel = fuzzyFindTeam(key, MODEL_TEAMS);
    if(fuzzyVsModel) return { name: fuzzyVsModel, ambiguous: false, candidates: [], noHistory: false, fuzzy: true };

    const aliasKeyMatch = fuzzyFindTeam(key, Object.keys(TEAM_ALIASES));
    if(aliasKeyMatch && TEAM_ALIASES[aliasKeyMatch]){
      const target = TEAM_ALIASES[aliasKeyMatch];
      if(MODEL_TEAMS.includes(target)) return { name: target, ambiguous: false, candidates: [], noHistory: false, fuzzy: true };
    }

    return { name: null, ambiguous: false, candidates: [], noHistory: true };
  }

  return { name: input, ambiguous: false, candidates: [], noHistory: false };
}

// Busca, dentro de un texto libre, qué equipos conocidos se mencionan
// (usado por el analizador de apuestas en lenguaje natural).
function extractTeamMentions(text){
  const norm = normalizeKey(text);
  const dict = new Map();
  Object.keys(TEAM_ALIASES).forEach(k => dict.set(k, TEAM_ALIASES[k]));
  MODEL_TEAMS.forEach(t => dict.set(normalizeKey(t), t));

  const found = [];
  dict.forEach((officialName, key) => {
    if(key.length < 3) return;
    const idx = norm.indexOf(key);
    if(idx !== -1) found.push({ officialName, idx, len: key.length });
  });

  const byOfficial = new Map();
  found.forEach(f => {
    const prev = byOfficial.get(f.officialName);
    if(!prev || f.len > prev.len) byOfficial.set(f.officialName, f);
  });

  return [...byOfficial.values()].sort((a, b) => a.idx - b.idx);
}

/* ---------------------------------------------------------
   Próximos partidos reales de LaLiga.
   Dos fuentes, por este orden: /api/matches (API-Football — falla en
   plan gratuito para la temporada en curso) y /api/odds (The Odds
   API — sí cubre la temporada actual). No pinta nada: rellena
   DEMO_FIXTURES y ya. Cada página decide cómo mostrarlo.
--------------------------------------------------------- */
let DEMO_FIXTURES = [];
let RAW_ODDS_EVENTS = [];

async function loadAllRealOdds(sportKey = SPORT_KEY){
  try {
    const res = await fetch(`/api/odds?league=${sportKey}`);
    const data = await res.json();
    if(!res.ok || !Array.isArray(data)) throw new Error((data && data.error) || "API de cuotas no disponible");
    RAW_ODDS_EVENTS = data;
  } catch (err) {
    console.warn("No se pudieron cargar las cuotas: " + err.message);
    RAW_ODDS_EVENTS = [];
  }
}

async function loadRealFixtures(leagueId = LEAGUE_ID, season = SEASON){
  let gotRealFixtures = false;

  try {
    const res = await fetch(`/api/matches?league=${leagueId}&season=${season}&next=10`);
    const data = await res.json();
    if(!res.ok || !data.ok) throw new Error(data.error || "API de calendario no disponible");

    const fixtures = (data.data.response || []).map(f => {
      const d = new Date(f.fixture.date);
      const dayName = d.toLocaleDateString("es-ES", { weekday: "long" });
      return {
        day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        time: d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "") + " " +
              d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        home: f.teams.home.name,
        away: f.teams.away.name,
        comp: `${f.league.name} · J.${String(f.league.round).replace(/\D/g, "") || "-"}`,
        liga: f.league.name,
        isoDate: f.fixture.date ? f.fixture.date.slice(0, 10) : null,
      };
    });

    if(fixtures.length === 0) throw new Error("Sin partidos próximos devueltos por la API");
    DEMO_FIXTURES = fixtures;
    gotRealFixtures = true;
  } catch (err) {
    console.warn("Calendario vía API-Football no disponible (motivo: " + err.message + ")");
  }

  if(!gotRealFixtures){
    try {
      await loadAllRealOdds(SPORT_KEY);
      if(RAW_ODDS_EVENTS.length === 0) throw new Error("Sin partidos devueltos por el proveedor de cuotas");

      DEMO_FIXTURES = RAW_ODDS_EVENTS.map(ev => {
        const d = new Date(ev.commence_time);
        const dayName = d.toLocaleDateString("es-ES", { weekday: "long" });
        return {
          day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
          time: d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "") + " " +
                d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          home: ev.home_team,
          away: ev.away_team,
          comp: "LaLiga",
          liga: "LaLiga",
          isoDate: ev.commence_time ? ev.commence_time.slice(0, 10) : null,
        };
      }).sort((a, b) => (a.isoDate || "").localeCompare(b.isoDate || "")).slice(0, 12);
      gotRealFixtures = true;
    } catch (err) {
      console.warn("Calendario en demo (tampoco hay partidos vía cuotas; motivo: " + err.message + ")");
    }
  }

  return gotRealFixtures;
}

/* ---------------------------------------------------------
   Cuotas reales de un partido concreto (comparador de casas).
--------------------------------------------------------- */
let ODDS_ROWS = [];
let ACTIVE_BOOKIES = new Set();
let ODDS_SOURCE = "demo"; // "demo" (no hay proveedor conectado) o "live"

async function loadRealOdds(homeTeam, awayTeam, sportKey = SPORT_KEY){
  try {
    let data = RAW_ODDS_EVENTS;
    if(!data || data.length === 0){
      const res = await fetch(`/api/odds?league=${sportKey}`);
      data = await res.json();
      if(!res.ok) throw new Error(data.error || "API de cuotas no disponible");
      RAW_ODDS_EVENTS = data;
    }

    const match = data.find(ev =>
      ev.home_team?.toLowerCase().includes(homeTeam.toLowerCase()) ||
      ev.away_team?.toLowerCase().includes(awayTeam.toLowerCase())
    );
    if(!match) throw new Error("Partido no encontrado en The Odds API");

    const rows = match.bookmakers.map(b => {
      const outcomes = b.markets?.[0]?.outcomes || [];
      const price = name => outcomes.find(o => o.name === name)?.price;
      return {
        name: b.title,
        home: price(match.home_team),
        draw: price("Draw"),
        away: price(match.away_team),
      };
    }).filter(r => r.home && r.draw && r.away);

    if(rows.length === 0) throw new Error("El proveedor no devolvió cuotas usables");

    ODDS_ROWS = rows;
    ACTIVE_BOOKIES = new Set(ODDS_ROWS.map(r => r.name));
    ODDS_SOURCE = "live";
  } catch (err) {
    console.warn("Cuotas en demo (motivo: " + err.message + ")");
    ODDS_ROWS = [];
    ACTIVE_BOOKIES = new Set();
    ODDS_SOURCE = "demo";
  }
  return ODDS_SOURCE === "live";
}

function getOddsInputs(){
  const avg = key => {
    const vals = ODDS_ROWS.map(r => r[key]).filter(v => typeof v === "number" && !Number.isNaN(v));
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
  };
  return { odds_h: avg("home"), odds_d: avg("draw"), odds_a: avg("away") };
}

/* ---------------------------------------------------------
   Clasificación real de LaLiga.
--------------------------------------------------------- */
let STANDINGS_TABLE = null;
let STANDINGS_SOURCE = null;

async function loadRealStandings(leagueId = LEAGUE_ID, season = SEASON){
  try {
    const res = await fetch(`/api/standings?league=${leagueId}&season=${season}`);
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || "API de clasificación no disponible");

    const table = data.response?.[0]?.league?.standings?.[0];
    if(!table || table.length === 0) throw new Error("Sin datos de clasificación");

    STANDINGS_TABLE = table;
    STANDINGS_SOURCE = data._source || "API-Football";
    return { ok: true, table, source: STANDINGS_SOURCE };
  } catch (err) {
    STANDINGS_TABLE = null;
    STANDINGS_SOURCE = null;
    return { ok: false, error: err.message };
  }
}

function findStandingRow(teamName){
  if(!STANDINGS_TABLE || !teamName) return null;
  const key = normalizeKey(teamName);
  return STANDINGS_TABLE.find(r => {
    const rk = normalizeKey(r.team.name);
    return rk === key || rk.includes(key) || key.includes(rk);
  }) || null;
}
