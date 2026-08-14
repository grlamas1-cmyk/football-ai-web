// Proxy hacia GET /teams del backend Python real. Devuelve la lista de
// nombres de equipo tal y como los conoce el modelo (para que el
// frontend pueda normalizar lo que escribe el usuario antes de llamar
// a /api/predict). Ver TEAM_ALIASES / resolveModelTeamName en index.html.
//
// Variable de entorno requerida en Vercel: PYTHON_API_URL (misma que
// usa api/predict.js).

export default async function handler(req, res) {
  const BASE_URL = process.env.PYTHON_API_URL;

  if (!BASE_URL) {
    return res.status(500).json({
      ok: false,
      error: "Falta configurar PYTHON_API_URL en las variables de entorno de Vercel.",
    });
  }

  try {
    const backendRes = await fetch(`${BASE_URL.replace(/\/+$/, "")}/teams`);
    const text = await backendRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: `Respuesta no-JSON del backend (estado ${backendRes.status}): ${text.slice(0, 300)}` };
    }

    if (!backendRes.ok) {
      return res.status(backendRes.status).json({
        ok: false,
        error: data.error || `El backend del modelo respondió con estado ${backendRes.status}.`,
      });
    }

    // Cachea 5 minutos en el edge: la lista de equipos no cambia a menudo.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: `No se pudo contactar con el backend del modelo (${BASE_URL}): ${error.message}`,
    });
  }
}
