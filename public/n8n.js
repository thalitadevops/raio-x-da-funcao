// Converte o plano do fluxo (gerado pela IA) em um workflow JSON importável no n8n.
// A IA só escolhe tipos de uma lista fechada; o JSON é montado aqui, de forma
// determinística, para garantir que sempre importe sem erro.

export const TIPOS_DE_GATILHO = ["agendado", "webhook", "manual", "novo_email"];
export const TIPOS_DE_PASSO = [
  "ia_claude", "google_sheets", "gmail", "slack", "http", "codigo", "condicao", "definir_campos", "whatsapp",
];

const GATILHOS = {
  agendado: { type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, parameters: { rule: { interval: [{}] } } },
  webhook: { type: "n8n-nodes-base.webhook", typeVersion: 2, parameters: { httpMethod: "POST", path: "" } },
  manual: { type: "n8n-nodes-base.manualTrigger", typeVersion: 1, parameters: {} },
  novo_email: {
    type: "n8n-nodes-base.gmailTrigger",
    typeVersion: 1.2,
    parameters: { pollTimes: { item: [{ mode: "everyMinute" }] }, filters: {} },
  },
};

function noIaClaude(passo) {
  const corpo = {
    model: "claude-sonnet-5-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: passo.configuracao }],
  };
  return {
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
      jsonBody: JSON.stringify(corpo, null, 2),
      options: {},
    },
  };
}

const PASSOS = {
  ia_claude: noIaClaude,
  google_sheets: () => ({ type: "n8n-nodes-base.googleSheets", typeVersion: 4.5, parameters: {} }),
  gmail: () => ({ type: "n8n-nodes-base.gmail", typeVersion: 2.1, parameters: {} }),
  slack: () => ({ type: "n8n-nodes-base.slack", typeVersion: 2.2, parameters: {} }),
  http: () => ({ type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, parameters: { options: {} } }),
  whatsapp: () => ({ type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, parameters: { method: "POST", options: {} } }),
  codigo: (p) => ({
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    parameters: { jsCode: `// ${p.o_que_faz}\n// ${String(p.configuracao).replace(/\n/g, "\n// ")}\nreturn $input.all();` },
  }),
  condicao: () => ({ type: "n8n-nodes-base.if", typeVersion: 2, parameters: {} }),
  definir_campos: () => ({ type: "n8n-nodes-base.set", typeVersion: 3.4, parameters: {} }),
};

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function montarWorkflowN8n(plano) {
  const nomesUsados = new Set();
  const nomeUnico = (nome) => {
    let base = String(nome || "Passo").slice(0, 60).trim() || "Passo";
    let n = base, i = 2;
    while (nomesUsados.has(n)) n = `${base} ${i++}`;
    nomesUsados.add(n);
    return n;
  };

  const nodes = [];
  const passoX = 280;
  const y = 300;

  const g = GATILHOS[plano.gatilho?.tipo] || GATILHOS.manual;
  const gatilho = {
    id: uuid(),
    name: nomeUnico("Gatilho"),
    type: g.type,
    typeVersion: g.typeVersion,
    position: [0, y],
    parameters: structuredClone(g.parameters),
    notes: plano.gatilho?.detalhe || "",
    notesInFlow: true,
  };
  if (g.type === "n8n-nodes-base.webhook") {
    gatilho.webhookId = uuid();
    gatilho.parameters.path = gatilho.webhookId;
  }
  nodes.push(gatilho);

  (plano.passos || []).forEach((passo, i) => {
    const fabrica = PASSOS[passo.tipo] || PASSOS.definir_campos;
    const base = fabrica(passo);
    nodes.push({
      id: uuid(),
      name: nomeUnico(passo.nome),
      type: base.type,
      typeVersion: base.typeVersion,
      position: [passoX * (i + 1), y],
      parameters: base.parameters,
      notes: `${passo.o_que_faz}\n\nComo configurar: ${passo.configuracao}`,
      notesInFlow: true,
    });
  });

  // Liga cada nó ao próximo. No "condicao", a saída 0 (verdadeiro) segue o fluxo.
  const connections = {};
  for (let i = 0; i < nodes.length - 1; i++) {
    connections[nodes[i].name] = { main: [[{ node: nodes[i + 1].name, type: "main", index: 0 }]] };
  }

  const instrucoes = [
    `## ${plano.nome_fluxo}`,
    plano.objetivo,
    "",
    "**Antes de rodar:** abra cada nó, leia a nota e conecte suas credenciais (Google, Slack etc.).",
    "Nos nós de IA, troque COLE_SUA_CHAVE_AQUI pela sua chave da Claude API.",
    "",
    `**Como testar:** ${plano.como_testar}`,
    "",
    "_Gerado pelo Raio-X da Função_",
  ].join("\n");
  nodes.push({
    id: uuid(),
    name: "Instruções",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [0, 0],
    parameters: { content: instrucoes, width: Math.max(480, passoX * nodes.length - 40), height: 240 },
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
