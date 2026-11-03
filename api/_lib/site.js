// Utilidades de las páginas que se generan en el servidor (pronósticos
// por partido, página de la jornada y sitemap). Existen para que Google
// vea el contenido en el HTML: las páginas normales lo pintan con
// JavaScript en el navegador, y eso apenas se indexa.
//
// Copias deliberadas de cosas que ya hay en ui.js (nombres bonitos,
// slug de partido, formato de números): esto corre en Node y aquello en
// el navegador. Si cambias una, cambia la otra.

export const DISPLAY = {
  "Atl. Madrid": "Atlético de Madrid", "Ath Bilbao": "Athletic Club", "Betis": "Real Betis", "Celta Vigo": "Celta",
  "Alaves": "Alavés", "Malaga": "Málaga", "La Coruna": "Deportivo", "Racing Santander": "Racing de Santander",
  "Leganes": "Leganés", "Almeria": "Almería", "Cadiz": "Cádiz", "Sp Gijon": "Sporting de Gijón",
};
export const teamName = (key) => DISPLAY[key] || key || "";

export const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const pct = (p, d = 0) => (isNum(p) ? `${(p * 100).toFixed(d)}%` : "—");
export const odds = (o) => (isNum(o) ? o.toFixed(2) : "—");
export const signedPct = (p, d = 1) => (isNum(p) ? `${p > 0 ? "+" : ""}${(p * 100).toFixed(d)}%` : "—");

export function slug(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
// /pronostico/sevilla-vs-alaves-2026-11-06 (fecha UTC del partido: la
// misma que usa el backend en el histórico, así el enlace no cambia
// cuando el partido pasa de "próximo" a "jugado").
export const matchSlug = (homeKey, awayKey, isoDate) => `${slug(teamName(homeKey))}-vs-${slug(teamName(awayKey))}-${String(isoDate).slice(0, 10)}`;

export function dateLong(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || "");
  const day = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  if (String(iso).length <= 10) return day;
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  return `${day}, ${time} (hora peninsular)`;
}

export async function fetchSelf(req, path) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || (String(host).startsWith("localhost") ? "http" : "https");
  try {
    const res = await fetch(`${proto}://${host}${path}`);
    const data = await res.json();
    return res.ok && data.ok !== false ? data : null;
  } catch {
    return null;
  }
}

export function probBar(probs, home, away) {
  const seg = (cls, p) => `<div class="pb-seg ${cls}" style="flex-basis:${(p * 100).toFixed(1)}%"><span>${p >= 0.12 ? pct(p) : ""}</span></div>`;
  return `<div class="prob-bar">${seg("h", probs.H)}${seg("d", probs.D)}${seg("a", probs.A)}</div>
    <div class="pb-legend"><span>${esc(home)} ${pct(probs.H)}</span><span>Empate ${pct(probs.D)}</span><span>${esc(away)} ${pct(probs.A)}</span></div>`;
}

export function shareBar(url, text) {
  const enc = encodeURIComponent;
  return `<div class="share-bar" data-share-url="${esc(url)}" data-share-text="${esc(text)}">
    <span class="muted small">Compartir:</span>
    <a class="pill" href="https://wa.me/?text=${enc(`${text} ${url}`)}" target="_blank" rel="noopener">WhatsApp</a>
    <a class="pill" href="https://t.me/share/url?url=${enc(url)}&text=${enc(text)}" target="_blank" rel="noopener">Telegram</a>
    <a class="pill" href="https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}" target="_blank" rel="noopener">X</a>
    <button class="pill" type="button" data-share-copy>Copiar enlace</button>
  </div>`;
}

const STATUS = { won: ["Acertada", "won"], lost: ["Fallada", "lost"], push: ["Devuelta", "push"], pending: ["Pendiente", "pending"] };
export const resultChip = (s) => `<span class="chip-result ${(STATUS[s] || STATUS.pending)[1]}">${(STATUS[s] || [s])[0]}</span>`;

export function pickCard(p) {
  const registered = p.created_at ? `<span class="tag">Registrada ${esc(dateLong(p.created_at))}</span>` : "";
  return `<article class="pick-card ${p.experimental ? "experimental" : ""}">
    <div class="pick-body">
      <div class="pick-main">
        <span class="pick-market">${esc(p.market_label || "")}${p.experimental ? " · experimental" : ""}</span>
        <span class="pick-label">${esc(p.label || "")}</span>
        <span class="pick-book">en <b>${esc(p.bookmaker_title || p.bookmaker || "")}</b></span>
      </div>
      <div class="pick-odds"><span class="k">Cuota</span><span class="v">${odds(p.odds)}</span></div>
    </div>
    <div class="pick-metrics">
      <div><span class="k">Cuota justa</span><span class="v">${odds(p.fair_odds)}</span></div>
      <div><span class="k">Valor esperado</span><span class="v pos">${signedPct(p.edge)}</span></div>
      <div><span class="k">Stake</span><span class="v">${(p.stake_pct ?? 0).toFixed(2)}% del bank</span></div>
    </div>
    <div class="pick-foot">${registered}${p.status ? resultChip(p.status) : ""}</div>
  </article>`;
}

export function sendHtml(res, html, { status = 200, maxAge = 1800 } = {}) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=86400`);
  res.status(status).send(html);
}
