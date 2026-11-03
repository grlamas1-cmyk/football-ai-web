// Página de pronóstico de UN partido, generada en el servidor:
//   /pronostico/sevilla-vs-alaves-2026-11-06  (rewrite en vercel.json)
// Es la página pensada para Google ("pronóstico Sevilla Alavés") y para
// compartir por WhatsApp/Telegram: todo el contenido va ya en el HTML.
// Los datos son los mismos que enseña partidos.html (/api/upcoming); si el
// partido ya se jugó, se enseña el resultado frente a lo que se predijo
// (y las apuestas registradas), para que el enlace siga sirviendo.

import { FOOTER, HEADER, SCRIPTS, SITE, head } from "./_lib/layout.js";
import { dateLong, esc, fetchSelf, matchSlug, odds, pct, pickCard, probBar, resultChip, sendHtml, shareBar, signedPct, teamName } from "./_lib/site.js";

const EXCHANGES = new Set(["betfair_ex_eu", "betfair_ex_uk", "matchbook", "smarkets"]);

function bestPrices(event) {
  const out = {};
  for (const b of event?.bookmakers || []) {
    if (EXCHANGES.has(b.key)) continue;
    const h2h = (b.markets || []).find((m) => m.key === "h2h");
    for (const o of h2h?.outcomes || []) {
      const sel = o.name === event.home_team ? "home" : o.name === event.away_team ? "away" : "draw";
      if (b.key === "pinnacle") { out.pinnacle ??= {}; out.pinnacle[sel] = o.price; continue; }
      if (!out[sel] || o.price > out[sel].price) out[sel] = { price: o.price, book: b.title };
    }
  }
  return out;
}

function summaryText(m, home, away) {
  const p = m.prediction, s = p.sin_cuotas.probabilities, c = p.con_cuotas?.probabilities;
  const g = p.markets.goals, xg = p.sin_cuotas.expected_goals;
  const fav = s.H >= s.A ? ["H", home] : ["A", away];
  const parts = [];
  if (Math.abs(s.H - s.A) < 0.06) parts.push(`El modelo ve un partido muy igualado: ${home} ${pct(s.H)}, empate ${pct(s.D)} y ${away} ${pct(s.A)}.`);
  else parts.push(`El modelo ve favorito al ${fav[1]} (${pct(s[fav[0]])}), con el empate al ${pct(s.D)}.`);
  if (c) {
    const diff = s[fav[0]] - c[fav[0]];
    parts.push(Math.abs(diff) < 0.04
      ? `Las casas de apuestas opinan prácticamente lo mismo (${pct(c[fav[0]])}).`
      : `Las casas de apuestas le dan ${diff < 0 ? "más" : "menos"} opciones (${pct(c[fav[0]])}).`);
  }
  const total = xg.home + xg.away;
  parts.push(`${total < 2.4 ? "Se esperan pocos goles" : total > 2.9 ? "Se esperan goles" : "Se espera un partido de goles normales"}: ${xg.home.toFixed(1)} del ${home} y ${xg.away.toFixed(1)} del ${away} (más de 2.5 goles: ${pct(g.over_25)}).`);
  parts.push(`Córners esperados: ${p.markets.corners.expected_total.toFixed(1)}; tarjetas esperadas: ${p.markets.cards.expected_total.toFixed(1)}.`);
  const picks = p.picks || [];
  parts.push(picks.length
    ? `Hay ${picks.length} apuesta${picks.length > 1 ? "s" : ""} con valor: ${picks.map((x) => `${x.label} a ${odds(x.odds)} en ${x.bookmaker_title}`).join("; ")}.`
    : "Ahora mismo ninguna casa paga claramente más de lo justo en este partido.");
  return parts.join(" ");
}

function ouRow(label, over) {
  return `<tr><td>${esc(label)}</td><td class="r">${pct(over)}</td><td class="r">${odds(1 / over)}</td><td class="r">${pct(1 - over)}</td><td class="r">${odds(1 / (1 - over))}</td></tr>`;
}

