// Converte o plano do fluxo (gerado pela IA) em um workflow JSON importável no n8n.
// A IA escolhe os passos de uma lista fechada de tipos e escreve prompts e código;
// o JSON do n8n é montado aqui, de forma determinística, para sempre importar sem erro.
//
// Convenções que a IA conhece (ver functions/api/fluxo.js):
// - Depois de cada passo "ia_claude" entra um nó "Ler resposta" que deixa no item
//   os campos anteriores + resposta_ia (texto) + dados_ia (JSON, se responde_json).
// - "extrair_arquivo" de PDF deixa o texto em $json.text; planilhas viram um item por linha.
// - "juntar_itens" transforma todos os itens em um só, com a lista em $json.itens.
// - Passos "ia_claude" com imagem: true recebem antes um nó que prepara a imagem.

export const TIPOS_DE_GATILHO = ["agendado", "webhook", "manual", "novo_email"];
export const TIPOS_DE_PASSO = [
  "ia_claude", "extrair_arquivo", "juntar_itens", "codigo", "condicao", "google_sheets", "gmail",
  "slack", "http", "whatsapp", "definir_campos",
];
export const MODELO_PADRAO = "claude-sonnet-5-5";

// ---------- Prompts como expressão do n8n ----------
// O corpo da requisição vira "={{ JSON.stringify({...}) }}": o n8n avalia as
// variáveis e o JSON.stringify garante JSON válido mesmo com aspas e quebras de linha.

function escaparTemplate(texto) {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(/\}\}/g, "}\\u007d"); // "}}" literal encerraria a expressão do n8n
}

// "Olá {{ $json.nome }}" -> `Olá ${ $json.nome }`
export function promptParaTemplate(prompt) {
  const partes = [];
  let resto = String(prompt ?? "");
  const re = /\{\{\s*([\s\S]+?)\s*\}\}/;
  let m;
  while ((m = re.exec(resto))) {
    partes.push(escaparTemplate(resto.slice(0, m.index)));
    partes.push("${" + m[1] + "}");
    resto = resto.slice(m.index + m[0].length);
  }
  partes.push(escaparTemplate(resto));
  return "`" + partes.join("") + "`";
}

function corpoDaIa(passo) {
  const texto = promptParaTemplate(passo.prompt || passo.configuracao || "");
  const conteudo = passo.imagem
    ? `[{ type: "image", source: { type: "base64", media_type: $json.imagem_tipo, data: $json.imagem_base64 } }, { type: "text", text: ${texto} }]`
    : texto;
  return `={{ JSON.stringify({ model: "${MODELO_PADRAO}", max_tokens: 4096, messages: [{ role: "user", content: ${conteudo} }] }) }}`;
}

// ---------- Fábricas de nós ----------

const GATILHOS = {
  agendado: (g) => ({
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.2,
    parameters: {
      rule: { interval: [validarCron(g.cron) ? { field: "cronExpression", expression: g.cron.trim() } : {}] },
    },
  }),
  webhook: () => ({ type: "n8n-nodes-base.webhook", typeVersion: 2, parameters: { httpMethod: "POST", path: "", options: {} } }),
  manual: () => ({ type: "n8n-nodes-base.manualTrigger", typeVersion: 1, parameters: {} }),
  novo_email: () => ({
    type: "n8n-nodes-base.gmailTrigger",
    typeVersion: 1.2,
    parameters: { pollTimes: { item: [{ mode: "everyMinute" }] }, simple: false, filters: {}, options: { downloadAttachments: true } },
  }),
};

function validarCron(cron) {
  return typeof cron === "string" && /^\s*\S+(\s+\S+){4}\s*$/.test(cron);
}

const FORMATOS = { pdf: "pdf", xlsx: "xlsx", xls: "xls", csv: "csv" };

const PASSOS = {
  ia_claude: (p) => ({
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    parameters: {
      method: "POST",
      url: "https://api.anthropic.com/v1/messages",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "x-api-key", value: "COLE_SUA_CHAVE_AQUI" },
          { name: "anthropic-version", value: "2023-06-01" },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody: corpoDaIa(p),
      options: {},
    },
  }),
  extrair_arquivo: (p) => ({
    type: "n8n-nodes-base.extractFromFile",
    typeVersion: 1,
    parameters: { operation: FORMATOS[p.formato_arquivo] || "pdf", options: {} },
  }),
  juntar_itens: () => ({
    type: "n8n-nodes-base.aggregate",
    typeVersion: 1,
    parameters: { aggregate: "aggregateAllItemData", destinationFieldName: "itens", options: {} },
  }),
  codigo: (p) => ({
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    parameters: {
      jsCode: p.codigo && /return/.test(p.codigo)
        ? `// ${p.o_que_faz}\n${p.codigo}`
        : `// ${p.o_que_faz}\n// ${String(p.configuracao).replace(/\n/g, "\n// ")}\nreturn $input.all();`,
    },
  }),
  condicao: () => ({ type: "n8n-nodes-base.if", typeVersion: 2, parameters: {} }),
  google_sheets: () => ({ type: "n8n-nodes-base.googleSheets", typeVersion: 4.5, parameters: {} }),
  gmail: () => ({ type: "n8n-nodes-base.gmail", typeVersion: 2.1, parameters: {} }),
  slack: () => ({ type: "n8n-nodes-base.slack", typeVersion: 2.2, parameters: {} }),
  http: () => ({ type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, parameters: { options: {} } }),
  whatsapp: () => ({ type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, parameters: { method: "POST", options: {} } }),
  definir_campos: () => ({ type: "n8n-nodes-base.set", typeVersion: 3.4, parameters: {} }),
};

