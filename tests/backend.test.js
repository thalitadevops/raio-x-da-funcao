import { test } from "node:test";
import assert from "node:assert/strict";
import { montarWorkflowN8n } from "../public/n8n.js";
import { planoDemo, RELATORIO_DEMO } from "../public/demo.js";
import { onRequestPost as entrevista } from "../functions/api/entrevista.js";
import { onRequestPost as fluxo } from "../functions/api/fluxo.js";

const env = { ANTHROPIC_API_KEY: "teste" };
const req = (corpo) => new Request("http://x/api", { method: "POST", body: JSON.stringify(corpo) });

// Simula a Claude API. Aceita uma resposta fixa ou uma lista (uma por chamada).
function simularClaude(...respostas) {
  const chamadas = [];
  globalThis.fetch = async (url, opts) => {
    const corpo = JSON.parse(opts.body);
    chamadas.push({ url, corpo, headers: opts.headers });
    if (corpo.tool_choice && corpo.tool_choice.type !== "auto") {
      return new Response(JSON.stringify({ error: { message: 'tool_choice: type "tool" and "any" are not supported for this model.' } }), { status: 400 });
    }
    const content = respostas[Math.min(chamadas.length - 1, respostas.length - 1)];
    return new Response(JSON.stringify({ content }), { status: 200 });
  };
  return chamadas;
}

test("workflow do n8n: nós únicos, ligados em sequência, com nota", () => {
  for (const t of RELATORIO_DEMO.tarefas) {
    const wf = montarWorkflowN8n(planoDemo(t));
    const nomes = wf.nodes.map((n) => n.name);
    assert.equal(new Set(nomes).size, nomes.length, "nomes repetidos");
    for (const n of wf.nodes) {
      assert.ok(n.id && n.type && n.typeVersion && Array.isArray(n.position));
    }
    const fluxo = wf.nodes.filter((n) => n.type !== "n8n-nodes-base.stickyNote");
    assert.equal(Object.keys(wf.connections).length, fluxo.length - 1);
    for (const [origem, c] of Object.entries(wf.connections)) {
      assert.ok(nomes.includes(origem));
      assert.ok(nomes.includes(c.main[0][0].node));
    }
    assert.ok(wf.nodes.some((n) => n.type === "n8n-nodes-base.stickyNote"));
  }
});

test("workflow: tipos desconhecidos e nomes repetidos não quebram", () => {
  const wf = montarWorkflowN8n({
    nome_fluxo: "x", objetivo: "y", como_testar: "z",
    gatilho: { tipo: "inexistente", detalhe: "agora" },
    passos: [
      { tipo: "foo", nome: "A", o_que_faz: "1", configuracao: "1" },
      { tipo: "ia_claude", nome: "A", o_que_faz: "2", configuracao: "x", prompt: "Resuma {{ $json.texto }}" },
    ],
  });
  assert.equal(wf.nodes[0].type, "n8n-nodes-base.manualTrigger");
  assert.deepEqual(wf.nodes.slice(1, 3).map((n) => n.name), ["A", "A 2"]);
  const ia = wf.nodes[2];
  const corpo = new Function("$json", `return (${ia.parameters.jsonBody.slice(3, -2)});`)({ texto: "abc" });
  assert.equal(JSON.parse(corpo).messages[0].content, "Resuma abc");
});

test("entrevista devolve pergunta quando o modelo responde em texto", async () => {
  const chamadas = simularClaude([{ type: "text", text: "Como é seu dia?" }]);
  const r = await entrevista({ request: req({ perfil: { cargo: "Analista" }, mensagens: [] }), env });
  assert.deepEqual(await r.json(), { tipo: "pergunta", texto: "Como é seu dia?" });
  assert.equal(chamadas[0].corpo.messages[0].role, "user");
  assert.equal(chamadas[0].corpo.tool_choice.type, "auto");
});

test("entrevista devolve relatório quando o modelo chama a ferramenta", async () => {
  simularClaude([{ type: "tool_use", name: "entregar_raio_x", input: RELATORIO_DEMO }]);
  const r = await entrevista({ request: req({ perfil: { cargo: "Analista" }, mensagens: [] }), env });
  const data = await r.json();
  assert.equal(data.tipo, "relatorio");
  assert.equal(data.relatorio.tarefas.length, 5);
});

test("finalizar: nunca força tool_choice e insiste se o modelo responder em texto", async () => {
  const chamadas = simularClaude(
    [{ type: "text", text: "Só mais uma pergunta?" }],
    [{ type: "tool_use", name: "entregar_raio_x", input: RELATORIO_DEMO }]
  );
  await entrevista({
    request: req({
      perfil: { cargo: "Analista" },
      mensagens: [{ role: "assistant", content: "Pergunta?" }, { role: "user", content: "Resposta" }],
      finalizar: true,
    }),
    env,
  }).then(async (r) => assert.equal((await r.json()).tipo, "relatorio"));
  assert.equal(chamadas.length, 2);
  for (const c of chamadas) {
    assert.deepEqual(c.corpo.tool_choice, { type: "auto" });
    const m = c.corpo.messages;
    for (let i = 1; i < m.length; i++) assert.notEqual(m[i].role, m[i - 1].role);
  }
});

test("depois de 7 respostas o laudo sai sozinho", async () => {
  simularClaude([{ type: "tool_use", name: "entregar_raio_x", input: RELATORIO_DEMO }]);
  const mensagens = [];
  for (let i = 0; i < 7; i++) mensagens.push({ role: "assistant", content: "P?" }, { role: "user", content: "R" });
  const r = await entrevista({ request: req({ perfil: { cargo: "Analista" }, mensagens }), env });
  assert.equal((await r.json()).tipo, "relatorio");
});

test("erros: sem cargo, sem chave", async () => {
  let r = await entrevista({ request: req({ perfil: {} }), env });
  assert.equal(r.status, 400);
  r = await entrevista({ request: req({ perfil: { cargo: "x" } }), env: {} });
  assert.equal(r.status, 500);
});

test("fluxo devolve o plano da ferramenta", async () => {
  const plano = planoDemo(RELATORIO_DEMO.tarefas[1]);
  const chamadas = simularClaude([{ type: "tool_use", name: "montar_fluxo", input: plano }]);
  const r = await fluxo({ request: req({ perfil: { cargo: "Analista" }, tarefa: RELATORIO_DEMO.tarefas[1] }), env });
  assert.deepEqual((await r.json()).plano, plano);
  assert.deepEqual(chamadas[0].corpo.tool_choice, { type: "auto" });
});

test("todos os exemplos têm contas coerentes e fluxos que montam", async () => {
  const { DEMOS, planoDoExemplo } = await import("../public/demo.js");
  assert.equal(DEMOS.length, 3);
  for (const d of DEMOS) {
    assert.equal(d.roteiro.length, 5);
    assert.ok(d.relatorio.tarefas.length >= 3);
    for (const t of d.relatorio.tarefas) {
      const wf = montarWorkflowN8n(planoDoExemplo(d, t));
      const nomes = new Set(wf.nodes.map((n) => n.name));
      assert.equal(nomes.size, wf.nodes.length);
      // Toda referência $('Nome') em prompts precisa apontar para um nó que existe.
      for (const n of wf.nodes) {
        const texto = JSON.stringify(n.parameters) + (n.notes || "");
        for (const [, ref] of texto.matchAll(/\$\('([^']+)'\)/g)) assert.ok(nomes.has(ref), `nó ${ref} não existe`);
      }
    }
  }
});