function upcomingPage(m, url) {
  const home = teamName(m.home_team), away = teamName(m.away_team);
  const p = m.prediction, s = p.sin_cuotas.probabilities, g = p.markets.goals;
  const corners = p.markets.corners, cards = p.markets.cards;
  const best = bestPrices(m.odds_event);
  const pin = best.pinnacle && best.pinnacle.home && best.pinnacle.draw && best.pinnacle.away ? best.pinnacle : null;
  let fair = null;
  if (pin) {
    const inv = [1 / pin.home, 1 / pin.draw, 1 / pin.away], t = inv.reduce((a, b) => a + b, 0);
    fair = { home: t / inv[0], draw: t / inv[1], away: t / inv[2] };
  }
  const top = p.markets.top_scores?.[0];
  const favKey = s.H >= s.A && s.H >= s.D ? "H" : s.A >= s.D ? "A" : "D";
  const favLabel = { H: home, D: "Empate", A: away }[favKey];
  const goalsSide = g.over_25 >= 0.5 ? ["Más de 2.5 goles", g.over_25] : ["Menos de 2.5 goles", g.under_25];
  const bttsSide = g.btts_yes >= 0.5 ? ["Sí", g.btts_yes] : ["No", g.btts_no];
  const cornersLine = [8.5, 9.5, 10.5].reduce((b, l) => (Math.abs(corners.total[`over_${String(l).replace(".", "")}`] - 0.5) < Math.abs(corners.total[`over_${String(b).replace(".", "")}`] - 0.5) ? l : b), 9.5);
  const cardsLine = [3.5, 4.5, 5.5].reduce((b, l) => (Math.abs(cards.total[`over_${String(l).replace(".", "")}`] - 0.5) < Math.abs(cards.total[`over_${String(b).replace(".", "")}`] - 0.5) ? l : b), 4.5);
  const cOver = corners.total[`over_${String(cornersLine).replace(".", "")}`], kOver = cards.total[`over_${String(cardsLine).replace(".", "")}`];
  const summary = summaryText(m, home, away);
  const shareText = `Pronóstico ${home} - ${away}: ${home} ${pct(s.H)} · empate ${pct(s.D)} · ${away} ${pct(s.A)}.`;

  const faq = [
    [`¿Quién es favorito en el ${home} - ${away}?`, `Según el modelo propio, ${favLabel === "Empate" ? "el empate es el resultado más probable" : `el ${favLabel}`} (${pct(s[favKey])}). Probabilidades: ${home} ${pct(s.H)}, empate ${pct(s.D)}, ${away} ${pct(s.A)}.`],
    [`¿Cuántos goles habrá en el ${home} - ${away}?`, `Se esperan ${(p.sin_cuotas.expected_goals.home + p.sin_cuotas.expected_goals.away).toFixed(1)} goles en total. Probabilidad de más de 2.5 goles: ${pct(g.over_25)}; de que marquen los dos: ${pct(g.btts_yes)}. Resultado exacto más probable: ${top ? `${top.home}-${top.away} (${pct(top.probability)})` : "—"}.`],
    [`¿Cuántos córners y tarjetas habrá?`, `El modelo espera ${corners.expected_total.toFixed(1)} córners (más de ${cornersLine}: ${pct(cOver)}) y ${cards.expected_total.toFixed(1)} tarjetas (más de ${cardsLine}: ${pct(kOver)}).`],
  ];

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "SportsEvent", name: `${home} vs ${away}`, sport: "Fútbol", startDate: m.kickoff,
      eventStatus: "https://schema.org/EventScheduled", superEvent: { "@type": "SportsEvent", name: "LaLiga" },
      // Sin "location": no tenemos el estadio como dato fiable (hay equipos
      // jugando fuera de su campo habitual por obras) y no se inventa.
      homeTeam: { "@type": "SportsTeam", name: home }, awayTeam: { "@type": "SportsTeam", name: away } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Pronósticos", item: `${SITE}/pronosticos` },
      { "@type": "ListItem", position: 3, name: `${home} vs ${away}`, item: url }] },
  ];

  const pickHtml = (p.picks || []).length
    ? `<div class="picks-list">${p.picks.map(pickCard).join("")}</div><p class="muted small" style="margin-top:10px">Cuota justa = Pinnacle sin margen. Stake = 1/4 de Kelly. <a href="/apuestas.html">Calcula el stake en euros con tu bank →</a></p>`
    : `<div class="empty">Ninguna casa paga ahora mismo claramente más que la cuota justa en este partido. Se revisa cada mañana: si aparece valor, se registrará y saldrá en <a href="/apuestas.html">Apuestas</a>.</div>`;

  const bestRow = (sel, label) => best[sel]
    ? `<tr><td>${esc(label)}</td><td class="r"><b>${odds(best[sel].price)}</b></td><td>${esc(best[sel].book)}</td><td class="r">${fair ? odds(fair[sel]) : "—"}</td></tr>` : "";

  return head({
    title: `Pronóstico ${home} vs ${away} (${new Date(m.kickoff).toLocaleDateString("es-ES", { day: "numeric", month: "numeric", timeZone: "Europe/Madrid" })}): predicción, goles y apuestas`,
    description: `${home} ${pct(s.H)} · empate ${pct(s.D)} · ${away} ${pct(s.A)} según nuestro modelo. Goles esperados ${p.sin_cuotas.expected_goals.home.toFixed(1)}-${p.sin_cuotas.expected_goals.away.toFixed(1)}, córners ${corners.expected_total.toFixed(1)}, tarjetas ${cards.expected_total.toFixed(1)}. Mejores cuotas y apuestas con valor.`,
    path: new URL(url).pathname, jsonLd,
  }) + HEADER + `
<main class="wrap">
  <nav class="breadcrumb" aria-label="Migas de pan"><a href="/">Inicio</a> › <a href="/pronosticos">Pronósticos</a> › ${esc(home)} vs ${esc(away)}</nav>
  <section class="page-header">
    <div class="eyebrow">LaLiga · ${esc(dateLong(m.kickoff))}</div>
    <h1>Pronóstico ${esc(home)} – ${esc(away)}</h1>
    <p class="lead">${esc(summary)}</p>
    ${shareBar(url, shareText)}
  </section>

  <section class="section" style="padding-top:20px">
    <h2>Probabilidades</h2>
    <div class="compare" style="margin-top:14px">
      <div><div class="row-label">Modelo propio (sin mirar cuotas)</div>${probBar(s, home, away)}</div>
      ${p.con_cuotas ? `<div><div class="row-label">Casas de apuestas (cuota media sin margen)</div>${probBar(p.con_cuotas.probabilities, home, away)}</div>` : ""}
    </div>
    <div class="kpis">
      <div class="kpi"><span class="k">Resultado más probable</span><span class="v">${esc(favLabel)}</span><span class="s">${pct(s[favKey])} según el modelo</span></div>
      <div class="kpi"><span class="k">Goles</span><span class="v">${esc(goalsSide[0].replace(" goles", ""))}</span><span class="s">${pct(goalsSide[1])} · ${(p.sin_cuotas.expected_goals.home + p.sin_cuotas.expected_goals.away).toFixed(1)} esperados</span></div>
      <div class="kpi"><span class="k">Ambos marcan</span><span class="v">${bttsSide[0]}</span><span class="s">${pct(bttsSide[1])}</span></div>
      <div class="kpi"><span class="k">Marcador exacto</span><span class="v">${top ? `${top.home}-${top.away}` : "—"}</span><span class="s">${top ? `${pct(top.probability)}, el más probable` : ""}</span></div>
      <div class="kpi"><span class="k">Córners</span><span class="v">${corners.expected_total.toFixed(1)}</span><span class="s">más de ${cornersLine}: ${pct(cOver)}</span></div>
      <div class="kpi"><span class="k">Tarjetas</span><span class="v">${cards.expected_total.toFixed(1)}</span><span class="s">más de ${cardsLine}: ${pct(kOver)}</span></div>
    </div>
    <p class="muted small" style="margin-top:12px">Son probabilidades, no certezas: el resultado más probable no tiene por qué ser una buena apuesta. Las apuestas recomendadas son solo las de abajo.</p>
  </section>

  <section class="section">
    <h2>Apuestas con valor</h2>
    ${pickHtml}
  </section>

  ${best.home ? `<section class="section">
    <h2>Mejores cuotas 1X2</h2>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Resultado</th><th class="r">Mejor cuota</th><th>Casa</th><th class="r">Cuota justa</th></tr></thead><tbody>
      ${bestRow("home", home)}${bestRow("draw", "Empate")}${bestRow("away", away)}
    </tbody></table></div>
    <p class="muted small" style="margin-top:10px">Comparamos ~20 casas. <a href="/cuotas.html?match=${esc(m.match_id)}">Ver todas las cuotas, goles y hándicap →</a></p>
  </section>` : ""}

  <section class="section">
    <h2>Goles, córners y tarjetas</h2>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Mercado</th><th class="r">Más</th><th class="r">Cuota justa</th><th class="r">Menos</th><th class="r">Cuota justa</th></tr></thead><tbody>
      ${[1.5, 2.5, 3.5].map((l) => ouRow(`Goles ${l}`, g[`over_${String(l).replace(".", "")}`])).join("")}
      ${[8.5, 9.5, 10.5].map((l) => ouRow(`Córners ${l}`, corners.total[`over_${String(l).replace(".", "")}`])).join("")}
      ${[3.5, 4.5, 5.5].map((l) => ouRow(`Tarjetas ${l}`, cards.total[`over_${String(l).replace(".", "")}`])).join("")}
    </tbody></table></div>
    <p style="margin-top:14px"><a class="btn" href="/partidos.html?match=${esc(m.match_id)}">Ver el informe completo (hándicap, por equipo, IA) →</a></p>
  </section>

  <section class="section">
    <h2>Preguntas frecuentes</h2>
    ${faq.map(([q, a]) => `<details class="explain" open><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
    <div class="callout" style="margin-top:18px">Cómo se calcula: modelo propio (Dixon-Coles con xG, ELO y XGBoost) entrenado con 11 temporadas reales y validado temporada a temporada. <a href="/estadisticas.html">Ver todos los resultados y la validación →</a></div>
  </section>
