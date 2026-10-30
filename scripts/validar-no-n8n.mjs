// Valida os fluxos gerados num n8n de verdade:
// 1) importa os workflows de todos os exemplos;
// 2) executa um fluxo de teste completo (IA -> filtro -> IA com JSON -> imagem -> juntar),
//    apontando os nós de IA para uma "Claude falsa" local que confere se o JSON recebido é válido.
//
// Uso (demora alguns minutos na primeira vez, porque baixa o n8n):
//   node scripts/validar-no-n8n.mjs
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { execSync, exec } from "node:child_process";
import { promisify } from "node:util";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { montarWorkflowN8n } from "../public/n8n.js";
import { DEMOS, planoDoExemplo } from "../public/demo.js";

const pasta = join(tmpdir(), "raio-x-validacao");
rmSync(pasta, { recursive: true, force: true });
mkdirSync(join(pasta, "fluxos"), { recursive: true });
const env = { ...process.env, N8N_USER_FOLDER: join(pasta, "n8n"), N8N_DIAGNOSTICS_ENABLED: "false", N8N_RUNNERS_ENABLED: "false" };
const n8n = (args) => execSync(`npx --yes n8n ${args}`, { env, stdio: ["ignore", "pipe", "pipe"] }).toString();
// Assíncrono: o processo precisa continuar livre para a "Claude falsa" responder.
const n8nAsync = async (args) => (await promisify(exec)(`npx --yes n8n ${args}`, { env, maxBuffer: 50 * 1024 * 1024 })).stdout;

// 1) Fluxos dos exemplos
let n = 0;
for (const d of DEMOS) for (const t of d.relatorio.tarefas) {
  const wf = montarWorkflowN8n(planoDoExemplo(d, t));
  wf.id = `raiox${String(++n).padStart(11, "0")}`;
  writeFileSync(join(pasta, "fluxos", `${wf.id}.json`), JSON.stringify(wf));
}
console.log(`Importando ${n} fluxos dos exemplos…`);
console.log(n8n(`import:workflow --separate --input=${join(pasta, "fluxos")}`).trim().split("\n").pop());

// 2) Fluxo de teste executável
const PORTA = 9911;
const recebidos = [];
const servidor = http.createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const pedido = JSON.parse(corpo); // quebra o teste se o n8n mandar JSON inválido
    recebidos.push(pedido);
    const texto = JSON.stringify(pedido.messages[0].content);
    const resposta = texto.includes("Devolva JSON") ? '```json\n{"ok":true}\n```' : texto.includes("repasse") ? "SIM" : "NAO";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ content: [{ type: "text", text: resposta }] }));
  });
}).listen(PORTA);

const teste = montarWorkflowN8n({
  nome_fluxo: "Teste ponta a ponta", objetivo: "Validar execução", como_testar: "-",
  gatilho: { tipo: "manual", detalhe: "manual" },
  passos: [
    { tipo: "codigo", nome: "Dados de teste", o_que_faz: "-", configuracao: "-", codigo: 'return [{ json: { texto: "Quando cai o \\"repasse\\"?\\nLinha 2", id: 1 }, binary: { data: await this.helpers.prepareBinaryData(Buffer.from("FOTO"), "a.png", "image/png") } }, { json: { texto: "Cardápio fora do ar", id: 2 } }];' },
    { tipo: "ia_claude", nome: "Classificar", o_que_faz: "-", configuracao: "-", prompt: 'Classifique. Exemplo {"a":{"b":1}}. Texto: {{ $json.texto }}' },
    { tipo: "codigo", nome: "Só repasse", o_que_faz: "-", configuracao: "-", codigo: "return $input.all().filter((i) => /^SIM/i.test(i.json.resposta_ia));" },
    { tipo: "ia_claude", nome: "Ver imagem", o_que_faz: "-", configuracao: "-", imagem: true, responde_json: true, prompt: "Devolva JSON do chamado {{ $json.id }}: {{ $('Dados de teste').item.json.texto }}" },
    { tipo: "juntar_itens", nome: "Juntar", o_que_faz: "-", configuracao: "-" },
  ],
});
for (const no of teste.nodes) if (no.parameters?.url) no.parameters.url = `http://127.0.0.1:${PORTA}/v1/messages`;
teste.id = "raioxteste000001";
writeFileSync(join(pasta, "teste.json"), JSON.stringify(teste));
n8n(`import:workflow --input=${join(pasta, "teste.json")}`);

console.log("Executando o fluxo de teste…");
const saida = await n8nAsync(`execute --id=${teste.id} --rawOutput`);
servidor.close();
const resultado = JSON.parse(saida.slice(saida.indexOf("{")));
const dados = (resultado.data || resultado).resultData;
if (dados.error) throw new Error("Execução falhou: " + JSON.stringify(dados.error));
const final = dados.runData.Juntar[0].data.main[0][0].json;
if (recebidos.length !== 3 || !final.itens?.[0]?.dados_ia?.ok) throw new Error("Resultado inesperado: " + JSON.stringify(final));
console.log(`OK: ${n} fluxos importados; fluxo de teste executado, ${recebidos.length} chamadas de IA com JSON válido, imagem incluída: ${JSON.stringify(recebidos[2].messages[0].content[0].type)}`);
console.log("Versão do n8n:", n8n("--version").trim());
