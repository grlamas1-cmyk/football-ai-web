// Próximos partidos ya predichos por el job diario del backend
// (predicción, mercados de goles/córners/tarjetas, apuestas con valor y
// las cuotas de cada casa). Ver jobs/daily_update.py en laliga-api-backend.
import { proxyBackendGet } from "./_lib/backend.js";

export default async function handler(req, res) {
  return proxyBackendGet(res, "/upcoming", { maxAge: 300 });
}
