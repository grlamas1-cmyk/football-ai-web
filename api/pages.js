// Páginas generadas en el servidor (pronóstico por partido, jornada,
// sitemap) en una sola función de Vercel, por el límite de 12 funciones
// del plan gratuito (ver api/data.js).
import pronostico from "./_lib/handlers/pronostico.js";
import pronosticos from "./_lib/handlers/pronosticos.js";
import sitemap from "./_lib/handlers/sitemap.js";

const ROUTES = { pronostico, pronosticos, sitemap };

export default async function handler(req, res) {
  const target = ROUTES[String(req.query.r || "")];
  if (!target) return res.status(404).send("Not found");
  return target(req, res);
}
