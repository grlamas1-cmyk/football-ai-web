// Respaldo por IA (Groq, gratis) para interpretar una apuesta escrita
// en lenguaje libre, SOLO cuando el interpretador local de index.html
// (extractTeamMentions + expresiones regulares, ver parseNaturalBet)
// no consigue entender el texto. El interpretador local es la vía
// principal — es gratis, instantáneo y no tiene límite de peticiones —
// así que este endpoint se llama poco, solo como último recurso.
//
// Variable de entorno requerida en Vercel: GROQ_API_KEY (la misma que
// usa api/analysis.js — consíguela gratis en https://console.groq.com/keys).
//
// Devuelve SOLO datos en bruto extraídos del texto (nombres de equipo
// tal y como los escribió el usuario, no verificados). El frontend
// sigue siendo el que valida esos nombres contra la lista real de
// equipos del modelo (resolveModelTeamName) antes de predecir nada —
// esta función nunca decide sola qué equipo es cuál.

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
      error: "Falta configurar GROQ_API_KEY en las variables de entorno de Vercel.",
    });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Falta el texto de la apuesta." });
  }
  // Límite de longitud: ninguna apuesta real necesita más de esto. Evita que
  // alguien mande texto enorme y agote la cuota gratuita de Groq de un tirón.
  if (text.length > 300) {
    return res.status(400).json({ error: "El texto de la apuesta es demasiado largo (máximo 300 caracteres)." });
  }

  const prompt = `Extrae los datos de esta apuesta de fútbol escrita en español: "${text.trim()}"

Devuelve SOLO un JSON válido, sin explicación ni markdown, con esta forma exacta:
{"home_team": "...", "away_team": "...", "selection": "home" | "draw" | "away", "odd": 1.85}

- home_team / away_team: los nombres de los dos equipos tal y como aparecen en el texto (respeta mayúsculas y apodos, ej. "Barça", "Atleti").
- selection: "home" si gana el primer equipo mencionado, "away" si gana el segundo, "draw" si es empate.
- odd: el número de cuota mencionado (formato decimal, ej. 1.85). Si no hay cuota en el texto, usa null.
Si no consigues identificar los dos equipos, devuelve {"home_team": null, "away_team": null, "selection": null, "odd": null}.`;

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
        temperature: 0,
        max_tokens: 200,
      }),
    });

    const rawText = await groqRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(502).json({ error: `Respuesta no-JSON de Groq (estado ${groqRes.status}): ${rawText.slice(0, 300)}` });
    }

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: data.error?.message || `Groq respondió con estado ${groqRes.status}.` });
    }

    let content = data.choices?.[0]?.message?.content?.trim() || "";
    // Por si el modelo envuelve la respuesta en ```json ... ``` a pesar de pedir que no lo haga.
    content = content.replace(/^```(json)?/i, "").replace(/```$/, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: "Groq no devolvió un JSON interpretable." });
    }

    return res.status(200).json({
      home_team: parsed.home_team || null,
      away_team: parsed.away_team || null,
      selection: ["home", "draw", "away"].includes(parsed.selection) ? parsed.selection : null,
      odd: typeof parsed.odd === "number" ? parsed.odd : null,
    });
  } catch (error) {
    return res.status(502).json({ error: `No se pudo contactar con Groq: ${error.message}` });
  }
}
