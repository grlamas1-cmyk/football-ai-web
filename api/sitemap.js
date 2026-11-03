// sitemap.xml dinámico (rewrite en vercel.json): páginas fijas + una
// página por partido (próximos y ya jugados del histórico), para que
// Google descubra los pronósticos nuevos cada jornada sin tocar nada.

import { SITE } from "./_lib/layout.js";
import { fetchSelf, matchSlug } from "./_lib/site.js";

const STATIC = [
  ["/", "daily", "1.0"], ["/pronosticos", "daily", "0.9"], ["/partidos.html", "daily", "0.8"],
  ["/apuestas.html", "daily", "0.8"], ["/estadisticas.html", "daily", "0.7"], ["/cuotas.html", "daily", "0.6"],
  ["/analizador.html", "monthly", "0.5"], ["/terminos.html", "yearly", "0.1"], ["/privacidad.html", "yearly", "0.1"], ["/cookies.html", "yearly", "0.1"],
];

export default async function handler(req, res) {
  const [upcoming, history] = await Promise.all([fetchSelf(req, "/api/upcoming"), fetchSelf(req, "/api/predictions-history")]);
  const today = new Date().toISOString().slice(0, 10);
  const urls = STATIC.map(([path, freq, prio]) => ({ loc: `${SITE}${path}`, lastmod: today, freq, prio }));
  const seen = new Set();
  for (const m of upcoming?.matches || []) {
    const loc = `${SITE}/pronostico/${matchSlug(m.home_team, m.away_team, m.kickoff)}`;
    if (!seen.has(loc)) { seen.add(loc); urls.push({ loc, lastmod: (upcoming.generated_at || today).slice(0, 10), freq: "daily", prio: "0.8" }); }
  }
  for (const h of (history?.history || []).slice(0, 400)) {
    const loc = `${SITE}/pronostico/${matchSlug(h.home_team, h.away_team, h.match_date)}`;
    if (!seen.has(loc)) { seen.add(loc); urls.push({ loc, lastmod: h.match_date, freq: "monthly", prio: "0.4" }); }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join("\n")}
</urlset>
`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(xml);
}
