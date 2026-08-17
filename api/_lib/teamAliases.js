// Copia, en el servidor, de la misma tabla de alias que usa index.html
// (resolveModelTeamName) para que el sincronizador automático de
// resultados (api/cron/sync-results.js) entienda los nombres de equipo
// que da The Odds API igual que ya entiende los que escribe un usuario.
// Es una copia deliberada (no un import compartido) porque una vive en
// el navegador y la otra en Node — pero es el MISMO contenido: si
// cambias TEAM_ALIASES en index.html, cambia aquí también.

export const TEAM_ALIASES = {
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
  // COLD_START_TEAMS en index.html); se deja pasar igualmente porque
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

export function normalizeKey(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[.]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

// TEAM_ALIASES normalizado una vez (mismas claves que produce
// normalizeKey en cualquier texto de entrada) — evita que un alias con
// tilde ("barça") no se encuentre nunca por no coincidir con la
// versión ya normalizada del texto de entrada.
const NORMALIZED_ALIASES = Object.fromEntries(
  Object.entries(TEAM_ALIASES).map(([key, value]) => [normalizeKey(key), value])
);

// Resuelve un nombre de equipo (tal y como lo da un proveedor externo,
// ej. The Odds API) al nombre exacto que espera el modelo. A propósito
// NO adivina con tolerancia a erratas (a diferencia del resolvedor del
// navegador): esto se usa en un proceso automático sin supervisión, así
// que ante la duda es mejor saltarse un partido (queda para la próxima
// sincronización) que arriesgarse a etiquetar mal un resultado.
export function resolveTeamName(rawName, modelTeams) {
  const key = normalizeKey(rawName);
  if (!key) return null;

  const exact = modelTeams.find((t) => normalizeKey(t) === key);
  if (exact) return exact;

  if (NORMALIZED_ALIASES[key]) return NORMALIZED_ALIASES[key];

  // Coincidencia por alias en cualquier dirección (ej. "Real Racing
  // Club de Santander" contiene la clave de alias "real racing club").
  for (const [aliasKey, target] of Object.entries(NORMALIZED_ALIASES)) {
    if (aliasKey.length >= 5 && (key.includes(aliasKey) || aliasKey.includes(key))) {
      return target;
    }
  }

  const partials = modelTeams.filter((t) => normalizeKey(t).includes(key) || key.includes(normalizeKey(t)));
  if (partials.length === 1) return partials[0];

  return null; // ambiguo o desconocido: mejor no adivinar
}
