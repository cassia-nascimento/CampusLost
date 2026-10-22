/**
 * Regras puras do "Entrar com Google" institucional (P30).
 * O domínio permitido é uma HIPÓTESE da equipe (`undb.edu.br`) e é configurável.
 */

/** Domínio institucional padrão (hipótese da equipe, P30). */
export const DEFAULT_GOOGLE_ALLOWED_DOMAINS: readonly string[] = ["undb.edu.br"];

const LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
const DOMAIN_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`);
/** Parte local sem `@`, espaços ou controles; um único `@`; domínio com rótulos ASCII válidos. */
const EMAIL_RE = new RegExp(`^[^\\s@]+@(${LABEL}(?:\\.${LABEL})+)$`);

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

/**
 * `true` se o e-mail é válido e seu domínio é exatamente um dos permitidos ou subdomínio de um deles
 * (`a.undb.edu.br` vale para `undb.edu.br`; `evilundb.edu.br` e `undb.edu.br.evil.com` não).
 */
export function isAllowedGoogleEmail(email: string, allowedDomains: readonly string[]): boolean {
  if (typeof email !== "string") return false;
  const match = EMAIL_RE.exec(email.trim().toLowerCase());
  if (!match) return false;
  const domain = match[1];
  return allowedDomains
    .map(normalizeDomain)
    .filter((d) => DOMAIN_RE.test(d))
    .some((d) => domain === d || domain.endsWith(`.${d}`));
}

/**
 * Lista separada por vírgulas (ex.: `"undb.edu.br, outro.edu.br"`). Entradas inválidas são ignoradas;
 * sem nenhuma válida (ou `raw` ausente/vazio) vale o padrão.
 */
export function parseAllowedDomains(raw?: string): string[] {
  const parsed = (raw ?? "")
    .split(",")
    .map(normalizeDomain)
    .filter((d) => DOMAIN_RE.test(d));
  const unique = [...new Set(parsed)];
  return unique.length > 0 ? unique : [...DEFAULT_GOOGLE_ALLOWED_DOMAINS];
}

/**
 * Domínios permitidos configurados no ambiente (`NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS`). ÚNICO ponto
 * de leitura da variável (acesso literal, para o Next.js inlinar no cliente). Usado por
 * `services/index.ts` e pelo endpoint de servidor que verifica o ID token.
 */
export function getAllowedGoogleDomains(): string[] {
  return parseAllowedDomains(process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS);
}
