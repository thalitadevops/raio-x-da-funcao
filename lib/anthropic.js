// Cliente mínimo da Claude API para as Pages Functions.
const API_URL = "https://api.anthropic.com/v1/messages";

export async function chamarClaude(env, body) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ErroHttp(500, "ANTHROPIC_API_KEY não configurada no servidor.");
  }
  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.MODEL || "claude-sonnet-5-5",
      max_tokens: 4096,
      ...body,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error?.message || `Erro ${resp.status} na Claude API`;
    throw new ErroHttp(502, msg);
  }
  return data;
}

// Pede ao modelo que use uma ferramenta específica sem forçar via tool_choice
// (alguns modelos não aceitam tool_choice do tipo "tool"). Se ele responder só com
// texto, ou com uma entrada incompleta (por exemplo, cortada por ser longa demais),
// devolve o problema para ele e pede de novo.
// `validar(entrada)` devolve { ok: true, valor } ou { ok: false, erro }.
export async function chamarComFerramenta(env, body, nomeFerramenta, { tentativas = 3, validar } = {}) {
  let messages = [...body.messages];
  for (let i = 0; i < tentativas; i++) {
    const resp = await chamarClaude(env, { ...body, messages, tool_choice: { type: "auto" } });
    const uso = resp.content?.find((b) => b.type === "tool_use" && b.name === nomeFerramenta);
    if (uso) {
      const r = validar ? validar(uso.input) : { ok: true, valor: uso.input };
      if (r.ok) return { uso, entrada: r.valor };
      const cortado = resp.stop_reason === "max_tokens";
      messages = [
        ...messages,
        { role: "assistant", content: resp.content },
        {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: uso.id,
            is_error: true,
            content: `A entrada veio incompleta: ${r.erro}. Chame ${nomeFerramenta} de novo com todos os campos obrigatórios preenchidos${cortado ? ", sendo mais conciso (prompts e código mais curtos), porque a resposta anterior foi cortada por tamanho" : ""}.`,
          }],
        },
      ];
      continue;
    }
    const texto = resp.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    messages = [
      ...messages,
      { role: "assistant", content: texto || "Certo." },
      { role: "user", content: `Agora chame a ferramenta ${nomeFerramenta} com o resultado. Não escreva texto, só chame a ferramenta.` },
    ];
  }
  return { uso: null, entrada: null };
}

// Alguns modelos devolvem listas/objetos aninhados como texto JSON. Converte de volta.
export function jsonSeTexto(valor) {
  if (typeof valor !== "string") return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
}

export class ErroHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function respostaDeErro(err) {
  const status = err instanceof ErroHttp ? err.status : 500;
  return json({ erro: err.message || "Erro inesperado" }, status);
}

// Limita tamanho de entradas para evitar abuso de custo.
export function limitarTexto(s, max = 2000) {
  return String(s ?? "").slice(0, max);
}
