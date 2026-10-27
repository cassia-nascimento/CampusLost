/**
 * Itens "Aguardando devolução" do painel da administração (DESIGN §9.8, SPEC P45).
 * Função pura: só agrupa dados já lidos dos serviços; não decide nenhuma regra de negócio.
 */
import type { ClaimView } from "@/services";
import type { Item } from "@/types/domain";

export interface AwaitingReturnRow {
  item: Item;
  /** Reivindicação aceita: é ela que leva à tela de registro da devolução. */
  accepted: ClaimView;
}

/**
 * Só itens Em reivindicação com uma reivindicação aceita (falta apenas a devolução).
 * Itens que só têm pendentes ficam na fila de análise; itens já devolvidos saem da lista.
 * Ordem: aceitação mais antiga primeiro (`reviewedAt`), como a fila de pendentes (P17).
 */
export function summarizeAwaitingReturn(
  items: readonly Item[],
  claimsByItem: readonly (readonly ClaimView[])[],
): AwaitingReturnRow[] {
  const rows: (AwaitingReturnRow & { acceptedAt: string })[] = [];
  items.forEach((item, index) => {
    if (item.status !== "under_claim") return;
    const accepted = (claimsByItem[index] ?? []).find((c) => c.status === "accepted");
    if (!accepted) return;
    rows.push({ item, accepted, acceptedAt: accepted.reviewedAt ?? accepted.createdAt });
  });
  rows.sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt) || a.item.id.localeCompare(b.item.id));
  return rows.map(({ item, accepted }) => ({ item, accepted }));
}
