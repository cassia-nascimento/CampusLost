import type { User, UserRole } from "@/types/domain";
import { ALLOW, deny, type Decision } from "./decision";

/** Capacidades da SPEC §2. */
export type Capability =
  | "register_item"
  | "search_items"
  | "claim_item"
  | "view_own_claims"
  | "review_claims"
  | "edit_item"
  | "delete_item"
  | "register_return"
  | "view_returns"
  | "manage_users"
  | "view_audit";

const ALL: readonly UserRole[] = ["user", "admin"];
/** Papéis comuns (não administrativos): só `user`. */
const COMMON: readonly UserRole[] = ["user"];
const ADMIN: readonly UserRole[] = ["admin"];

/** Matriz de permissões por papel (SPEC §2). */
export const PERMISSIONS: Readonly<Record<Capability, readonly UserRole[]>> = {
  register_item: ALL,
  search_items: ALL,
  claim_item: COMMON,
  view_own_claims: COMMON,
  review_claims: ADMIN,
  edit_item: ADMIN,
  delete_item: ADMIN,
  register_return: ADMIN,
  view_returns: ADMIN,
  manage_users: ADMIN,
  view_audit: ADMIN,
};

/** Capacidades abertas a visitantes (sem sessão): ver a lista e o detalhe dos itens (P26). */
export const GUEST_CAPABILITIES: readonly Capability[] = ["search_items"];

type Actor = Pick<User, "role"> | null | undefined;

export function hasCapability(actor: Actor, capability: Capability): boolean {
  if (actor == null) return GUEST_CAPABILITIES.includes(capability);
  return PERMISSIONS[capability].includes(actor.role);
}

export function isAdmin(actor: Actor): boolean {
  return actor?.role === "admin";
}

/** Guarda de rota `/admin/**`. */
export function canAccessAdminArea(actor: Actor): boolean {
  return isAdmin(actor);
}

/** Verificação genérica com motivo (logado? papel permitido?). */
export function checkCapability(
  actor: Pick<User, "role"> | null | undefined,
  capability: Capability,
): Decision {
  if (actor == null) {
    if (hasCapability(actor, capability)) return ALLOW;
    return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  }
  if (!hasCapability(actor, capability)) {
    return deny("FORBIDDEN", "Você não tem permissão para realizar esta ação.");
  }
  return ALLOW;
}
