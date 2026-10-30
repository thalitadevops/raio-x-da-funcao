// POST /api/entrevista
// Recebe o perfil e o histórico da conversa. Devolve a próxima pergunta
// do agente ou, quando ele já tem informação suficiente, o Raio-X estruturado.
import { chamarClaude, chamarComFerramenta, json, respostaDeErro, limitarTexto, ErroHttp } from "../../lib/anthropic.js";
import { validarRelatorio } from "../../lib/validacao.js";

const MAX_TURNOS = 24;
// Depois de tantas respostas, o laudo é emitido mesmo que o agente queira perguntar mais.
const RESPOSTAS_PARA_FECHAR = 7;

const FERRAMENTA_RAIO_X = {
  name: "entregar_raio_x",
  description:
    "Entrega o Raio-X final da função, com todas as tarefas mapeadas. Use apenas quando já souber as principais tarefas, a frequência e o tempo gasto em cada uma.",
  input_schema: {
    type: "object",
    properties: {
      resumo_funcao: {
        type: "string",
        description: "2 a 3 frases descrevendo a função e onde está o maior desperdício de tempo.",
      },
      tarefas: {
        type: "array",
        minItems: 3,
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            nome: { type: "string", description: "Nome curto da tarefa (até 6 palavras)." },
            descricao: { type: "string", description: "O que a pessoa faz hoje, em uma frase." },
            frequencia: { type: "string", description: "Ex.: 'diária', '3x por semana', 'mensal'." },
            horas_por_semana: { type: "number", description: "Tempo gasto hoje, em horas por semana." },
            potencial: { type: "string", enum: ["alto", "medio", "baixo"] },
            percentual_automatizavel: {
              type: "number",
              description: "De 0 a 100: quanto do tempo dessa tarefa uma automação realista elimina.",
            },
            como_automatizar: { type: "string", description: "Como a IA/automação resolveria, em 1 a 2 frases." },
            ferramentas_sugeridas: { type: "array", items: { type: "string" } },
            o_que_continua_humano: {
              type: "string",
              description: "A parte que deve continuar com a pessoa (julgamento, relacionamento etc.).",
            },
          },
          required: [
            "nome", "descricao", "frequencia", "horas_por_semana", "potencial",
            "percentual_automatizavel", "como_automatizar", "ferramentas_sugeridas", "o_que_continua_humano",
          ],
        },
      },
      primeiro_passo: {
        type: "string",
        description: "A automação a construir primeiro e por quê (maior ganho com menor esforço).",
      },
    },
    required: ["resumo_funcao", "tarefas", "primeiro_passo"],
  },
};

function promptDoSistema(perfil) {
  return `Você é o Raio-X da Função: um consultor de produtividade com IA que entrevista profissionais para descobrir quais partes do trabalho deles podem ser automatizadas com IA e ferramentas como n8n, Make, Zapier, planilhas e agentes.

Perfil informado pela pessoa:
- Cargo: ${limitarTexto(perfil.cargo, 120)}
- Área/empresa: ${limitarTexto(perfil.area, 160)}
- Ferramentas que usa no dia a dia: ${limitarTexto(perfil.ferramentas, 300) || "não informado"}

Como conduzir a entrevista:
- Fale em português do Brasil, com tom acolhedor e direto.
- Faça UMA pergunta por vez, curta (no máximo 2 frases). Nunca liste várias perguntas juntas.
- Comece pedindo para a pessoa descrever um dia típico de trabalho.
- Depois aprofunde nas tarefas repetitivas: com que frequência acontecem, quanto tempo levam, de onde vêm os dados, para onde vão, o que dá mais retrabalho.
- Quando a pessoa der uma resposta vaga sobre tempo, peça uma estimativa em minutos ou horas.
- Entre 5 e 7 perguntas costumam bastar; não passe de 7. Quando souber as principais tarefas com frequência e tempo, chame a ferramenta entregar_raio_x.
- Seja realista no percentual automatizável: tarefas que exigem julgamento, negociação ou empatia raramente passam de 30%.
- Nunca invente tarefas que a pessoa não mencionou.`;
}

function validarMensagens(mensagens) {
  if (!Array.isArray(mensagens)) throw new ErroHttp(400, "mensagens deve ser uma lista.");
  if (mensagens.length > MAX_TURNOS) throw new ErroHttp(400, "Entrevista longa demais.");
  return mensagens.map((m) => {
    if (m.role !== "user" && m.role !== "assistant") throw new ErroHttp(400, "role inválido.");
    return { role: m.role, content: limitarTexto(m.content, 3000) };
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { perfil = {}, mensagens = [], finalizar: pediuFinalizar = false } = await request.json();
    if (!perfil.cargo) throw new ErroHttp(400, "Informe o cargo.");

    const historico = validarMensagens(mensagens);
    const respostas = historico.filter((m) => m.role === "user").length;
    const finalizar = pediuFinalizar || respostas >= RESPOSTAS_PARA_FECHAR;
    // A API exige que a conversa comece com o usuário.
    const messages = [
      { role: "user", content: "Olá! Quero fazer o Raio-X da minha função." },
      ...historico,
    ];
    if (finalizar) {
      messages.push({
        role: "user",
        content: "Já respondi o suficiente. Não faça mais perguntas: chame agora a ferramenta entregar_raio_x com o que você sabe. Onde faltar número, use uma estimativa conservadora.",
      });
    }
    // Junta mensagens consecutivas do mesmo papel (a API não aceita repetição).
    const compactadas = [];
    for (const m of messages) {
      const ultima = compactadas[compactadas.length - 1];
      if (ultima && ultima.role === m.role) ultima.content += "\n\n" + m.content;
      else compactadas.push({ ...m });
    }

    const corpo = { system: promptDoSistema(perfil), messages: compactadas, tools: [FERRAMENTA_RAIO_X] };

    const emitirLaudo = async () => {
      const { entrada } = await chamarComFerramenta(env, { ...corpo, max_tokens: 8000 }, "entregar_raio_x", { validar: validarRelatorio });
      if (!entrada) throw new ErroHttp(502, "O agente não conseguiu emitir o laudo. Tente de novo.");
      return json({ tipo: "relatorio", relatorio: entrada });
    };

    if (finalizar) return emitirLaudo();

    const data = await chamarClaude(env, { ...corpo, tool_choice: { type: "auto" } });
    const usoDeFerramenta = data.content?.find((b) => b.type === "tool_use" && b.name === "entregar_raio_x");
    if (usoDeFerramenta) {
      const r = validarRelatorio(usoDeFerramenta.input);
      return r.ok ? json({ tipo: "relatorio", relatorio: r.valor }) : emitirLaudo();
    }
    const texto = data.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return json({ tipo: "pergunta", texto: texto || "Pode me contar um pouco mais?" });
  } catch (err) {
    return respostaDeErro(err);
  }
}
