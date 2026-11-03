// Página "Pronósticos LaLiga de la jornada" (/pronosticos, rewrite en
// vercel.json), generada en el servidor: es la puerta de entrada desde
// Google ("pronósticos laliga") y enlaza a la página de cada partido.

import { FOOTER, HEADER, SCRIPTS, SITE, head } from "./_lib/layout.js";
import { dateLong, esc, fetchSelf, matchSlug, odds, pct, sendHtml, shareBar, signedPct, teamName } from "./_lib/site.js";

export default async function handler(req, res) {
  const [upcoming, history, picks] = await Promise.all([
    fetchSelf(req, "/api/upcoming"), fetchSelf(req, "/api/predictions-history"), fetchSelf(req, "/api/picks"),
  ]);
  const matches = (upcoming?.matches || []).filter((m) => m.prediction);
  const url = `${SITE}/pronosticos`;

  const cards = matches.map((m) => {
    const home = teamName(m.home_team), away = teamName(m.away_team);
    const p = m.prediction, s = p.sin_cuotas.probabilities, g = p.markets.goals;
    const fav = s.H >= s.A && s.H >= s.D ? `${home} (${pct(s.H)})` : s.A >= s.D ? `${away} (${pct(s.A)})` : `Empate (${pct(s.D)})`;
    const nPicks = (p.picks || []).length;
    return `<a class="mini-match" href="/pronostico/${matchSlug(m.home_team, m.away_team, m.kickoff)}">
      <div class="meta"><span>${esc(dateLong(m.kickoff))}</span>${nPicks ? `<span class="pill green">${nPicks} con valor</span>` : ""}</div>
      <h3 style="font-size:17px">${esc(home)} – ${esc(away)}</h3>
      <div class="meta"><span>Favorito: ${esc(fav)}</span><span>+2.5 goles ${pct(g.over_25)}</span></div>
      <div class="meta"><span>Córners ${p.markets.corners.expected_total.toFixed(1)} · Tarjetas ${p.markets.cards.expected_total.toFixed(1)}</span><span>Ver pronóstico →</span></div>
    </a>`;
  }).join("");

  const allPicks = matches.flatMap((m) => (m.prediction.picks || []).map((pk) => ({ pk, m }))).sort((a, b) => b.pk.edge - a.pk.edge);
  const picksList = allPicks.length
    ? `<ul class="plain-list">${allPicks.map(({ pk, m }) => `<li><b>${esc(pk.label)}</b> a ${odds(pk.odds)} en ${esc(pk.bookmaker_title)} — <a href="/pronostico/${matchSlug(m.home_team, m.away_team, m.kickoff)}">${esc(teamName(m.home_team))} – ${esc(teamName(m.away_team))}</a> <span class="muted small">(valor ${signedPct(pk.edge)})</span></li>`).join("")}</ul>`
    : `<p class="muted">Ahora mismo no hay cuotas con valor claro. Se revisan cada mañana.</p>`;

  const resolved = (history?.history || []).filter((h) => h.resolved).slice(0, 12);
  const recent = resolved.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Partido</th><th>Predicción del modelo</th><th>Resultado</th></tr></thead><tbody>${resolved.map((h) => {
    const label = { H: teamName(h.home_team), D: "Empate", A: teamName(h.away_team) }[h.sin_cuotas.prediction];
    return `<tr><td>${esc(h.match_date)}</td><td><a href="/pronostico/${matchSlug(h.home_team, h.away_team, h.match_date)}">${esc(teamName(h.home_team))} – ${esc(teamName(h.away_team))}</a></td>
      <td class="${h.sin_cuotas_correct ? "pos" : "neg"}">${h.sin_cuotas_correct ? "✓" : "✗"} ${esc(label)} (${pct(h.sin_cuotas.probabilities[h.sin_cuotas.prediction])})</td><td>${h.actual_home_goals}-${h.actual_away_goals}</td></tr>`;
  }).join("")}</tbody></table></div>` : "";

  const s = picks?.summary;
  const record = s && s.settled > 0
    ? `Registro público de apuestas: ${s.won} acertadas, ${s.lost} falladas, beneficio ${s.profit_units > 0 ? "+" : ""}${s.profit_units.toFixed(2)} unidades.`
    : "El registro público de apuestas en vivo empezó en noviembre de 2026; el backtest 2019-2026 con cuotas reales está en Resultados.";

  const first = matches[0]?.kickoff, last = matches[matches.length - 1]?.kickoff;
  const range = first ? `del ${dateLong(first.slice(0, 10))} al ${dateLong(last.slice(0, 10))}` : "";
  const jsonLd = [{
    "@context": "https://schema.org", "@type": "ItemList", name: "Pronósticos LaLiga",
    itemListElement: matches.map((m, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/pronostico/${matchSlug(m.home_team, m.away_team, m.kickoff)}`, name: `${teamName(m.home_team)} vs ${teamName(m.away_team)}` })),
  }];

  const html = head({
    title: "Pronósticos LaLiga de la jornada: predicciones, goles, córners y apuestas con valor",
    description: `Pronósticos de todos los partidos de LaLiga ${range}: probabilidades del modelo propio, goles, córners, tarjetas, mejores cuotas y apuestas con valor registradas antes de cada partido.`,
    path: "/pronosticos", jsonLd,
  }) + HEADER + `
<main class="wrap">
  <section class="page-header">
    <div class="eyebrow">LaLiga · ${esc(range || "próxima jornada")}</div>
    <h1>Pronósticos de LaLiga de la jornada</h1>
    <p class="lead">Probabilidades de cada partido según un modelo propio validado con 11 temporadas reales, junto a lo que dicen las casas de apuestas. ${esc(record)}</p>
    ${shareBar(url, "Pronósticos de LaLiga de la jornada con probabilidades, goles, córners y apuestas con valor:")}
  </section>
  ${matches.length ? `<div class="preview-grid">${cards}</div>` : `<div class="empty">Los pronósticos de la jornada se preparan cada mañana. Vuelve en un rato.</div>`}
  <section class="section">
    <h2>Apuestas con valor de la jornada</h2>
    ${picksList}
    <p><a href="/apuestas.html">Stake en euros según tu bank y registro completo →</a></p>
  </section>
  ${recent ? `<section class="section"><h2>Últimos resultados frente a la predicción</h2>${recent}<p class="muted small" style="margin-top:10px">Acertar el resultado más probable da poca información por sí solo: lo relevante es si las apuestas con valor ganan dinero a largo plazo — <a href="/estadisticas.html">ver resultados</a>.</p></section>` : ""}
</main>` + FOOTER + SCRIPTS;
  return sendHtml(res, html);
}
