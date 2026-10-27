import type { Claim, Item, User } from "@/types/domain";
import { canViewStoredAt } from "@/lib/rules";
import type { PublicItemView } from "../contracts";

/**
 * Projeção ÚNICA de item por visualizador (privacidade imposta no serviço, não na UI).
 * - `storedAt` (local de guarda) só sai quando `canViewStoredAt` permite (administração ou reivindicante com
 *   reivindicação aceita enquanto o item aguarda devolução); para os demais a chave é OMITIDA.
 * - `createdById` só sai para usuário logado (P26); visitante não o recebe.
 * O item guardado no store continua completo. `claims` são as reivindicações do store (a regra filtra pelo item).
 */
export function toViewerItem(item: Item, actor: null | undefined, claims: readonly Claim[]): PublicItemView;
export function toViewerItem(item: Item, actor: User, claims: readonly Claim[]): Item;
export function toViewerItem(item: Item, actor: User | null | undefined, claims: readonly Claim[]): Item | PublicItemView;
export function toViewerItem(item: Item, actor: User | null | undefined, claims: readonly Claim[]): Item | PublicItemView {
  const { storedAt, createdById, ...rest } = item;
  if (actor == null) return rest;
  return canViewStoredAt(actor, item, claims) ? { ...rest, createdById, storedAt } : { ...rest, createdById };
}
