import { montarWorkflowN8n } from "./n8n.js";
import { desenharChapa } from "./chapa.js";
import { DEMOS, planoDoExemplo } from "./demo.js";

const PERGUNTAS_ESPERADAS = 7;

const estado = {
  perfil: null,
  mensagens: [], // { role: "user" | "assistant", content }
  relatorio: null,
  demo: null, // exemplo em exibição, ou null
  ocupado: false,
  numero: "",
};

const $ = (sel) => document.querySelector(sel);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const reduzirMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;

function novoNumeroExame() {
  return `${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}
$("#num-exame").textContent = `Exame nº ${novoNumeroExame()}`;

function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.toggle("ativa", t.id === id));
  window.scrollTo({ top: 0, behavior: reduzirMovimento ? "auto" : "smooth" });
}

function escapar(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function formatarHoras(h) {
  return (Math.round(h * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function hoje() {
  return new Date().toLocaleDateString("pt-BR");
}

// ---------- API ----------
async function postar(url, corpo) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.erro || `erro ${resp.status}`);
  return data;
}

// ---------- Anamnese ----------
const conversa = () => $("#conversa");

function rolarConversa() {
  conversa().scrollTop = conversa().scrollHeight;
}

function adicionarPergunta(texto) {
  const li = document.createElement("li");
  li.className = "par";
  const p = document.createElement("div");
  p.className = "pergunta";
  p.textContent = texto;
  li.appendChild(p);
  conversa().appendChild(li);
  rolarConversa();
}

function adicionarResposta(texto) {
  const ultimo = conversa().querySelector(".par:last-of-type");
  const r = document.createElement("p");
  r.className = "resposta-escrita";
  r.textContent = texto;
  (ultimo || conversa()).appendChild(r);
  rolarConversa();
}

function adicionarAviso(classe, texto) {
  const li = document.createElement("li");
  li.className = classe;
  li.textContent = texto;
  conversa().appendChild(li);
  rolarConversa();
  return li;
}

function atualizarProgresso() {
  const respondidas = estado.mensagens.filter((m) => m.role === "user").length;
  $("#contador").textContent = `Pergunta ${respondidas + 1}`;
  $("#barra-progresso").style.width = `${Math.min(95, ((respondidas + 1) / PERGUNTAS_ESPERADAS) * 100)}%`;
  $("#btn-finalizar").disabled = !!estado.demo || estado.ocupado || respondidas < 3;
}

function travar(ocupado) {
  estado.ocupado = ocupado;
  $("#btn-enviar").disabled = ocupado || !!estado.demo;
  $("#resposta").disabled = ocupado || !!estado.demo;
  atualizarProgresso();
}

async function proximoPasso({ finalizar = false } = {}) {
  travar(true);
  const aviso = adicionarAviso("aguardando", finalizar ? "Emitindo o laudo" : "O agente está escrevendo");
  try {
    const data = await postar("/api/entrevista", {
      perfil: estado.perfil,
      mensagens: estado.mensagens,
      finalizar,
    });
    aviso.remove();
    if (data.tipo === "relatorio") {
      mostrarRelatorio(data.relatorio);
      return;
    }
    estado.mensagens.push({ role: "assistant", content: data.texto });
    adicionarPergunta(data.texto);
  } catch (err) {
    aviso.remove();
    adicionarAviso("erro", `O agente não respondeu (${err.message}). Envie a resposta de novo.`);
  } finally {
    travar(false);
    if (!estado.demo) $("#resposta").focus();
  }
}

function iniciarEntrevista(perfil) {
  estado.perfil = perfil;
  estado.mensagens = [];
  estado.relatorio = null;
  estado.numero = estado.demo ? estado.demo.numero : novoNumeroExame();
  conversa().innerHTML = "";
  $("#rotulo-perfil").textContent = `${perfil.cargo}${estado.demo ? " (exemplo)" : ""}`;
  mostrarTela("tela-entrevista");
  atualizarProgresso();
}

$("#form-perfil").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  estado.demo = null;
  iniciarEntrevista({
    cargo: f.get("cargo").trim(),
    area: f.get("area").trim(),
    ferramentas: f.get("ferramentas").trim(),
  });
  proximoPasso();
});

$("#form-resposta").addEventListener("submit", (e) => {
  e.preventDefault();
  const texto = $("#resposta").value.trim();
  if (!texto || estado.ocupado) return;
  $("#resposta").value = "";
  estado.mensagens.push({ role: "user", content: texto });
  adicionarResposta(texto);
  proximoPasso();
});

$("#resposta").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#form-resposta").requestSubmit();
  }
});

$("#btn-finalizar").addEventListener("click", () => proximoPasso({ finalizar: true }));

// ---------- Exame de exemplo ----------
async function escreverNaFolha(texto) {
  const caixa = $("#resposta");
  caixa.value = "";
  for (let i = 0; i < texto.length; i += 3) {
    caixa.value = texto.slice(0, i + 3);
    await esperar(14);
  }
}

async function rodarExemplo(demo) {
  estado.demo = demo;
  iniciarEntrevista(demo.perfil);
  travar(true);
  const rapido = reduzirMovimento || new URLSearchParams(location.search).has("rapido");
  const pausa = (ms) => esperar(rapido ? 0 : ms);
  for (const passo of demo.roteiro) {
    const aviso = adicionarAviso("aguardando", "O agente está escrevendo");
    await pausa(800);
    aviso.remove();
    estado.mensagens.push({ role: "assistant", content: passo.pergunta });
    adicionarPergunta(passo.pergunta);
    await pausa(400);
    if (!rapido) await escreverNaFolha(passo.resposta);
    await pausa(250);
    $("#resposta").value = "";
    estado.mensagens.push({ role: "user", content: passo.resposta });
    adicionarResposta(passo.resposta);
    atualizarProgresso();
  }
  const aviso = adicionarAviso("aguardando", "Emitindo o laudo");
  await pausa(1100);
  aviso.remove();
  travar(false);
  mostrarRelatorio(demo.relatorio);
}

document.querySelectorAll("[data-demo]").forEach((btn) =>
  btn.addEventListener("click", () => rodarExemplo(DEMOS.find((d) => d.id === btn.dataset.demo)))
);

// ---------- Laudo ----------
function calcular(relatorio) {
  const tarefas = relatorio.tarefas.map((t) => {
    const horas = Math.max(0, Number(t.horas_por_semana) || 0);
    const pct = Math.min(100, Math.max(0, Number(t.percentual_automatizavel) || 0));
    return { ...t, horas, pct, economia: (horas * pct) / 100 };
  });
  tarefas.sort((a, b) => b.economia - a.economia);
  const mapeadas = tarefas.reduce((s, t) => s + t.horas, 0);
  const economia = tarefas.reduce((s, t) => s + t.economia, 0);
  const diasMes = (economia * 4.33) / 8; // 4,33 semanas por mês, jornada de 8 h
  return { tarefas, mapeadas, economia, diasMes };
}

const NOME_POTENCIAL = { alto: "alto", medio: "médio", baixo: "baixo" };

function mostrarRelatorio(relatorio) {
  const calc = calcular(relatorio);
  estado.relatorio = { ...relatorio, ...calc };

  $("#titulo-relatorio").textContent = estado.perfil.cargo;
  $("#laudo-num").textContent = estado.numero;
  $("#laudo-data").textContent = hoje();
  $("#resumo-funcao").textContent = relatorio.resumo_funcao;
  $("#n-mapeadas").textContent = formatarHoras(calc.mapeadas) + "h";
  $("#n-economia").textContent = formatarHoras(calc.economia) + "h";
  $("#n-dias").textContent = formatarHoras(calc.diasMes);
  $("#primeiro-passo").textContent = relatorio.primeiro_passo;

  const chapa = $("#chapa");
  chapa.classList.remove("revelar");
  chapa.innerHTML = desenharChapa(calc.tarefas, { id: `Exame ${estado.numero}`, data: hoje() });
  void chapa.offsetWidth;
  chapa.classList.add("revelar");

  $("#lista-tarefas").innerHTML = calc.tarefas
    .map(
      (t, i) => `
      <div class="achado">
        <span class="achado-num">${i + 1}</span>
        <div>
          <div class="achado-topo">
            <h4>${escapar(t.nome)}</h4>
            <span class="potencial ${escapar(t.potencial)}">potencial ${NOME_POTENCIAL[t.potencial] || escapar(t.potencial)}</span>
          </div>
          <p class="achado-horas">${escapar(t.frequencia)}, ${formatarHoras(t.horas)}h por semana hoje; a IA pode assumir <b>${formatarHoras(t.economia)}h</b> (${Math.round(t.pct)}%)</p>
          <dl>
            <dt>Hoje</dt><dd>${escapar(t.descricao)}</dd>
            <dt>Com IA</dt><dd>${escapar(t.como_automatizar)}</dd>
            <dt>Fica com você</dt><dd>${escapar(t.o_que_continua_humano)}</dd>
            <dt>Ferramentas</dt><dd class="ferramentas">${escapar((t.ferramentas_sugeridas || []).join(", "))}</dd>
          </dl>
          ${t.potencial !== "baixo" ? `<button type="button" class="botao" data-fluxo="${i}">Receitar o fluxo para o n8n</button>` : ""}
        </div>
      </div>`
    )
    .join("");

  mostrarTela("tela-relatorio");
}

$("#lista-tarefas").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-fluxo]");
  if (btn) abrirFluxo(estado.relatorio.tarefas[Number(btn.dataset.fluxo)]);
});

function relatorioMarkdown() {
  const r = estado.relatorio;
  return [
    `# Laudo do Raio-X da Função`,
    "",
    `**Paciente:** ${estado.perfil.cargo}  `,
    `**Exame nº:** ${estado.numero}  `,
    `**Data:** ${hoje()}`,
    "",
    "## Conclusão",
    `Das ${formatarHoras(r.mapeadas)}h semanais mapeadas, a IA pode assumir ${formatarHoras(r.economia)}h, o equivalente a ${formatarHoras(r.diasMes)} dias de trabalho por mês.`,
    "",
    r.resumo_funcao,
    "",
    "## Conduta recomendada",
    r.primeiro_passo,
    "",
    "## Achados",
    "| Tarefa | Frequência | Hoje (h/sem) | IA assume (h/sem) | Potencial |",
    "| --- | --- | --- | --- | --- |",
    ...r.tarefas.map((t) => `| ${t.nome} | ${t.frequencia} | ${formatarHoras(t.horas)} | ${formatarHoras(t.economia)} | ${NOME_POTENCIAL[t.potencial] || t.potencial} |`),
    "",
    ...r.tarefas.flatMap((t) => [
      `### ${t.nome}`,
      `- Hoje: ${t.descricao}`,
      `- Com IA: ${t.como_automatizar}`,
      `- Fica com você: ${t.o_que_continua_humano}`,
      `- Ferramentas: ${(t.ferramentas_sugeridas || []).join(", ")}`,
      "",
    ]),
    "_Laudo emitido por agente de IA. Revisão humana recomendada._",
  ].join("\n");
}

