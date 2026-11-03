// Proxy GET genérico hacia el backend Python (Render). Lo usan las
// funciones de solo lectura (/api/upcoming, /api/picks, /api/report,
// /api/predictions-history): todas devuelven archivos que el job diario
// actualiza una vez al día, así que se cachean en el edge de Vercel con
// stale-while-revalidate — el visitante recibe la copia en caché al
// instante aunque Render esté "dormido" (arranque en frío de ~30-50 s), y
// Vercel la refresca por detrás.
//
// Variable de entorno requerida en Vercel: PYTHON_API_URL.

export async function proxyBackendGet(res, path, { maxAge = 300, staleFor = 86400 } = {}) {
  const BASE_URL = process.env.PYTHON_API_URL;
  if (!BASE_URL) {
    return res.status(500).json({ ok: false, error: "Falta configurar PYTHON_API_URL en las variables de entorno de Vercel." });
  }

  try {
    const backendRes = await fetch(`${BASE_URL.replace(/\/+$/, "")}${path}`);
    const text = await backendRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ ok: false, error: `Respuesta no-JSON del backend (estado ${backendRes.status}): ${text.slice(0, 300)}` });
    }
    if (!backendRes.ok) {
      return res.status(backendRes.status).json({ ok: false, error: data.detail || data.error || `El backend respondió con estado ${backendRes.status}.` });
    }
    res.setHeader("Cache-Control", `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${staleFor}`);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ ok: false, error: `No se pudo contactar con el backend del modelo: ${error.message}` });
  }
}
