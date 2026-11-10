/* Componentes de interfaz compartidos (sí tocan el DOM, a diferencia de
   common.js, que solo carga datos). Todo devuelve HTML como texto o
   pinta en un elemento que se le pasa: sin framework ni build, igual que
   el resto del sitio.

   Cárgalo después de common.js:
   <script src="common.js"></script>
   <script src="ui.js"></script>
*/

const UI = (() => {
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const pct = (p, digits = 0) => (num(p) === null ? "—" : `${(p * 100).toFixed(digits)}%`);
  const signedPct = (p, digits = 1) => (num(p) === null ? "—" : `${p > 0 ? "+" : ""}${(p * 100).toFixed(digits)}%`);
  const odds = (o) => (num(o) === null ? "—" : o.toFixed(2));
  const units = (u, digits = 2) => (num(u) === null ? "—" : `${u > 0 ? "+" : ""}${u.toFixed(digits)} u`);
  const money = (eur, signed = false) => {
    if (num(eur) === null) return "—";
    const text = eur.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${signed && eur > 0 ? "+" : ""}${text} €`;
  };

  function dateLabel(iso, withTime = true) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const day = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
    if (!withTime || iso.length <= 10) return day;
    return `${day} · ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  }

  // Nombre para enseñar a partir de la clave del modelo (las claves vienen
  // de football-data.co.uk, sin tildes). Misma tabla que team_names.py en
  // el backend.
  const DISPLAY = {
    "Atl. Madrid": "Atlético de Madrid", "Ath Bilbao": "Athletic Club", "Betis": "Real Betis", "Celta Vigo": "Celta",
    "Alaves": "Alavés", "Malaga": "Málaga", "La Coruna": "Deportivo", "Racing Santander": "Racing de Santander",
    "Leganes": "Leganés", "Almeria": "Almería", "Cadiz": "Cádiz", "Sp Gijon": "Sporting de Gijón",
  };
  const teamName = (key) => DISPLAY[key] || key || "";

  // Enlace a la página de pronóstico del partido (la genera el servidor,
  // ver api/pronostico.js — misma función de slug allí).
  const slug = (text) => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const matchUrl = (homeKey, awayKey, iso) => `/pronostico/${slug(teamName(homeKey))}-vs-${slug(teamName(awayKey))}-${String(iso).slice(0, 10)}`;

  // Colores de cada club (solo el color, como círculo con iniciales: no
  // se usan escudos ni marcas registradas).
  const TEAM_COLORS = {
    "Real Madrid": ["#f4f4f4", "#1b2a59"], "Barcelona": ["#a50044", "#f4c41b"], "Atl. Madrid": ["#cb3524", "#f4f4f4"],
    "Ath Bilbao": ["#ee2523", "#f4f4f4"], "Betis": ["#0bb363", "#f4f4f4"], "Sevilla": ["#f4f4f4", "#d81920"],
    "Real Sociedad": ["#0067b1", "#f4f4f4"], "Villarreal": ["#ffe667", "#005187"], "Valencia": ["#f4f4f4", "#ee3524"],
    "Celta Vigo": ["#8ac3ee", "#1b2a59"], "Osasuna": ["#d91a21", "#0a346f"], "Getafe": ["#005999", "#f4f4f4"],
    "Rayo Vallecano": ["#f4f4f4", "#e53027"], "Espanyol": ["#007fc8", "#f4f4f4"], "Alaves": ["#0761af", "#f4f4f4"],
    "Mallorca": ["#e20613", "#1d1d1b"], "Girona": ["#cd2534", "#f4f4f4"], "Elche": ["#0b8a3e", "#f4f4f4"],
    "Levante": ["#b4053f", "#004d98"], "Malaga": ["#2b6db3", "#f4f4f4"], "La Coruna": ["#1d4ea0", "#f4f4f4"],
    "Racing Santander": ["#0b7a3b", "#f4f4f4"], "Oviedo": ["#0a4ea2", "#f4f4f4"], "Las Palmas": ["#fde02a", "#0059a8"],
    "Valladolid": ["#6a2c91", "#f4f4f4"], "Leganes": ["#1f4e9c", "#f4f4f4"], "Granada": ["#c4161c", "#f4f4f4"],
    "Almeria": ["#ee1119", "#f4f4f4"], "Cadiz": ["#fde20f", "#0045a7"],
  };
  function initials(name) {
    const clean = teamName(name).replace(/^(Real|RCD|CD|UD|CA|SD|RC)\s+/i, "").replace(/ de /g, " ");
    const parts = clean.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : clean.slice(0, 3)).toUpperCase();
  }
  function badge(key, size = "") {
    const [bg, fg] = TEAM_COLORS[key] || ["#2c3728", "#f2f3ed"];
    return `<span class="team-badge ${size}" style="--b1:${bg};--b2:${fg}" aria-hidden="true">${esc(initials(key))}</span>`;
  }

  function probBar(probs, homeKey, awayKey, { compact = false } = {}) {
    if (!probs) return "";
    const h = probs.H ?? 0, d = probs.D ?? 0, a = probs.A ?? 0;
    const seg = (cls, p, label) => `<div class="pb-seg ${cls}" style="flex-basis:${(p * 100).toFixed(1)}%" title="${esc(label)} ${pct(p)}"><span>${p >= 0.12 ? pct(p) : ""}</span></div>`;
    const legend = compact ? "" : `<div class="pb-legend"><span>${esc(teamName(homeKey))} ${pct(h)}</span><span>Empate ${pct(d)}</span><span>${esc(teamName(awayKey))} ${pct(a)}</span></div>`;
    return `<div class="prob-bar ${compact ? "compact" : ""}">${seg("h", h, teamName(homeKey))}${seg("d", d, "Empate")}${seg("a", a, teamName(awayKey))}</div>${legend}`;
  }

  const STATUS = { won: ["Acertada", "won"], lost: ["Fallada", "lost"], push: ["Devuelta", "push"], pending: ["Pendiente", "pending"], void: ["Anulada", "push"] };
  const resultChip = (status) => {
    const [label, cls] = STATUS[status] || [status, "pending"];
    return `<span class="chip-result ${cls}">${label}</span>`;
  };

  // Alternativa en una casa que opera en España (desde el 10/11/2026; las
  // apuestas anteriores no tienen el dato y no enseñan nada).
  function spainLine(pick) {
    if (pick.spain_bookmaker === undefined) return "";
    if (pick.spain_bookmaker === null) return `<div class="pick-spain">Ninguna casa que opere en España de las que seguimos ofrece esta apuesta.</div>`;
    if (pick.spain_bookmaker === pick.bookmaker) return `<div class="pick-spain">Casa que opera en España.</div>`;
    return pick.spain_value
      ? `<div class="pick-spain">En España: <b>${esc(pick.spain_bookmaker_title)}</b> a <b>${odds(pick.spain_odds)}</b> (valor ${signedPct(pick.spain_edge)}).</div>`
      : `<div class="pick-spain">En España, lo mejor es <b>${esc(pick.spain_bookmaker_title)}</b> a ${odds(pick.spain_odds)}: no llega al 2% de valor (${signedPct(pick.spain_edge)}).</div>`;
  }

  function pickCard(pick, { bank = 100, match = null, showMatch = true } = {}) {
    const stakeEur = bank * (pick.stake_pct || 0) / 100;
    const model = num(pick.model_probability);
    const fair = num(pick.fair_probability) ?? (pick.fair_odds ? 1 / pick.fair_odds : null);
    let opinion = "";
    if (model !== null && fair !== null) {
      opinion = model >= fair
        ? `<span class="tag ok">El modelo propio coincide (${pct(model)})</span>`
        : `<span class="tag muted">El modelo propio es más prudente (${pct(model)})</span>`;
    }
    const home = match?.home_team || pick.home_team, away = match?.away_team || pick.away_team;
    const kickoff = match?.kickoff || pick.kickoff;
    const head = showMatch ? `<div class="pick-match">${badge(home, "sm")} <b>${esc(teamName(home))}</b> <span class="vs">vs</span> <b>${esc(teamName(away))}</b> ${badge(away, "sm")}<span class="pick-when">${esc(dateLabel(kickoff))}</span></div>` : "";
    return `<article class="pick-card ${pick.experimental ? "experimental" : ""}">
      ${head}
      <div class="pick-body">
        <div class="pick-main">
          <span class="pick-market">${esc(pick.market_label || "")}${pick.experimental ? ' · <span class="tag warn">experimental</span>' : ""}</span>
          <span class="pick-label">${esc(pick.label || "")}</span>
          <span class="pick-book">en <b>${esc(pick.bookmaker_title || pick.bookmaker || "")}</b></span>
        </div>
        <div class="pick-odds"><span class="k">Cuota</span><span class="v">${odds(pick.odds)}</span></div>
      </div>
      <div class="pick-metrics">
        <div><span class="k">Cuota justa</span><span class="v">${odds(pick.fair_odds)}</span></div>
        <div><span class="k">Valor esperado</span><span class="v pos">${signedPct(pick.edge)}</span></div>
        <div><span class="k">Stake</span><span class="v">${money(stakeEur)}</span><span class="k">${(pick.stake_pct ?? 0).toFixed(2)}% del bank</span></div>
      </div>
      ${spainLine(pick)}
      <div class="pick-foot">${opinion}${pick.created_at ? `<span class="tag" title="Hora a la que se registró: la cuota y la casa son las de ese momento">Registrada ${esc(dateLabel(pick.created_at))}</span>` : ""}${pick.status ? resultChip(pick.status) : ""}</div>
    </article>`;
  }

  // Gráfico de línea SVG (beneficio acumulado). points: [{x: etiqueta, y: número}].
  function lineChart(points, { height = 220, yFormat = (v) => v.toFixed(1), zeroLine = true } = {}) {
    if (!points || points.length < 2) return `<p class="muted">Todavía no hay datos suficientes para el gráfico.</p>`;
    const W = 720, H = height, pl = 46, pr = 12, pt = 14, pb = 26;
    const ys = points.map((p) => p.y);
    let lo = Math.min(...ys, 0), hi = Math.max(...ys, 0);
    if (hi === lo) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const x = (i) => pl + (i / (points.length - 1)) * (W - pl - pr);
    const y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
    const area = `${path} L${x(points.length - 1).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)} L${x(0).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)} Z`;
    const last = points[points.length - 1].y;
    const ticks = [lo + pad, (lo + hi) / 2, hi - pad].map((v) => `<g><line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${esc(yFormat(v))}</text></g>`).join("");
    const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}">${esc(points[i].x)}</text>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="chart ${last >= 0 ? "up" : "down"}" role="img" aria-label="Evolución: ${esc(yFormat(last))}">
      ${ticks}${zeroLine && lo < 0 && hi > 0 ? `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" class="zero"/>` : ""}
      <path d="${area}" class="area"/><path d="${path}" class="line"/>
      <circle cx="${x(points.length - 1)}" cy="${y(last)}" r="3.5" class="dot"/>${labels}</svg>`;
  }

  // Calibración: si el modelo dice 60%, ¿pasa el 60% de las veces?
  function calibrationChart(bins, { label = "Probabilidad" } = {}) {
    if (!bins || bins.length === 0) return "";
    const W = 320, H = 240, p = 36;
    const lo = Math.min(...bins.map((b) => Math.min(b.predicted, b.observed))) * 0.9;
    const hi = Math.max(...bins.map((b) => Math.max(b.predicted, b.observed))) * 1.05;
    const sx = (v) => p + ((v - lo) / (hi - lo)) * (W - p - 10);
    const sy = (v) => H - p + 4 - ((v - lo) / (hi - lo)) * (H - p - 14);
    const dots = bins.map((b) => `<circle cx="${sx(b.predicted)}" cy="${sy(b.observed)}" r="${Math.max(3, Math.min(9, Math.sqrt(b.n) / 2))}" class="dot"><title>Predicho ${pct(b.predicted)} · Real ${pct(b.observed)} · ${b.n} partidos</title></circle>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="chart calib" role="img" aria-label="Calibración de ${esc(label)}">
      <line x1="${sx(lo)}" y1="${sy(lo)}" x2="${sx(hi)}" y2="${sy(hi)}" class="diag"/>${dots}
      <text x="${W / 2}" y="${H - 4}" text-anchor="middle">Predicho por el modelo</text>
      <text x="10" y="${H / 2}" transform="rotate(-90 10 ${H / 2})" text-anchor="middle">Frecuencia real</text>
      <text x="${sx(lo)}" y="${H - p + 18}">${pct(lo)}</text><text x="${sx(hi)}" y="${H - p + 18}" text-anchor="end">${pct(hi)}</text></svg>`;
  }

  // Compartir: enlaces directos (funcionan sin JS) + copiar enlace / menú
  // nativo del móvil. Mismo HTML que api/_lib/site.js::shareBar.
  function shareBar(url, text) {
    const full = url.startsWith("http") ? url : `${location.origin}${url}`;
    const enc = encodeURIComponent;
    return `<div class="share-bar" data-share-url="${esc(full)}" data-share-text="${esc(text)}">
      <span class="muted small">Compartir:</span>
      <a class="pill" href="https://wa.me/?text=${enc(`${text} ${full}`)}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="pill" href="https://t.me/share/url?url=${enc(full)}&text=${enc(text)}" target="_blank" rel="noopener">Telegram</a>
      <a class="pill" href="https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(full)}" target="_blank" rel="noopener">X</a>
      <button class="pill" type="button" data-share-copy>Copiar enlace</button>
    </div>`;
  }
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-share-copy]");
    if (!btn) return;
    const bar = btn.closest(".share-bar");
    const url = bar.dataset.shareUrl, text = bar.dataset.shareText;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ title: text, text, url }); return; }
      await navigator.clipboard.writeText(url);
      btn.textContent = "¡Copiado!";
      setTimeout(() => { btn.textContent = "Copiar enlace"; }, 1800);
    } catch { /* el usuario canceló el menú de compartir */ }
  });

  // Invitación al canal de Telegram (solo si el backend lo tiene
  // configurado: el job diario publica allí las apuestas y resultados).
  function telegramCta(url) {
    if (!url) return "";
    return `<div class="telegram-cta"><div><b>Recibe cada apuesta en el móvil.</b> <span class="muted">El canal de Telegram publica automáticamente cada apuesta con valor en cuanto se registra, y su resultado al terminar el partido.</span></div><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Unirme al canal</a></div>`;
  }

  function tabs(root) {
    const buttons = [...root.querySelectorAll("[role=tab]")];
    const select = (btn) => {
      buttons.forEach((b) => {
        const on = b === btn;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(b.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
    };
    buttons.forEach((b, i) => {
      b.addEventListener("click", () => select(b));
      b.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const next = buttons[(i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length];
          next.focus(); select(next);
        }
      });
    });
    if (buttons[0]) select(buttons[0]);
  }

  // Menú móvil: botón ☰ que despliega la navegación (sin JS se queda la
  // tira horizontal deslizable de siempre).
  function initNav() {
    const header = document.querySelector("header");
    const nav = header?.querySelector("nav");
    if (!header || !nav || header.querySelector(".nav-toggle")) return;
    nav.id = nav.id || "mainNav";
    const btn = document.createElement("button");
    btn.className = "nav-toggle";
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", nav.id);
    btn.innerHTML = `<span></span><span></span><span></span><span class="sr-only">Menú</span>`;
    btn.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    header.classList.add("has-toggle");
    header.querySelector(".header-inner").appendChild(btn);
  }

  // Bank del usuario para traducir el stake (% del bank) a euros. Se
  // guarda solo en la URL (?bank=200), sin cookies ni almacenamiento
  // local, en línea con la política de privacidad del sitio.
  function readBank(defaultBank = 100) {
    const value = Number(new URLSearchParams(location.search).get("bank"));
    return Number.isFinite(value) && value > 0 ? value : defaultBank;
  }
  function writeBank(value) {
    const url = new URL(location.href);
    url.searchParams.set("bank", String(value));
    history.replaceState(null, "", url);
  }

  document.addEventListener("DOMContentLoaded", initNav);

  return { esc, pct, signedPct, odds, units, money, dateLabel, teamName, matchUrl, badge, probBar, resultChip, pickCard, shareBar, telegramCta, lineChart, calibrationChart, tabs, readBank, writeBank };
})();
