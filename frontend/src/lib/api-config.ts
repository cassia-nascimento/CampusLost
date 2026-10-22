/**
 * Endereço da API REST (FastAPI). Vazio = modo de demonstração com dados de exemplo (mock).
 *
 * ATENÇÃO: variáveis `NEXT_PUBLIC_*` são EMBUTIDAS no código no `next build`. Mudar o valor exige novo
 * build (na Vercel, novo deploy); alterar só o ambiente de execução não tem efeito. O acesso abaixo é
 * literal (`process.env.NEXT_PUBLIC_API_URL`) para o Next conseguir substituí-lo também no navegador.
 */

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

/** ÚNICO ponto de leitura de `NEXT_PUBLIC_API_URL`. */
export function getApiBaseUrl(): string {
  return parseApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
}
