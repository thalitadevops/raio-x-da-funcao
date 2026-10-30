// Testa o workflow gerado como o n8n vai executá-lo: avalia as expressões dos
// nós de IA e compila/roda o JavaScript dos nós de código.
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarWorkflowN8n, promptParaTemplate } from "../public/n8n.js";
import { DEMOS, planoDoExemplo } from "../public/demo.js";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// Avalia "={{ ... }}" como o n8n faria, com um $json e um $() simulados.
function avaliarExpressao(expr, $json, nos = {}) {
  assert.ok(expr.startsWith("={{") && expr.endsWith("}}"), "corpo precisa ser expressão do n8n");
  const dentro = expr.slice(3, -2);
  const $ = (nome) => ({ item: { json: nos[nome] || {} } });
  return new Function("$json", "$", `return (${dentro});`)($json, $);
}

function todosOsFluxos() {
  const lista = [];
  for (const d of DEMOS) for (const t of d.relatorio.tarefas) lista.push(montarWorkflowN8n(planoDoExemplo(d, t)));
  return lista;
}

test("prompt vira template seguro: aspas, crases, ${ e }} literais", () => {
  const prompt = 'Diga "oi" `crase` ${nao} JSON: {"a":{"b":1}} e o nome {{ $json.nome }}\nfim';
  const t = promptParaTemplate(prompt);
  const resultado = new Function("$json", `return ${t};`)({ nome: "Ana" });
  assert.equal(resultado, 'Diga "oi" `crase` ${nao} JSON: {"a":{"b":1}} e o nome Ana\nfim');
});

test("corpo dos nós de IA vira JSON válido com as variáveis preenchidas", () => {
  for (const wf of todosOsFluxos()) {
    for (const n of wf.nodes.filter((n) => n.parameters?.url === "https://api.anthropic.com/v1/messages")) {
      const $json = { texto: 'linha 1\nlinha "2"', assunto: "Repasse", nome: "X-Burger", descricao_original: "pão", itens: [1, 2], telefone: "21999", imagem_tipo: "image/png", imagem_base64: "AAAA" };
      const nos = { "Ler dados do chamado": { texto: "dúvida", id: 7 }, "Ler mensagem": { texto: "quando cai?", telefone: "21" } };
      const corpo = JSON.parse(avaliarExpressao(n.parameters.jsonBody, $json, nos));
      assert.equal(corpo.messages[0].role, "user");
      const texto = JSON.stringify(corpo.messages[0].content);
      assert.ok(!texto.includes("{{"), `variável não substituída em ${n.name}`);
      assert.ok(corpo.model && corpo.max_tokens);
    }
  }
});

test("todo nó de código compila, e todo nó de IA é seguido por 'Ler resposta'", () => {
  for (const wf of todosOsFluxos()) {
    wf.nodes.forEach((n, i) => {
      if (n.type === "n8n-nodes-base.code") assert.doesNotThrow(() => new AsyncFunction("$input", "$", n.parameters.jsCode), n.name);
      if (n.parameters?.url === "https://api.anthropic.com/v1/messages") {
        assert.ok(wf.nodes[i + 1].name.startsWith("Ler resposta"), `${n.name} sem leitor de resposta`);
      }
    });
  }
});

test("'Ler resposta' junta os dados anteriores com a resposta e interpreta JSON", async () => {
  const wf = montarWorkflowN8n(planoDoExemplo(DEMOS[2], DEMOS[2].relatorio.tarefas[0]));
  const leitor = wf.nodes.find((n) => n.name === "Ler resposta: Ler o cardápio");
  const $input = { all: () => [{ json: { content: [{ type: "text", text: '```json\n{"itens":[{"nome":"Pizza","preco":40}]}\n```' }] } }] };
  const $ = () => ({ all: () => [{ json: { from: { text: "dono@x.com" } }, binary: {} }] });
  const saida = await new AsyncFunction("$input", "$", leitor.parameters.jsCode)($input, $);
  assert.equal(saida[0].json.from.text, "dono@x.com");
  assert.equal(saida[0].json.dados_ia.itens[0].nome, "Pizza");
});

test("gatilho agendado usa cron; foto do cardápio ganha nó que prepara a imagem", () => {
  const fluxos = todosOsFluxos();
  const agendado = fluxos.flatMap((w) => w.nodes).find((n) => n.type === "n8n-nodes-base.scheduleTrigger");
  assert.equal(agendado.parameters.rule.interval[0].field, "cronExpression");
  const cardapio = montarWorkflowN8n(planoDoExemplo(DEMOS[2], DEMOS[2].relatorio.tarefas[0]));
  const i = cardapio.nodes.findIndex((n) => n.name === "Ler o cardápio");
  assert.ok(cardapio.nodes[i - 1].name.startsWith("Preparar imagem"));
});

test("filtros dos exemplos funcionam com a resposta da IA", async () => {
  const wf = montarWorkflowN8n(planoDoExemplo(DEMOS[0], DEMOS[0].relatorio.tarefas[0]));
  const filtro = wf.nodes.find((n) => n.name === "Seguir só se for repasse");
  const $input = { all: () => [{ json: { resposta_ia: "SIM" } }, { json: { resposta_ia: "NAO" } }] };
  const saida = await new AsyncFunction("$input", "$", filtro.parameters.jsCode)($input, () => ({}));
  assert.equal(saida.length, 1);
});
