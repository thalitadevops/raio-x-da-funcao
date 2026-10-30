// POST /api/fluxo
// Recebe uma tarefa do Raio-X e devolve o plano do fluxo de automação.
// O navegador transforma esse plano em um workflow importável no n8n (public/n8n.js).
import { chamarComFerramenta, json, respostaDeErro, limitarTexto, ErroHttp } from "../../lib/anthropic.js";
import { TIPOS_DE_GATILHO, TIPOS_DE_PASSO } from "../../public/n8n.js";

const FERRAMENTA_FLUXO = {
  name: "montar_fluxo",
  description: "Descreve o fluxo de automação no n8n que resolve a tarefa, passo a passo, em linha reta.",
  input_schema: {
    type: "object",
    properties: {
      nome_fluxo: { type: "string", description: "Nome curto do fluxo." },
      objetivo: { type: "string", description: "O que o fluxo resolve, em uma frase." },
      gatilho: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: TIPOS_DE_GATILHO },
          detalhe: { type: "string", description: "Quando dispara, em português. Ex.: 'dias úteis às 7h30'." },
          cron: { type: "string", description: "Só para tipo agendado: expressão cron de 5 campos. Ex.: '30 7 * * 1-5'." },
        },
        required: ["tipo", "detalhe"],
      },
      passos: {
        type: "array",
        minItems: 2,
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: TIPOS_DE_PASSO },
            nome: { type: "string", description: "Nome do nó, até 5 palavras, único no fluxo." },
            o_que_faz: { type: "string", description: "O que este passo faz, em uma frase." },
            configuracao: {
              type: "string",
              description: "Só o que a pessoa precisa preencher à mão no n8n: conta, planilha, aba, colunas, filtro de busca, canal. Não repita aqui o prompt nem o código.",
            },
            prompt: {
              type: "string",
              description: "Só para ia_claude: o texto exato enviado à IA. Use {{ $json.campo }} para inserir dados dos passos anteriores.",
            },
            responde_json: { type: "boolean", description: "Só para ia_claude: true se o prompt pede resposta em JSON." },
            imagem: { type: "boolean", description: "Só para ia_claude: true se a IA precisa ver a imagem anexada ao item." },
            codigo: {
              type: "string",
              description: "Só para codigo: JavaScript completo de um nó Code do n8n (modo 'Run Once for All Items'), terminando com return de uma lista de itens { json: {...} }.",
            },
            formato_arquivo: { type: "string", enum: ["pdf", "xlsx", "xls", "csv"], description: "Só para extrair_arquivo." },
          },
          required: ["tipo", "nome", "o_que_faz", "configuracao"],
        },
      },
      como_testar: { type: "string", description: "Como testar o fluxo em 2 a 3 passos, com dados de teste." },
      horas_economizadas_semana: { type: "number" },
    },
    required: ["nome_fluxo", "objetivo", "gatilho", "passos", "como_testar", "horas_economizadas_semana"],
  },
};

const REGRAS = `Regras do fluxo (siga todas, porque o JSON do n8n é montado automaticamente a partir delas):
1. O fluxo é uma linha reta: cada passo recebe a saída do anterior. Não crie ramificações nem mencione, em nenhum campo, nós que não estejam na lista de passos.
2. Para filtrar itens, prefira um passo "codigo" que devolve só os itens que passam (ex.: return $input.all().filter(i => i.json.valor > 0);). Use "condicao" só se não houver alternativa.
3. Passos "ia_claude": escreva o prompt completo no campo prompt, em português, pedindo para não inventar dados. Se quiser JSON, diga o formato exato no prompt e marque responde_json = true.
4. Depois de cada passo ia_claude, o sistema adiciona sozinho um nó que deixa no item: todos os campos de antes + resposta_ia (texto) + dados_ia (JSON interpretado). Os passos seguintes devem usar $json.resposta_ia ou $json.dados_ia.
5. "extrair_arquivo" lê o arquivo anexado ao item: PDF vira texto em $json.text; planilhas viram um item por linha, com as colunas como campos.
6. Para mandar um resumo único (e-mail, Slack), coloque antes um passo "juntar_itens": ele junta todos os itens em um só, com a lista em $json.itens.
7. Passos "codigo" precisam de JavaScript funcional e completo no campo codigo, usando $input.all() e devolvendo uma lista de itens { json: {...} }. Nada de pseudocódigo.
8. Gatilho agendado sempre com cron. Gatilho novo_email já baixa os anexos do e-mail.
9. Mantenha a parte humana no fluxo: rascunho para aprovação, linha marcada para revisão etc., em vez de enviar algo sozinho quando houver risco.`;

export async function onRequestPost({ request, env }) {
  try {
    const { perfil = {}, tarefa } = await request.json();
    if (!tarefa?.nome) throw new ErroHttp(400, "Informe a tarefa.");

    const pedido = `Monte um fluxo de automação no n8n para esta tarefa.

Profissional: ${limitarTexto(perfil.cargo, 120)} (${limitarTexto(perfil.area, 160)})
Ferramentas que já usa: ${limitarTexto(perfil.ferramentas, 300) || "não informado (use Gmail e Google Sheets como padrão)"}

Tarefa: ${limitarTexto(tarefa.nome, 120)}
Como é feita hoje: ${limitarTexto(tarefa.descricao, 500)}
Frequência: ${limitarTexto(tarefa.frequencia, 60)} · Tempo hoje: ${Number(tarefa.horas_por_semana) || 0} h/semana
Ideia de automação: ${limitarTexto(tarefa.como_automatizar, 500)}
O que continua humano: ${limitarTexto(tarefa.o_que_continua_humano, 300)}

${REGRAS}

Escreva tudo em português do Brasil e responda chamando a ferramenta montar_fluxo.`;

    const { uso } = await chamarComFerramenta(
      env,
      { messages: [{ role: "user", content: pedido }], tools: [FERRAMENTA_FLUXO], max_tokens: 8000 },
      "montar_fluxo"
    );
    if (!uso) throw new ErroHttp(502, "O modelo não devolveu um fluxo. Tente de novo.");
    return json({ plano: uso.input });
  } catch (err) {
    return respostaDeErro(err);
  }
}
