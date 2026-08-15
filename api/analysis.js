// Análisis en lenguaje natural de una predicción, usando la API
// GRATUITA de Google Gemini (aistudio.google.com) en vez de OpenAI:
// tiene un nivel gratuito permanente pensado justo para proyectos como
// este (límite por minuto/día, sin necesidad de tarjeta).
//
// Variable de entorno requerida en Vercel: GEMINI_API_KEY
//   1. Entra en https://aistudio.google.com/apikey
//   2. Crea una clave gratuita ("Create API key")
//   3. Pégala en Vercel → tu proyecto → Settings → Environment
//      Variables → nombre GEMINI_API_KEY.
//
// El frontend (generateAIAnalysis en index.html) manda por POST el
// último resultado de /api/predict ya resumido:
//   { team1, team2, pHome, pDraw, pAway, xgHome, xgAway }
// y espera de vuelta { analysis: "texto..." }.

const GEMINI_MODEL = "gemini-2.0-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido. Usa POST." });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({
      error: "Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel. Consigue una clave gratuita en https://aistudio.google.com/apikey",
    });
  }

  const { team1, team2, pHome, pDraw, pAway, xgHome, xgAway } = req.body || {};
  if (!team1 || !team2 || pHome == null || pDraw == null || pAway == null) {
    return res.status(400).json({ error: "Faltan datos de la predicción (team1, team2, pHome, pDraw, pAway)." });
  }

  const xgLine = (xgHome != null && xgAway != null)
    ? `Goles esperados (xG): ${team1} ${Number(xgHome).toFixed(2)} — ${Number(xgAway).toFixed(2)} ${team2}.`
    : "";

  const prompt = `Eres un analista deportivo que explica predicciones de fútbol de forma clara y honesta, sin tecnicismos.
Datos de un modelo estadístico (LaLiga) para el partido ${team1} vs ${team2}:
- Probabilidad de victoria de ${team1} (local): ${pHome}%
- Probabilidad de empate: ${pDraw}%
- Probabilidad de victoria de ${team2} (visitante): ${pAway}%
${xgLine}

Escribe un análisis breve en español (3-4 frases, sin listas ni markdown) explicando qué dice el modelo y por qué ese resultado es el más probable según estos números. No garantices resultados, no des consejos financieros, y recuerda en una frase corta al final que es una estimación probabilística, no una certeza.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 300 },
        }),
      }
    );

    const text = await geminiRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: `Respuesta no-JSON de Gemini (estado ${geminiRes.status}): ${text.slice(0, 300)}` });
    }

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({
        error: data.error?.message || `Gemini respondió con estado ${geminiRes.status}.`,
      });
    }

    const analysis = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (!analysis) {
      return res.status(502).json({ error: "Gemini no devolvió texto de análisis (puede haber bloqueado la respuesta por seguridad)." });
    }

    return res.status(200).json({ analysis });
  } catch (error) {
    return res.status(502).json({ error: `No se pudo contactar con Gemini: ${error.message}` });
  }
}
