/** Filtros da lista de usuários: opções dos seletores e leitura do valor escolhido. Funções puras. */
import { isUserRole } from "@/lib/rules";
import type { ListUsersFilters } from "@/services";
import { USER_ROLES, ROLE_LABEL, type UserRole } from "@/types/domain";
import type { UserStatusFilter } from "@/types/admin";

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = USER_ROLES.map((value) => ({
  value,
  label: ROLE_LABEL[value],
}));

export const STATUS_OPTIONS: { value: UserStatusFilter; label: string }[] = [
  { value: "active", label: "Ativas" },
  { value: "disabled", label: "Desativadas" },
];

export function parseRoleFilter(raw: string): UserRole | undefined {
  return isUserRole(raw) ? raw : undefined;
}

export function parseStatusFilter(raw: string): UserStatusFilter | undefined {
  return raw === "active" || raw === "disabled" ? raw : undefined;
}

export interface UserFilterState {
  q: string;
  role: string;
  status: string;
}

export const NO_USER_FILTERS: UserFilterState = { q: "", role: "", status: "" };

/** Algum filtro aplicado? (decide entre "nenhum usuário" e "nenhum resultado"). */
export function hasUserFilters(filters: UserFilterState): boolean {
  return filters.q.trim() !== "" || filters.role !== "" || filters.status !== "";
}

/** Parâmetros do serviço a partir dos campos da tela. Vazio = sem filtro. */
export function toListUsersFilters(filters: UserFilterState, page: number): ListUsersFilters {
  return {
    q: filters.q.trim() || undefined,
    role: parseRoleFilter(filters.role),
    status: parseStatusFilter(filters.status),
    page,
  };
}
