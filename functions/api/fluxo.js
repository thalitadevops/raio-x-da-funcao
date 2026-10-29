// POST /api/fluxo
// Recebe uma tarefa do Raio-X e devolve o plano do fluxo de automação.
// O navegador transforma esse plano em um workflow importável no n8n (public/n8n.js).
import { chamarClaude, json, respostaDeErro, limitarTexto, ErroHttp } from "../../lib/anthropic.js";
import { TIPOS_DE_GATILHO, TIPOS_DE_PASSO } from "../../public/n8n.js";

const FERRAMENTA_FLUXO = {
  name: "montar_fluxo",
  description: "Descreve o fluxo de automação que resolve a tarefa, passo a passo.",
  input_schema: {
    type: "object",
    properties: {
      nome_fluxo: { type: "string", description: "Nome curto do fluxo." },
      objetivo: { type: "string", description: "O que o fluxo resolve, em uma frase." },
      gatilho: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: TIPOS_DE_GATILHO },
          detalhe: { type: "string", description: "Quando dispara. Ex.: 'todo dia às 8h'." },
        },
        required: ["tipo", "detalhe"],
      },
      passos: {
        type: "array",
        minItems: 2,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: TIPOS_DE_PASSO },
            nome: { type: "string", description: "Nome do nó, até 5 palavras." },
            o_que_faz: { type: "string", description: "O que este passo faz, em uma frase." },
            configuracao: {
              type: "string",
              description: "Como configurar no n8n: campos, planilha, filtro. Para ia_claude, inclua o prompt completo a ser usado.",
            },
          },
          required: ["tipo", "nome", "o_que_faz", "configuracao"],
        },
      },
      como_testar: { type: "string", description: "Como testar o fluxo em 2 a 3 passos." },
      horas_economizadas_semana: { type: "number" },
    },
    required: ["nome_fluxo", "objetivo", "gatilho", "passos", "como_testar", "horas_economizadas_semana"],
  },
};

export async function onRequestPost({ request, env }) {
  try {
    const { perfil = {}, tarefa } = await request.json();
    if (!tarefa?.nome) throw new ErroHttp(400, "Informe a tarefa.");

    const pedido = `Monte um fluxo de automação no n8n para esta tarefa.

Profissional: ${limitarTexto(perfil.cargo, 120)} (${limitarTexto(perfil.area, 160)})
Ferramentas que já usa: ${limitarTexto(perfil.ferramentas, 300) || "não informado"}

Tarefa: ${limitarTexto(tarefa.nome, 120)}
Como é feita hoje: ${limitarTexto(tarefa.descricao, 500)}
Frequência: ${limitarTexto(tarefa.frequencia, 60)} · Tempo hoje: ${Number(tarefa.horas_por_semana) || 0} h/semana
Ideia de automação: ${limitarTexto(tarefa.como_automatizar, 500)}
O que continua humano: ${limitarTexto(tarefa.o_que_continua_humano, 300)}

Regras:
- Use as ferramentas que a pessoa já usa sempre que possível.
- Mantenha a parte humana no fluxo (por exemplo, um passo que manda o rascunho para aprovação em vez de enviar sozinho).
- Use "ia_claude" para qualquer passo que precise ler, resumir, classificar ou escrever texto.
- Seja específico na configuração de cada passo; escreva em português do Brasil.`;

    const data = await chamarClaude(env, {
      messages: [{ role: "user", content: pedido }],
      tools: [FERRAMENTA_FLUXO],
      tool_choice: { type: "tool", name: "montar_fluxo" },
    });
    const uso = data.content?.find((b) => b.type === "tool_use");
    if (!uso) throw new ErroHttp(502, "O modelo não devolveu um fluxo.");
    return json({ plano: uso.input });
  } catch (err) {
    return respostaDeErro(err);
  }
}
