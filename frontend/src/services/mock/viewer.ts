import type { Item, User } from "@/types/domain";
import type { PublicItemView } from "../contracts";

/**
 * Projeção ÚNICA de item por visualizador (privacidade imposta no serviço, não na UI).
 * - `storedAt` (local de guarda) só sai para a administração; para visitante e usuário comum (inclusive
 *   criador e quem reivindicou, mesmo com reivindicação aceita) a chave é OMITIDA.
 * - `createdById` só sai para usuário logado (P26); visitante não o recebe.
 * O item guardado no store continua completo.
 */
export function toViewerItem(item: Item, actor: null | undefined): PublicItemView;
export function toViewerItem(item: Item, actor: User): Item;
export function toViewerItem(item: Item, actor: User | null | undefined): Item | PublicItemView;
export function toViewerItem(item: Item, actor: User | null | undefined): Item | PublicItemView {
  const { storedAt, createdById, ...rest } = item;
  if (actor == null) return rest;
  return actor.role === "admin" ? { ...rest, createdById, storedAt } : { ...rest, createdById };
}
