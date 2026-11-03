// Lecturas del backend (Render) en UNA sola función de Vercel. El plan
// gratuito de Vercel admite como máximo 12 funciones por despliegue; al
// pasar de 12 el despliegue falla sin avisar en la web (pasó el 3/11/2026:
// la web se quedó en la versión anterior). Las URLs públicas no cambian:
// /api/upcoming, /api/picks... llegan aquí por los rewrites de vercel.json.
import { proxyBackendGet } from "./_lib/backend.js";
import backendHealth from "./_lib/handlers/backend-health.js";

const ROUTES = {
  upcoming: ["/upcoming", 300],
  picks: ["/picks", 300],
  report: ["/report", 3600],
  "predictions-history": ["/prediction-history", 300],
  teams: ["/teams", 300],
};

export default async function handler(req, res) {
  const route = String(req.query.r || "");
  if (route === "backend-health") return backendHealth(req, res);
  const target = ROUTES[route];
  if (!target) return res.status(404).json({ ok: false, error: "Ruta desconocida." });
  return proxyBackendGet(res, target[0], { maxAge: target[1] });
}
