/**
 * Modo da API REST (FastAPI). `NEXT_PUBLIC_API_URL` vazia = modo de demonstração com dados de exemplo (mock).
 * Definida (http/https válido) = modo REST, mas o navegador NUNCA fala com esse endereço: a sessão é por cookie
 * HttpOnly e tudo passa pelo mesmo domínio, no prefixo `API_PROXY_PREFIX`, que o Next reescreve (rewrite) para a
 * API. O valor da variável só liga o modo (e é o destino do rewrite no servidor do Next).
 *
 * ATENÇÃO: variáveis `NEXT_PUBLIC_*` são EMBUTIDAS no código no `next build`. Mudar o valor exige novo
 * build (na Vercel, novo deploy); alterar só o ambiente de execução não tem efeito. O acesso abaixo é
 * literal (`process.env.NEXT_PUBLIC_API_URL`) para o Next conseguir substituí-lo também no navegador.
 */

/** Prefixo same-origin pelo qual o navegador chama a API (rewrite do Next -> `NEXT_PUBLIC_API_URL`). */
export const API_PROXY_PREFIX = "/backend";

/** Normaliza o valor: só http(s), sem espaços, sem barra final. Devolve `""` se ausente ou inválido. */
export function parseApiBaseUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  } catch {
    return "";
  }
  return value;
}

/** `NEXT_PUBLIC_API_URL` normalizada (destino do rewrite do Next, não usada pelo navegador). `""` = modo mock. */
export function getApiTargetUrl(): string {
  return parseApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
}

/**
 * ÚNICO ponto que liga o modo REST. Base usada pelo cliente: `API_PROXY_PREFIX` (same-origin) quando a variável
 * está definida; `""` no modo mock. Fotos da API ficam em `${base}/uploads/...`.
 */
export function getApiBaseUrl(): string {
  return getApiTargetUrl() ? API_PROXY_PREFIX : "";
}
