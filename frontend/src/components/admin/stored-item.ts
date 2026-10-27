/**
 * Visitante e usuário comum recebem o item sem `storedAt` (privado) e visitante também sem `createdById` (P26); a
 * administração recebe ambos. As regras de `lib/rules` trabalham com o `Item`, então as telas da administração
 * convertem a visão aqui. `storedAt` NÃO é convertido (ausente continua ausente e `null` continua `null`, nunca
 * vira texto); só `createdById` ganha um valor vazio para satisfazer o tipo, o que não acontece com sessão de
 * administração.
 */
import type { ItemView } from "@/services";
import type { Item } from "@/types/domain";

export function toStoredItem(item: ItemView): Item {
  return { ...item, createdById: item.createdById ?? "" };
}
