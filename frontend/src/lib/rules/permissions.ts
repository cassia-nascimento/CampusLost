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
  | "view_returns";

const ALL: readonly UserRole[] = ["student", "teacher", "external", "admin"];
/** Papéis comuns (não administrativos): aluno, professor e comunidade externa. */
const COMMON: readonly UserRole[] = ["student", "teacher", "external"];
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
};

/** Capacidades abertas a visitantes (sem sessão): ver a lista e o detalhe dos itens (P26). */
export const GUEST_CAPABILITIES: readonly Capability[] = ["search_items"];

type Actor = Pick<User, "role"> | null | undefined;

/** Capacidades que exigem e-mail verificado (conta por senha não verificada não as exerce). */
export const VERIFIED_EMAIL_CAPABILITIES: readonly Capability[] = ["register_item", "claim_item"];

/** Conta com e-mail verificado? Administração é sempre considerada verificada. */
export function checkEmailVerified(actor: Pick<User, "role" | "emailVerified"> | null | undefined): Decision {
  if (actor == null) return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if (actor.role === "admin" || actor.emailVerified) return ALLOW;
  return deny("EMAIL_NOT_VERIFIED", "Confirme seu e-mail para cadastrar itens ou reivindicar.");
}

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
  actor: (Pick<User, "role"> & Partial<Pick<User, "emailVerified">>) | null | undefined,
  capability: Capability,
): Decision {
  if (actor == null) {
    if (hasCapability(actor, capability)) return ALLOW;
    return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  }
  if (!hasCapability(actor, capability)) {
    return deny("FORBIDDEN", "Você não tem permissão para realizar esta ação.");
  }
  // `emailVerified` ausente (ator parcial) não bloqueia; o tipo `User` sempre o traz.
  if (VERIFIED_EMAIL_CAPABILITIES.includes(capability) && actor.emailVerified === false) {
    return checkEmailVerified({ role: actor.role, emailVerified: false });
  }
  return ALLOW;
}
