// Proxy hacia el backend Python real, GET /prediction-history — histórico
// público de predicciones vs. resultados reales (ver estadisticas.html).
// Es de solo lectura, sin protección: el backend ya expone ese endpoint
// sin SYNC_SECRET porque no modifica nada.
//
// Variable de entorno requerida en Vercel: PYTHON_API_URL (la misma que
// usa /api/predict).

export default async function handler(req, res) {
  const BASE_URL = process.env.PYTHON_API_URL;

  if (!BASE_URL) {
    return res.status(500).json({
      ok: false,
      error: "Falta configurar PYTHON_API_URL en las variables de entorno de Vercel.",
    });
  }

  try {
    const backendRes = await fetch(`${BASE_URL.replace(/\/+$/, "")}/prediction-history`);
    const text = await backendRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: `Respuesta no-JSON del backend (estado ${backendRes.status}): ${text.slice(0, 300)}`,
      });
    }

    if (!backendRes.ok) {
      return res.status(backendRes.status).json({
        ok: false,
        error: data.error || `El backend respondió con estado ${backendRes.status}.`,
      });
    }

    // Cachea 5 min: el histórico solo cambia una vez al día (cron), no hace falta pedirlo en cada visita.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: `No se pudo contactar con el backend del modelo (${BASE_URL}): ${error.message}`,
    });
  }
}
