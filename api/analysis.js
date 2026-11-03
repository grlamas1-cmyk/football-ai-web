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

// Groq retiró llama-3.3-70b-versatile el 17-jun-2026. Modelo de
// reemplazo recomendado por Groq (console.groq.com/docs/deprecations):
// openai/gpt-oss-120b.
const GROQ_MODEL = "openai/gpt-oss-120b";

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
  // Validación defensiva: esto solo debería recibir nombres de equipo reales
  // y probabilidades 0-100 desde el propio frontend, pero el endpoint es
  // público — sin esto, cualquiera podría mandar texto enorme como "team1"
  // y agotar la cuota gratuita de Groq con un solo POST.
  if (typeof team1 !== "string" || typeof team2 !== "string" || team1.length > 60 || team2.length > 60) {
    return res.status(400).json({ error: "Nombres de equipo inválidos." });
  }
  for (const p of [pHome, pDraw, pAway]) {
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 100) {
      return res.status(400).json({ error: "Probabilidades inválidas (deben ser números entre 0 y 100)." });
    }
  }

  // Contexto opcional (todo validado por tamaño/tipo por el mismo motivo):
  // probabilidades del mercado, mercados de goles/córners/tarjetas y la
  // apuesta con valor si la hay. Permite que el análisis compare modelo y
  // casas en vez de limitarse a repetir el 1X2.
  const { marketHome, marketDraw, marketAway, over25, btts, cornersExp, cardsExp, pick } = req.body || {};
  const pctOk = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
  const countOk = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 40;
  if (pick != null && (typeof pick !== "string" || pick.length > 160)) {
    return res.status(400).json({ error: "Apuesta inválida." });
  }

  const extra = [];
  if (xgHome != null && xgAway != null) extra.push(`Goles esperados: ${team1} ${Number(xgHome).toFixed(2)} — ${Number(xgAway).toFixed(2)} ${team2}.`);
  if ([marketHome, marketDraw, marketAway].every(pctOk)) extra.push(`Las casas de apuestas (cuotas medias, sin margen) dan: ${team1} ${marketHome}%, empate ${marketDraw}%, ${team2} ${marketAway}%.`);
  if (pctOk(over25)) extra.push(`Probabilidad de más de 2.5 goles: ${over25}%.`);
  if (pctOk(btts)) extra.push(`Probabilidad de que marquen los dos: ${btts}%.`);
  if (countOk(cornersExp)) extra.push(`Córners esperados en total: ${Number(cornersExp).toFixed(1)}.`);
  if (countOk(cardsExp)) extra.push(`Tarjetas esperadas en total: ${Number(cardsExp).toFixed(1)}.`);
  if (pick) extra.push(`Apuesta con valor detectada (una casa paga más que la cuota justa de referencia): ${pick}.`);

  const prompt = `Eres un analista deportivo que explica predicciones de fútbol de forma clara y honesta, sin tecnicismos.
Datos de un modelo estadístico propio (LaLiga) para el partido ${team1} vs ${team2}:
- Probabilidad de victoria de ${team1} (local): ${pHome}%
- Probabilidad de empate: ${pDraw}%
- Probabilidad de victoria de ${team2} (visitante): ${pAway}%
${extra.map((line) => `- ${line}`).join("\n")}

Escribe un análisis breve en español (4-5 frases, sin listas ni markdown): qué dice el modelo, si coincide o no con las casas de apuestas y qué tipo de partido se espera (goles, córners, tarjetas) según estos números. Si hay una apuesta con valor, menciónala con prudencia. No inventes datos que no estén aquí (lesiones, alineaciones, rachas), no garantices resultados ni des consejos financieros, y termina con una frase corta recordando que es una estimación probabilística, no una certeza.`;

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
        max_tokens: 420,
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