</main>` + FOOTER + SCRIPTS;
}

function playedPage(h, picks, url) {
  const home = teamName(h.home_team), away = teamName(h.away_team);
  const s = h.sin_cuotas?.probabilities;
  const label = { H: home, D: "Empate", A: away };
  const verdict = h.resolved
    ? `Resultado final: ${home} ${h.actual_home_goals}-${h.actual_away_goals} ${away}.`
    : "Partido jugado o en juego: el resultado aparecerá aquí en cuanto esté disponible.";
  const pred = s ? `Antes del partido, el modelo daba ${home} ${pct(s.H)}, empate ${pct(s.D)} y ${away} ${pct(s.A)} (favorito: ${label[h.sin_cuotas.prediction]}${h.resolved ? `, ${h.sin_cuotas_correct ? "acertó" : "falló"}` : ""}).` : "";
  return head({
    title: `${home} vs ${away}: resultado y pronóstico (${h.match_date})`,
    description: `${verdict} ${pred}`.slice(0, 300),
    path: new URL(url).pathname,
  }) + HEADER + `
<main class="wrap">
  <nav class="breadcrumb" aria-label="Migas de pan"><a href="/">Inicio</a> › <a href="/pronosticos">Pronósticos</a> › ${esc(home)} vs ${esc(away)}</nav>
  <section class="page-header">
    <div class="eyebrow">LaLiga · ${esc(dateLong(h.kickoff || h.match_date))}</div>
    <h1>${esc(home)} – ${esc(away)}: resultado y pronóstico</h1>
    <p class="lead">${esc(verdict)} ${esc(pred)}</p>
  </section>
  ${s ? `<section class="section" style="padding-top:20px"><h2>Lo que predijo el modelo</h2><div style="margin-top:12px">${probBar(s, home, away)}</div></section>` : ""}
  <section class="section">
    <h2>Apuestas registradas</h2>
    ${picks.length ? `<div class="picks-list">${picks.map(pickCard).join("")}</div>` : `<div class="empty">No se registró ninguna apuesta con valor en este partido.</div>`}
    <p style="margin-top:14px"><a class="btn" href="/pronosticos">Ver los pronósticos de la próxima jornada →</a></p>
  </section>
