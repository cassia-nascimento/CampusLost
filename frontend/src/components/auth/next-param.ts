/**
 * Destino depois de entrar ou criar conta (`?next=`, P28). Lista de permissão: só `/itens/<id>`, sem
 * query nem fragmento, com id simples (letras, números, `_` e `-`). Qualquer outra coisa (URL externa,
 * `//`, barra invertida, rota privada, `/itens/novo`) é ignorada e a pessoa vai à página inicial do perfil.
 * Funções puras: nunca redirecionam sozinhas.
 */
export const NEXT_PARAM = "next";

const NEXT_PATTERN = /^\/itens\/(?!novo$)[A-Za-z0-9_-]{1,64}$/;

/** O caminho de destino se estiver na lista permitida; senão `null`. */
export function parseNext(raw: string | null | undefined): string | null {
  return typeof raw === "string" && NEXT_PATTERN.test(raw) ? raw : null;
}

/** `href` com o destino anexado (`/entrar?next=%2Fitens%2Fitem-01`); sem destino válido, o próprio `href`. */
export function withNext(href: string, next: string | null | undefined): string {
  const safe = parseNext(next);
  return safe ? `${href}?${NEXT_PARAM}=${encodeURIComponent(safe)}` : href;
}
