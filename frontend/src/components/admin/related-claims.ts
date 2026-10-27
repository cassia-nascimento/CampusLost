/**
 * Reivindicações do mesmo item para a navegação entre elas na análise (RF04): ordem do envio (mais antiga
 * primeiro, a mesma da lista do detalhe do item), posição da aberta e vizinhas. Só organiza; não sugere
 * quem deve receber o objeto nem decide nada (as decisões são de `lib/rules`).
 */
export interface RelatedClaim {
  id: string;
  createdAt: string;
}

export interface RelatedClaims<T extends RelatedClaim> {
  /** Todas as reivindicações do item, da mais antiga para a mais recente. */
  list: T[];
  /** Posição (base 0) da aberta em `list`; `-1` se ela não está na lista. */
  index: number;
  total: number;
  previous: T | null;
  next: T | null;
}

export function relatedClaims<T extends RelatedClaim>(claims: readonly T[], currentId: string): RelatedClaims<T> {
  // Datas iguais ou ilegíveis mantêm a ordem recebida (ordenação estável).
  const list = [...claims].sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
  const index = list.findIndex((claim) => claim.id === currentId);
  return {
    list,
    index,
    total: list.length,
    previous: index > 0 ? list[index - 1] : null,
    next: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
  };
}
