// Registro público de apuestas recomendadas en vivo y su resultado real.
import { proxyBackendGet } from "./_lib/backend.js";

export default async function handler(req, res) {
  return proxyBackendGet(res, "/picks", { maxAge: 300 });
}
