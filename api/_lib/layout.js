// GENERADO con la misma plantilla que las páginas .html (cabecera, menú y
// pie idénticos). Si cambias el menú o el pie de las páginas, cámbialo
// aquí también.

export const SITE = "https://football-ai-web-self.vercel.app";

export function head({ title, description, path, jsonLd = [] }) {
  const url = `${SITE}${path}`;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0d1310">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Football Analytics Pro">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
${jsonLd.map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>`;
}

export const HEADER = "\n<header>\n  <div class=\"header-inner\">\n    <a class=\"logo\" href=\"/index.html\"><span class=\"mark\"></span> Football Analytics Pro</a>\n    <nav aria-label=\"Principal\">\n      <a href=\"/index.html\">Inicio</a>\n      <a href=\"/partidos.html\" class=\"active\">Partidos</a>\n      <a href=\"/apuestas.html\" class=\"highlight\">Apuestas</a>\n      <a href=\"/estadisticas.html\">Resultados</a>\n      <a href=\"/cuotas.html\">Cuotas</a>\n      <a href=\"/analizador.html\">Analizador</a>\n    </nav>\n  </div>\n</header>\n";

export const FOOTER = "\n<footer>\n  <div class=\"wrap\">\n    <div class=\"footer-grid\">\n      <div class=\"logo\"><span class=\"mark\"></span> Football Analytics Pro</div>\n      <div class=\"footer-cols\">\n        <div class=\"footer-col\">\n          <h4>Herramientas</h4>\n          <a href=\"/partidos.html\">Partidos</a>\n          <a href=\"/apuestas.html\">Apuestas con valor</a>\n          <a href=\"/cuotas.html\">Comparador de cuotas</a>\n          <a href=\"/analizador.html\">Analizador</a>\n        </div>\n        <div class=\"footer-col\">\n          <h4>Informaci\u00f3n</h4>\n          <a href=\"/pronosticos\">Pron\u00f3sticos de la jornada</a>\n          <a href=\"/estadisticas.html\">Resultados y validaci\u00f3n</a>\n          <a href=\"/index.html\">Inicio</a>\n        </div>\n        <div class=\"footer-col\">\n          <h4>Legal</h4>\n          <a href=\"/terminos.html\">T\u00e9rminos de uso</a>\n          <a href=\"/privacidad.html\">Privacidad</a>\n          <a href=\"/cookies.html\">Cookies</a>\n        </div>\n      </div>\n    </div>\n    <div class=\"responsible\">\n      <b>Juego responsable.</b> Este sitio ofrece herramientas de an\u00e1lisis y no constituye asesoramiento financiero ni garantiza resultados. Apostar conlleva riesgo de p\u00e9rdida econ\u00f3mica: no apuestes dinero que no puedas permitirte perder. Servicio dirigido a mayores de 18 a\u00f1os. Si crees que tu forma de apostar te genera problemas, busca ayuda profesional (en Espa\u00f1a: <a href=\"https://www.jugarbien.es\" rel=\"noopener\">jugarbien.es</a>).\n    </div>\n  </div>\n</footer>\n";

export const SCRIPTS = `<script src="/common.js"></script>
<script src="/ui.js"></script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`;
