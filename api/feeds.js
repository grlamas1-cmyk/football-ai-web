// Fuentes externas (cuotas, partidos con árbitro, clasificación) en una
// sola función de Vercel, por el límite de 12 funciones del plan gratuito
// (ver api/data.js). Cada fuente vive en api/_lib/handlers/.
import eventOdds from "./_lib/handlers/event-odds.js";
import fixtures from "./_lib/handlers/fixtures.js";
import odds from "./_lib/handlers/odds.js";
import standings from "./_lib/handlers/standings.js";

const ROUTES = { odds, "event-odds": eventOdds, fixtures, standings };

export default async function handler(req, res) {
  const target = ROUTES[String(req.query.r || "")];
  if (!target) return res.status(404).json({ ok: false, error: "Ruta desconocida." });
  return target(req, res);
}
