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
