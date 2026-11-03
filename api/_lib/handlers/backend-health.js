// Comprobación rápida de que el backend Python está vivo y bien
// configurado. Útil para depurar el despliegue: visita
// https://football-ai-web-self.vercel.app/api/backend-health
// desde el navegador y deberías ver { ok: true, backend: {...} }.

export default async function handler(req, res) {
  const BASE_URL = process.env.PYTHON_API_URL;

  if (!BASE_URL) {
    return res.status(500).json({
      ok: false,
      error: "Falta configurar PYTHON_API_URL en las variables de entorno de Vercel.",
    });
  }

  try {
    const backendRes = await fetch(`${BASE_URL.replace(/\/+$/, "")}/health`);
    const data = await backendRes.json().catch(() => null);
    return res.status(backendRes.ok ? 200 : backendRes.status).json({
      ok: backendRes.ok,
      backend_url: BASE_URL,
      backend_status: backendRes.status,
      backend_response: data,
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      backend_url: BASE_URL,
      error: `No se pudo contactar con el backend: ${error.message}`,
    });
  }
}
