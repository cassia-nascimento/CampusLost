/**
 * Regras puras da administração (usuários, convites, 2FA obrigatório). Espelham `backend/app/routers/admin.py`.
 * Sem I/O e sem relógio global: datas chegam por parâmetro.
 */
import { USER_ROLES, type User, type UserRole } from "@/types/domain";
import {
  DEFAULT_PAGE_SIZE,
  type AdminInvite,
  type InviteStatus,
  type Page,
} from "@/types/admin";
import { ALLOW, deny, type Decision } from "./decision";

export interface UserPatch {
  role?: UserRole;
  active?: boolean;
}

/** Estado mínimo de uma conta para as regras de administração. */
export interface AccountState {
  id: string;
  role: UserRole;
  active: boolean;
}

/**
 * Pode `actor` aplicar `patch` a `target`? Ninguém altera a si mesmo (`CONFLICT`); o último admin ativo não pode
 * ser rebaixado nem desativado (`CONFLICT`). `others` = contas ativas de administração além de `target`.
 */
export function canUpdateUser(
  actor: Pick<User, "id" | "role">,
  target: AccountState,
  patch: UserPatch,
  otherActiveAdmins: number,
): Decision {
  if (actor.role !== "admin") return deny("FORBIDDEN", "Somente a administração pode gerenciar usuários.");
  if (actor.id === target.id) return deny("CONFLICT", "Você não pode alterar a sua própria conta por aqui.");
  const demoting = patch.role !== undefined && target.role === "admin" && patch.role !== "admin";
  const disabling = patch.active === false && target.active;
  if ((demoting || disabling) && target.role === "admin" && target.active && otherActiveAdmins === 0) {
    return deny("CONFLICT", "Esta é a última conta de administração ativa. Crie outra antes.");
  }
  return ALLOW;
}

/** Conta de administração ativa, para contar "outros admins". */
export function countOtherActiveAdmins(accounts: readonly AccountState[], targetId: string): number {
  return accounts.filter((a) => a.role === "admin" && a.active && a.id !== targetId).length;
}

/**
 * Administração sem 2FA ligado fica barrada em `/admin/*` (`TWO_FACTOR_REQUIRED`), salvo conta isenta
 * (a conta demo do seed, como no backend com `DEMO_MODE`).
 */
export function checkAdminTwoFactor(
  actor: Pick<User, "role" | "twoFactorEnabled">,
  options: { exempt: boolean },
): Decision {
  if (actor.role !== "admin") return deny("FORBIDDEN", "Somente a administração pode acessar esta área.");
  if (actor.twoFactorEnabled || options.exempt) return ALLOW;
  return deny("TWO_FACTOR_REQUIRED", "A administração precisa ativar a verificação em duas etapas antes de continuar.");
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/** Convites duram 48 h. */
export const INVITE_TTL_HOURS = 48;

/** Estado do convite no instante `now`. */
export function inviteStatus(
  invite: { usedAt?: string | null; revokedAt?: string | null; expiresAt: string },
  now: Date,
): InviteStatus {
  if (invite.usedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return "expired";
  return "pending";
}

/** O convite ainda pode ser usado? */
export function isInviteUsable(invite: AdminInvite): boolean {
  return invite.status === "pending";
}

/** Pagina uma lista já filtrada e ordenada. `page` fora do intervalo devolve `items: []` (como a API). */
export function paginate<T>(all: readonly T[], page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Page<T> {
  const total = all.length;
  return {
    items: all.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
