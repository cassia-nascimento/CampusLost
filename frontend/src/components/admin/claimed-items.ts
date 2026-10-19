/**
 * Resumo dos itens "Em reivindicação" para o painel da administração (DESIGN §9.8).
 * Função pura: só agrupa dados já lidos dos serviços; não decide nenhuma regra de negócio.
 */
import type { ClaimView } from "@/services";
import type { Item } from "@/types/domain";

export interface ClaimedItemSummary {
  item: Item;
  /** Reivindicação aceita aguardando a devolução, quando houver. */
  accepted: ClaimView | null;
  /** Quantidade de reivindicações pendentes do item. */
  pendingCount: number;
  /** Para onde "Abrir" leva: a aceita (devolução) ou a pendente mais antiga (P17). */
  reviewClaimId: string;
}

/**
 * Itens com reivindicação aceita primeiro (falta só a devolução); depois os que só têm pendentes.
 * Em cada grupo, a espera mais antiga vem antes (mesma lógica da fila de pendentes, P17).
 * Itens sem reivindicação ativa são omitidos.
 */
export function summarizeClaimedItems(
  items: readonly Item[],
  claimsByItem: readonly (readonly ClaimView[])[],
): ClaimedItemSummary[] {
  const rows: (ClaimedItemSummary & { waitingSince: string })[] = [];
  items.forEach((item, index) => {
    const claims = claimsByItem[index] ?? [];
    const accepted = claims.find((c) => c.status === "accepted") ?? null;
    const pending = claims
      .filter((c) => c.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const target = accepted ?? pending[0];
    if (!target) return;
    rows.push({
      item,
      accepted,
      pendingCount: pending.length,
      reviewClaimId: target.id,
      waitingSince: accepted?.reviewedAt ?? target.createdAt,
    });
  });
  rows.sort((a, b) => {
    if (Boolean(a.accepted) !== Boolean(b.accepted)) return a.accepted ? -1 : 1;
    return a.waitingSince.localeCompare(b.waitingSince) || a.item.id.localeCompare(b.item.id);
  });
  return rows.map((row) => ({
    item: row.item,
    accepted: row.accepted,
    pendingCount: row.pendingCount,
    reviewClaimId: row.reviewClaimId,
  }));
}