</main>` + FOOTER + SCRIPTS;
}

function notFoundPage(url) {
  return head({ title: "Pronóstico no encontrado — Football Analytics Pro", description: "Este partido no está en la agenda actual.", path: new URL(url).pathname })
    + HEADER + `<main class="wrap"><section class="page-header"><h1>Partido no encontrado</h1>
    <p class="lead">No tenemos pronóstico para este partido (puede que aún no tenga cuotas o que no sea de LaLiga).</p>
    <p><a class="btn" href="/pronosticos">Ver los pronósticos de la jornada</a></p></section></main>` + FOOTER + SCRIPTS;
}

export default async function handler(req, res) {
  const wanted = String(req.query.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const url = `${SITE}/pronostico/${wanted}`;
  const upcoming = await fetchSelf(req, "/api/upcoming");
  const match = (upcoming?.matches || []).find((m) => matchSlug(m.home_team, m.away_team, m.kickoff) === wanted);
  if (match && match.prediction) return sendHtml(res, upcomingPage(match, url));

  const [history, picks] = await Promise.all([fetchSelf(req, "/api/predictions-history"), fetchSelf(req, "/api/picks")]);
  const played = (history?.history || []).find((h) => matchSlug(h.home_team, h.away_team, h.match_date) === wanted);
  if (played) {
    const its = (picks?.picks || []).filter((p) => p.match_id === played.match_id);
    return sendHtml(res, playedPage(played, its, url), { maxAge: 3600 });
  }
  if (!upcoming) {
    return sendHtml(res, notFoundPage(url).replace("Partido no encontrado", "Datos no disponibles ahora mismo"), { status: 503, maxAge: 60 });
  }
  return sendHtml(res, notFoundPage(url), { status: 404, maxAge: 600 });
}
