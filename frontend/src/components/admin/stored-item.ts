/**
 * Visitante recebe o item sem `storedAt` nem `createdById` (P26); a administração sempre recebe ambos. As regras
 * de `lib/rules` trabalham com o `Item` completo, então as telas da administração convertem a visão aqui. Os
 * valores vazios só satisfazem o tipo: não acontecem com sessão de administração.
 */
import type { ItemView } from "@/services";
import type { Item } from "@/types/domain";

export function toStoredItem(item: ItemView): Item {
  return { ...item, storedAt: item.storedAt ?? "", createdById: item.createdById ?? "" };
}
