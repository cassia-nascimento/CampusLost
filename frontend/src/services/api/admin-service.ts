import type { AdminInvite, AdminUserRow, AuditEntry, CreatedInvite, Page } from "@/types/admin";
import type { AdminService } from "../contracts";
import type { HttpClient } from "./http";
import { asArray, asRecord } from "./mappers";

type Query = Record<string, string | undefined>;

/** `{ items, page, pageSize, total, totalPages }` -> `Page<T>` (cada item passa por `map`). */
function toPage<T>(raw: unknown, map: (item: unknown) => T): Page<T> {
  const r = asRecord(raw, "página");
  return {
    items: asArray(r.items, "items").map(map),
    page: Number(r.page),
    pageSize: Number(r.pageSize),
    total: Number(r.total),
    totalPages: Number(r.totalPages),
  };
}

const num = (value: number | undefined): string | undefined => (value === undefined ? undefined : String(value));

/** Administração: `/admin/*` (API.md §4.8). Erros (`FORBIDDEN`, `TWO_FACTOR_REQUIRED`, `CONFLICT`...) vêm do servidor. */
export function createAdminService(http: HttpClient, changed: () => void): AdminService {
  const user = (raw: unknown) => asRecord(raw, "usuário") as unknown as AdminUserRow;
  const invite = (raw: unknown) => asRecord(raw, "convite") as unknown as AdminInvite;
  const entry = (raw: unknown) => asRecord(raw, "evento") as unknown as AuditEntry;

  return {
    async listUsers(filters) {
      const query: Query = {
        q: filters?.q?.trim() || undefined,
        role: filters?.role || undefined,
        affiliation: filters?.affiliation || undefined,
        status: filters?.status || undefined,
        page: num(filters?.page),
        pageSize: num(filters?.pageSize),
      };
      return toPage(await http.request("GET", "/admin/users", { query }), user);
    },

    async updateUser(id, patch) {
      const json = {
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
      };
      const updated = user(await http.request("PATCH", `/admin/users/${encodeURIComponent(id)}`, { json }));
      changed();
      return updated;
    },

    async createInvite(email): Promise<CreatedInvite> {
      const created = invite(await http.request("POST", "/admin/invites", { json: { email } }));
      changed();
      return created; // sem `devLink`: o link vai por e-mail
    },

    async listInvites(filters) {
      const query: Query = { page: num(filters?.page), pageSize: num(filters?.pageSize) };
      return toPage(await http.request("GET", "/admin/invites", { query }), invite);
    },

    async revokeInvite(id) {
      await http.request("DELETE", `/admin/invites/${encodeURIComponent(id)}`);
      changed();
    },

    async listAuditLog(filters) {
      const query: Query = {
        action: filters?.action?.trim() || undefined,
        actor: filters?.actor?.trim() || undefined,
        page: num(filters?.page),
        pageSize: num(filters?.pageSize),
      };
      return toPage(await http.request("GET", "/admin/audit", { query }), entry);
    },
  };
}