function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nomeDeArquivo(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

$("#btn-imprimir").addEventListener("click", () => window.print());
$("#btn-baixar-relatorio").addEventListener("click", () => {
  baixar(`laudo-${nomeDeArquivo(estado.perfil.cargo)}.md`, relatorioMarkdown(), "text/markdown");
});
$("#btn-recomecar").addEventListener("click", () => {
  estado.demo = null;
  $("#form-perfil").reset();
  $("#num-exame").textContent = `Exame nº ${novoNumeroExame()}`;
  mostrarTela("tela-inicio");
});

// ---------- Receita (fluxo n8n) ----------
const NOME_TIPO = {
  agendado: "agendado", webhook: "webhook", manual: "manual", novo_email: "novo e-mail",
  ia_claude: "IA (Claude)", google_sheets: "Google Sheets", gmail: "Gmail", slack: "Slack",
  http: "requisição HTTP", codigo: "código", condicao: "condição", definir_campos: "campos", whatsapp: "WhatsApp",
  extrair_arquivo: "ler arquivo", juntar_itens: "juntar itens",
};

async function abrirFluxo(tarefa) {
  const painel = $("#painel-fluxo");
  $("#fluxo-nome").textContent = tarefa.nome;
  $("#fluxo-conteudo").innerHTML = `<p class="carregando">Escrevendo a receita</p>`;
  painel.showModal();
  try {
    let plano;
    if (estado.demo) {
      await esperar(reduzirMovimento ? 0 : 700);
      plano = planoDoExemplo(estado.demo, tarefa);
    } else {
      plano = (await postar("/api/fluxo", { perfil: estado.perfil, tarefa })).plano;
    }
    mostrarFluxo(plano);
  } catch (err) {
    $("#fluxo-conteudo").innerHTML = `<p class="erro">Não deu para montar o fluxo (${escapar(err.message)}). Feche e tente de novo.</p>`;
  }
}

function mostrarFluxo(plano) {
  const workflow = montarWorkflowN8n(plano);
  const json = JSON.stringify(workflow, null, 2);
  $("#fluxo-nome").textContent = plano.nome_fluxo;

  const itens = [
    `<li class="gatilho"><strong>Quando rodar<span class="tipo">${escapar(NOME_TIPO[plano.gatilho.tipo] || plano.gatilho.tipo)}</span></strong>
      <p class="faz">${escapar(plano.gatilho.detalhe)}</p></li>`,
    ...plano.passos.map(
      (p) => `<li><strong>${escapar(p.nome)}<span class="tipo">${escapar(NOME_TIPO[p.tipo] || p.tipo)}${p.imagem ? ", vê a imagem" : ""}</span></strong>
        <p class="faz">${escapar(p.o_que_faz)}</p>
        ${p.prompt ? `<p class="config">${escapar(p.prompt)}</p>` : ""}
        ${p.codigo ? `<pre class="codigo-passo">${escapar(p.codigo)}</pre>` : ""}
        ${p.configuracao && !/^nada a configurar/i.test(p.configuracao) ? `<p class="ajuste"><b>Você configura:</b> ${escapar(p.configuracao)}</p>` : ""}</li>`
    ),
  ].join("");

  $("#fluxo-conteudo").innerHTML = `
    <p class="receita-objetivo">${escapar(plano.objetivo)}</p>
    <ol class="prescricao">${itens}</ol>
    <div class="receita-rodape">
      <p><strong>Como testar:</strong> ${escapar(plano.como_testar)}</p>
      <p><strong>Economia estimada:</strong> ${formatarHoras(plano.horas_economizadas_semana)}h por semana</p>
      <div class="acoes">
        <button type="button" class="botao" id="btn-baixar-fluxo">Baixar o workflow para o n8n</button>
        <button type="button" class="botao-texto" id="btn-copiar-fluxo">Copiar para colar no n8n</button>
      </div>
      <details>
        <summary>Ver o JSON do workflow</summary>
        <pre>${escapar(json)}</pre>
      </details>
    </div>`;

  $("#btn-baixar-fluxo").addEventListener("click", () =>
    baixar(`${nomeDeArquivo(plano.nome_fluxo)}.n8n.json`, json, "application/json")
  );
  $("#btn-copiar-fluxo").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(json);
      e.target.textContent = "Copiado. No n8n, clique na tela e cole com Ctrl+V";
    } catch {
      e.target.textContent = "Não deu para copiar; use o download";
    }
  });
}

$("#btn-fechar-fluxo").addEventListener("click", () => $("#painel-fluxo").close());
$("#painel-fluxo").addEventListener("click", (e) => {
  if (e.target.id === "painel-fluxo") e.target.close();
});

// ---------- Chapa de exemplo na abertura ----------
$("#chapa-exemplo").innerHTML = desenharChapa(calcular(DEMOS[0].relatorio).tarefas, { id: `Exame ${DEMOS[0].numero}` });
