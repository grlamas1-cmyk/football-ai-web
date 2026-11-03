// Histórico público de predicciones vs. resultados reales (solo lectura).
import { proxyBackendGet } from "./_lib/backend.js";

export default async function handler(req, res) {
  return proxyBackendGet(res, "/prediction-history", { maxAge: 300 });
}
