import type { Request } from "express";

// Maior valor que cabe numa coluna INT do Postgres. Passar disso faz o banco
// estourar um erro "out of range", que viraria 500 em vez de 400.
const INT_MAX = 2_147_483_647;

/**
 * Devolve o corpo da requisição só se ele for um objeto JSON. O
 * express.json() deixa req.body como undefined quando o Content-Type não é
 * JSON (ou não há corpo), e ler uma propriedade de undefined derrubava a
 * rota com 500. Devolver null deixa a rota responder 400.
 */
export function corpoJson(req: Request): Record<string, unknown> | null {
  const corpo: unknown = req.body;
  return corpo !== null && typeof corpo === "object" && !Array.isArray(corpo)
    ? (corpo as Record<string, unknown>)
    : null;
}

/** Id válido (inteiro de 1 até o limite do INT) ou null. */
export function idValido(valor: unknown): number | null {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 1 && valor <= INT_MAX ? valor : null;
}

/** Igual a idValido, para valores que chegam como texto (query string e :params). */
export function idDeTexto(valor: unknown): number | null {
  return typeof valor === "string" && /^\d{1,10}$/.test(valor) ? idValido(Number(valor)) : null;
}

/** Erros do Postgres que a API sabe explicar ao cliente em vez de responder 500. */
export function codigoPg(erro: unknown): string | undefined {
  return typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code) : undefined;
}
