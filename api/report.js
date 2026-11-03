// Validación histórica del modelo y backtest de apuestas con cuotas
// reales (solo cambia al reentrenar).
import { proxyBackendGet } from "./_lib/backend.js";

export default async function handler(req, res) {
  return proxyBackendGet(res, "/report", { maxAge: 3600 });
}
