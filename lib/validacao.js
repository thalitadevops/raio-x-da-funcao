// Confere e conserta o que a IA devolve antes de mandar para o navegador.
import { jsonSeTexto } from "./anthropic.js";
import { TIPOS_DE_GATILHO, TIPOS_DE_PASSO } from "../public/n8n.js";

const texto = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function validarPlano(entrada) {
  const p = { ...(jsonSeTexto(entrada) || {}) };
  p.passos = jsonSeTexto(p.passos);
  p.gatilho = jsonSeTexto(p.gatilho);

  if (!Array.isArray(p.passos) || p.passos.length === 0) return { ok: false, erro: "faltou a lista 'passos'" };
  const passos = [];
  for (const [i, bruto] of p.passos.entries()) {
    const passo = jsonSeTexto(bruto);
    if (!passo || typeof passo !== "object") return { ok: false, erro: `o passo ${i + 1} não é um objeto` };
    if (!passo.nome) return { ok: false, erro: `o passo ${i + 1} está sem nome` };
    passos.push({
      ...passo,
      tipo: TIPOS_DE_PASSO.includes(passo.tipo) ? passo.tipo : "definir_campos",
      nome: texto(passo.nome),
      o_que_faz: texto(passo.o_que_faz),
      configuracao: texto(passo.configuracao),
    });
  }

  const g = p.gatilho && typeof p.gatilho === "object" ? p.gatilho : {};
  return {
    ok: true,
    valor: {
      nome_fluxo: texto(p.nome_fluxo) || "Fluxo do Raio-X",
      objetivo: texto(p.objetivo),
      gatilho: { ...g, tipo: TIPOS_DE_GATILHO.includes(g.tipo) ? g.tipo : "manual", detalhe: texto(g.detalhe) || "execução manual" },
      passos,
      como_testar: texto(p.como_testar),
      horas_economizadas_semana: numero(p.horas_economizadas_semana),
    },
  };
}

export function validarRelatorio(entrada) {
  const r = { ...(jsonSeTexto(entrada) || {}) };
  r.tarefas = jsonSeTexto(r.tarefas);
  if (!Array.isArray(r.tarefas) || r.tarefas.length === 0) return { ok: false, erro: "faltou a lista 'tarefas'" };
  const tarefas = [];
  for (const [i, bruta] of r.tarefas.entries()) {
    const t = jsonSeTexto(bruta);
    if (!t || typeof t !== "object" || !t.nome) return { ok: false, erro: `a tarefa ${i + 1} está incompleta` };
    const ferramentas = jsonSeTexto(t.ferramentas_sugeridas);
    tarefas.push({
      ...t,
      nome: texto(t.nome),
      descricao: texto(t.descricao),
      frequencia: texto(t.frequencia),
      horas_por_semana: numero(t.horas_por_semana),
      percentual_automatizavel: numero(t.percentual_automatizavel),
      potencial: ["alto", "medio", "baixo"].includes(t.potencial) ? t.potencial : "medio",
      como_automatizar: texto(t.como_automatizar),
      o_que_continua_humano: texto(t.o_que_continua_humano),
      ferramentas_sugeridas: Array.isArray(ferramentas) ? ferramentas.map(texto) : texto(ferramentas).split(",").map((s) => s.trim()).filter(Boolean),
    });
  }
  return { ok: true, valor: { resumo_funcao: texto(r.resumo_funcao), tarefas, primeiro_passo: texto(r.primeiro_passo) } };
}