// Nó que vem logo depois de cada IA: junta os campos de antes com a resposta.
function codigoLerResposta(noAnterior, respondeJson) {
  return `// Junta os dados que vieram antes da IA com a resposta dela.
// resposta_ia = texto da resposta; dados_ia = JSON interpretado (quando a IA devolve JSON).
const anteriores = $(${JSON.stringify(noAnterior)}).all();
return $input.all().map((item, i) => {
  const texto = (item.json.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\\n")
    .trim();
  let dados_ia = null;
  ${respondeJson ? `try {
    dados_ia = JSON.parse(texto.replace(/^\`\`\`(?:json)?\\s*|\\s*\`\`\`$/g, ""));
  } catch (e) {
    dados_ia = { erro: "A IA não devolveu um JSON válido", texto };
  }` : "// Este passo devolve texto livre; dados_ia fica vazio."}
  const antes = anteriores[i] || anteriores[0] || { json: {} };
  return { json: { ...antes.json, resposta_ia: texto, dados_ia }, binary: antes.binary };
});`;
}

const CODIGO_PREPARAR_IMAGEM = `// Converte o primeiro arquivo de cada item em base64 para a IA conseguir ver a imagem.
const itens = $input.all();
const saida = [];
for (let i = 0; i < itens.length; i++) {
  const item = itens[i];
  const chave = Object.keys(item.binary || {})[0];
  if (!chave) continue;
  const buffer = await this.helpers.getBinaryDataBuffer(i, chave);
  saida.push({
    json: { ...item.json, imagem_base64: buffer.toString("base64"), imagem_tipo: item.binary[chave].mimeType || "image/jpeg" },
    binary: item.binary,
  });
}
return saida;`;

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------- Montagem ----------

export function montarWorkflowN8n(plano) {
  const nomesUsados = new Set();
  const nomeUnico = (nome) => {
    const base = String(nome || "Passo").slice(0, 60).trim() || "Passo";
    let n = base, i = 2;
    while (nomesUsados.has(n)) n = `${base} ${i++}`;
    nomesUsados.add(n);
    return n;
  };

  const nodes = [];
  const passoX = 260;
  const y = 340;
  const adicionar = ({ nome, base, nota }) => {
    const no = {
      id: uuid(),
      name: nomeUnico(nome),
      type: base.type,
      typeVersion: base.typeVersion,
      position: [passoX * nodes.length, y],
      parameters: base.parameters,
    };
    if (nota) Object.assign(no, { notes: nota, notesInFlow: true });
    nodes.push(no);
    return no;
  };

  const g = plano.gatilho || {};
  const baseGatilho = (GATILHOS[g.tipo] || GATILHOS.manual)(g);
  const gatilho = adicionar({
    nome: "Gatilho",
    base: baseGatilho,
    nota: [g.detalhe, g.tipo === "agendado" && validarCron(g.cron) ? `Agendamento (cron): ${g.cron}` : ""].filter(Boolean).join("\n"),
  });
  if (baseGatilho.type === "n8n-nodes-base.webhook") {
    gatilho.webhookId = uuid();
    gatilho.parameters.path = gatilho.webhookId;
  }

  for (const passo of plano.passos || []) {
    const fabrica = PASSOS[passo.tipo] || PASSOS.definir_campos;
    if (passo.tipo === "ia_claude" && passo.imagem) {
      adicionar({ nome: `Preparar imagem: ${passo.nome}`, base: PASSOS.codigo({ codigo: CODIGO_PREPARAR_IMAGEM, o_que_faz: "Prepara a imagem para a IA" }) });
    }
    const anterior = nodes[nodes.length - 1].name;
    const nota = [passo.o_que_faz, passo.configuracao ? `Como configurar: ${passo.configuracao}` : ""].filter(Boolean).join("\n\n");
    adicionar({ nome: passo.nome, base: fabrica(passo), nota });
    if (passo.tipo === "ia_claude") {
      adicionar({
        nome: `Ler resposta: ${passo.nome}`,
        base: { type: "n8n-nodes-base.code", typeVersion: 2, parameters: { jsCode: codigoLerResposta(anterior, passo.responde_json) } },
      });
    }
  }

  // Liga cada nó ao próximo. No "condicao", a saída 0 (verdadeiro) segue o fluxo.
  const connections = {};
  for (let i = 0; i < nodes.length - 1; i++) {
    connections[nodes[i].name] = { main: [[{ node: nodes[i + 1].name, type: "main", index: 0 }]] };
  }

  const instrucoes = [
    `## ${plano.nome_fluxo}`,
    plano.objetivo,
    "",
    "**Antes de rodar:** conecte suas credenciais nos nós de Google, Gmail, Slack etc. (a nota de cada nó diz o que preencher).",
    "Nos nós de IA, troque COLE_SUA_CHAVE_AQUI pela sua chave da Claude API.",
    "",
    `**Como testar:** ${plano.como_testar}`,
    "",
    "_Gerado pelo Raio-X da Função_",
  ].join("\n");
  nodes.push({
    id: uuid(),
    name: nomeUnico("Instruções"),
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [0, 0],
    parameters: { content: instrucoes, width: Math.max(520, passoX * (nodes.length - 1) + 200), height: 280 },
  });

  return {
    name: String(plano.nome_fluxo || "Fluxo do Raio-X").slice(0, 80),
    nodes,
    connections,
    active: false,
    settings: { executionOrder: "v1" },
    pinData: {},
  };
}
