import { ServiceError, ITEM_STATUS_LABEL, type ItemStatus } from "@/types/domain";

/**
 * Máquina de estados do item (SPEC §4). Nenhum outro status existe.
 *  - available   → under_claim : chega a primeira reivindicação
 *  - under_claim → returned    : devolução registrada (exige reivindicação aceita)
 *  - under_claim → available   : todas as reivindicações foram recusadas
 */
export const ITEM_TRANSITIONS: Readonly<Record<ItemStatus, readonly ItemStatus[]>> = {
  available: ["under_claim"],
  under_claim: ["returned", "available"],
  returned: [],
};

export function canTransition(from: ItemStatus, to: ItemStatus): boolean {
  return ITEM_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ItemStatus, to: ItemStatus): void {
  if (!canTransition(from, to)) {
    throw new ServiceError(
      from === "returned" ? "ITEM_RETURNED" : "INVALID_TRANSITION",
      from === "returned"
        ? "Este item já foi devolvido e não pode mais ser alterado."
        : `Não é possível mudar o item de "${ITEM_STATUS_LABEL[from]}" para "${ITEM_STATUS_LABEL[to]}".`,
    );
  }
}

/** Itens devolvidos são somente leitura (P10). */
export function isItemLocked(status: ItemStatus): boolean {
  return status === "returned";
}
