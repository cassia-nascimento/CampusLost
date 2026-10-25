import type { Item, ItemStatus, User } from "@/types/domain";
import { ALLOW, deny, type Decision } from "./decision";
import { checkEmailVerified, hasCapability } from "./permissions";
import { isItemLocked } from "./item-status";

export type ItemSort = "registered" | "found";

export interface ItemFilters {
  category?: string;
  location?: string;
  /** Início do período (inclusive), `YYYY-MM-DD`, sobre a data em que foi encontrado (P11). */
  from?: string;
  /** Fim do período (inclusive). */
  to?: string;
  /** Restringe a um status visível na busca (Devolvido nunca aparece). */
  status?: Exclude<ItemStatus, "returned">;
  /** Padrão `registered`: mais recentemente registrados primeiro (AC03.4). */
  sort?: ItemSort;
}

/** Devolvidos somem da busca (AC03.2). */
export function isVisibleInSearch(item: Pick<Item, "status">): boolean {
  return item.status !== "returned";
}

export function canRegisterItem(actor: User | null | undefined): Decision {
  if (actor == null) return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if (!hasCapability(actor, "register_item")) {
    return deny("FORBIDDEN", "Você não tem permissão para registrar itens.");
  }
  return checkEmailVerified(actor);
}

function checkMutable(
  actor: User | null | undefined,
  item: Item,
  capability: "edit_item" | "delete_item",
  verb: string,
): Decision {
  if (actor == null) return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if (!hasCapability(actor, capability)) {
    return deny("FORBIDDEN", `Somente a administração pode ${verb} itens.`);
  }
  if (isItemLocked(item.status)) {
    return deny("ITEM_RETURNED", `Itens devolvidos não podem ser ${verb === "editar" ? "editados" : "excluídos"}.`);
  }
  return ALLOW;
}

export function canEditItem(actor: User | null | undefined, item: Item): Decision {
  return checkMutable(actor, item, "edit_item", "editar");
}

export function canDeleteItem(actor: User | null | undefined, item: Item): Decision {
  return checkMutable(actor, item, "delete_item", "excluir");
}

/** Filtros combinam entre si (AND). Remove devolvidos. Não ordena. */
export function filterItems(items: readonly Item[], filters: ItemFilters = {}): Item[] {
  return items.filter((item) => {
    if (!isVisibleInSearch(item)) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.location && item.foundLocation !== filters.location) return false;
    if (filters.from && item.foundDate < filters.from) return false;
    if (filters.to && item.foundDate > filters.to) return false;
    return true;
  });
}

/** Mais recentes primeiro. Desempate estável pelo outro critério e depois pelo id. */
export function sortItems(items: readonly Item[], sort: ItemSort = "registered"): Item[] {
  const byCreated = (a: Item, b: Item) => b.createdAt.localeCompare(a.createdAt);
  const byFound = (a: Item, b: Item) => b.foundDate.localeCompare(a.foundDate);
  const [primary, secondary] = sort === "found" ? [byFound, byCreated] : [byCreated, byFound];
  return [...items].sort((a, b) => primary(a, b) || secondary(a, b) || a.id.localeCompare(b.id));
}

export function searchItems(items: readonly Item[], filters: ItemFilters = {}): Item[] {
  return sortItems(filterItems(items, filters), filters.sort);
}
