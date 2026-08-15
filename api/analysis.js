// Análisis en lenguaje natural de una predicción, usando la API
// GRATUITA de Groq (console.groq.com). Se usó Google Gemini al
// principio, pero aistudio.google.com puede pedir verificación de edad
// para crear una clave y bloquear el registro — Groq no lo pide,
// funciona con una cuenta normal (email o login con Google/GitHub) y
// tiene un nivel gratuito permanente pensado para proyectos como este.
//
// Variable de entorno requerida en Vercel: GROQ_API_KEY
//   1. Entra en https://console.groq.com/keys
//   2. Crea una cuenta gratuita y pulsa "Create API Key"
//   3. Pégala en Vercel → tu proyecto → Settings → Environment
//      Variables → nombre GROQ_API_KEY.
//
// El frontend (generateAIAnalysis en index.html) manda por POST el
// último resultado de /api/predict ya resumido:
//   { team1, team2, pHome, pDraw, pAway, xgHome, xgAway }
// y espera de vuelta { analysis: "texto..." }.

const GROQ_MODEL = "llama-3.3-70b-versatile";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido. Usa POST." });
  }

  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({
      error: "Falta configurar GROQ_API_KEY en las variables de entorno de Vercel. Consigue una clave gratuita en https://console.groq.com/keys",
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
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 300,
      }),
    });

    const text = await groqRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: `Respuesta no-JSON de Groq (estado ${groqRes.status}): ${text.slice(0, 300)}` });
    }

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({
        error: data.error?.message || `Groq respondió con estado ${groqRes.status}.`,
      });
    }

    const analysis = data.choices?.[0]?.message?.content?.trim();
    if (!analysis) {
      return res.status(502).json({ error: "Groq no devolvió texto de análisis." });
    }

    return res.status(200).json({ analysis });
  } catch (error) {
    return res.status(502).json({ error: `No se pudo contactar con Groq: ${error.message}` });
  }
}
