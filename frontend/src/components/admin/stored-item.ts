/**
 * A administração recebe o item com `storedAt` e `createdById`; as regras de `lib/rules` trabalham com o `Item`, então
 * as telas da administração convertem a visão aqui. `storedAt` NÃO é convertido (ausente continua ausente); só
 * `createdById` ganha um valor vazio para satisfazer o tipo, o que não acontece com sessão de administração.
 */
import type { ItemView } from "@/services";
import type { Item } from "@/types/domain";

export function toStoredItem(item: ItemView): Item {
  return { ...item, createdById: item.createdById ?? "" };
}
