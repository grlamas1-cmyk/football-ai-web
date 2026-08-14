// Proxy hacia el backend Python real (FastAPI + modelo_laliga_cuotas_output).
//
// El frontend nunca llama directamente al backend Python: llama a esta
// función serverless de Vercel (same-origin, sin problemas de CORS), y
// esta función reenvía la petición al backend real.
//
// Variable de entorno requerida en Vercel:
//   PYTHON_API_URL = https://tu-backend.onrender.com   (SIN barra final,
//                     SIN "/predict" al final: esta función lo añade)
//
// El backend (outputs/laliga_api/main.py) debe exponer POST /predict
// con el contrato descrito en outputs/laliga_api/README.md.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido. Usa POST." });
  }

  const BASE_URL = process.env.PYTHON_API_URL;

  if (!BASE_URL) {
    return res.status(500).json({
      ok: false,
      error: "Falta configurar PYTHON_API_URL en las variables de entorno de Vercel.",
    });
  }

  const body = req.body || {};
  const required = ["home_team", "away_team", "odds_h", "odds_d", "odds_a"];
  const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
  if (missing.length > 0) {
    return res.status(400).json({
      ok: false,
      error: `Faltan campos obligatorios en la petición: ${missing.join(", ")}`,
    });
  }

  try {
    const backendRes = await fetch(`${BASE_URL.replace(/\/+$/, "")}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 10s de margen razonable para carga de .joblib + inferencia.
      body: JSON.stringify(body),
    });

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

    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: `No se pudo contactar con el backend del modelo (${BASE_URL}): ${error.message}`,
    });
  }
}
