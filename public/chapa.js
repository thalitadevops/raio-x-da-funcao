// Desenha a "chapa de raio-x": cada tarefa vira um osso. O comprimento é o
// tempo semanal; a parte que brilha é o tempo que a IA pode assumir.

const W = 900;
const LINHA = 54;
const TOPO = 62;
const X0 = 290;      // onde começam os ossos
const MARGEM_D = 70; // espaço à direita para o número de horas

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function osso(x, y, L) {
  const r = 8;
  L = Math.max(L, r * 4);
  return `
    <rect x="${x + r}" y="${y - 5}" width="${L - 2 * r}" height="10" rx="5"/>
    <circle cx="${x + r}" cy="${y - 6}" r="${r}"/><circle cx="${x + r}" cy="${y + 6}" r="${r}"/>
    <circle cx="${x + L - r}" cy="${y - 6}" r="${r}"/><circle cx="${x + L - r}" cy="${y + 6}" r="${r}"/>`;
}

function cortar(texto, max = 31) {
  return texto.length > max ? texto.slice(0, max - 1) + "…" : texto;
}

export function desenharChapa(tarefas, { id = "", data = "" } = {}) {
  const H = TOPO + tarefas.length * LINHA + 40;
  const maxH = Math.max(...tarefas.map((t) => t.horas), 1);
  const escala = (W - X0 - MARGEM_D) / maxH;
  const uid = Math.random().toString(36).slice(2, 8);

  // Régua de horas no topo
  const passo = maxH > 20 ? 5 : maxH > 8 ? 2 : 1;
  let regua = "";
  for (let h = 0; h <= maxH + 0.001; h += passo) {
    const x = X0 + h * escala;
    regua += `<line x1="${x}" y1="34" x2="${x}" y2="${h % (passo * 2) === 0 ? 44 : 40}"/>`;
    if (h % (passo * 2) === 0) regua += `<text x="${x}" y="28" text-anchor="middle">${h}h</text>`;
  }

  const linhas = tarefas
    .map((t, i) => {
      const y = TOPO + i * LINHA + LINHA / 2;
      const L = t.horas * escala;
      const Lm = Math.max(L, 32);
      return `
      <g>
        <text class="rotulo" x="24" y="${y + 5}">${esc(cortar(t.nome))}</text>
        <g class="osso-base">${osso(X0, y, L)}</g>
        <clipPath id="c${uid}${i}"><rect x="${X0}" y="${y - 20}" width="${(Lm * t.pct) / 100}" height="40"/></clipPath>
        <g class="osso-luz" clip-path="url(#c${uid}${i})" filter="url(#brilho${uid})" style="animation-delay:${0.25 + i * 0.12}s">${osso(X0, y, L)}</g>
        <text class="horas" x="${X0 + Lm + 12}" y="${y + 5}">${formatar(t.horas)}h</text>
      </g>`;
    })
    .join("");

  return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chapa com ${tarefas.length} tarefas">
    <defs>
      <filter id="brilho${uid}" x="-10%" y="-80%" width="120%" height="260%">
        <feGaussianBlur stdDeviation="3.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="vinheta${uid}" cx="50%" cy="45%" r="75%">
        <stop offset="0" stop-color="#1d2f3a"/><stop offset="1" stop-color="#0a1218"/>
      </radialGradient>
      <linearGradient id="scan${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#dfeaf0" stop-opacity="0"/><stop offset="1" stop-color="#dfeaf0" stop-opacity=".35"/>
      </linearGradient>
    </defs>
    <style>
      text { font-family: Archivo, sans-serif; font-stretch: 80%; }
      .rotulo { fill: #a9bec9; font-size: 16px; }
      .horas { fill: #7d93a0; font-size: 14px; }
      .regua line { stroke: #4c6370; stroke-width: 1; }
      .regua text { fill: #5f7784; font-size: 12px; }
      .osso-base { fill: #dfeaf0; opacity: .13; }
      .osso-luz { fill: #f4f9fc; }
      .marca { fill: #dfeaf0; opacity: .75; font-size: 13px; font-stretch: 70%; }
      .letra { fill: #dfeaf0; opacity: .85; font-size: 30px; font-weight: 800; font-stretch: 62%; }
    </style>
    <rect width="${W}" height="${H}" fill="url(#vinheta${uid})"/>
    <g class="regua">${regua}</g>
    ${linhas}
    <text class="letra" x="${W - 34}" y="${H - 16}">D</text>
    <text class="marca" x="24" y="${H - 18}">${esc(id)}${data ? "   " + esc(data) : ""}</text>
    <rect class="varredura" x="0" y="${-H}" width="${W}" height="${H}" fill="url(#scan${uid})"/>
  </svg>`;
}

function formatar(h) {
  return (Math.round(h * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
