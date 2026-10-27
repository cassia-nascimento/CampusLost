import { describe, expect, it } from "vitest";
import { canUpdateUser, checkAdminTwoFactor, countOtherActiveAdmins, inviteStatus, paginate, type AccountState } from "./admin";

const admin = { id: "a1", role: "admin" as const };
const target = (over: Partial<AccountState> = {}): AccountState => ({ id: "u2", role: "user", active: true, ...over });

describe("canUpdateUser", () => {
  it("só administração altera usuários", () => {
    const d = canUpdateUser({ id: "x", role: "user" }, target(), { role: "user" }, 1);
    expect(d).toMatchObject({ allowed: false, code: "FORBIDDEN" });
  });

  it("ninguém altera a si mesmo (papel nem estado)", () => {
    const me = target({ id: "a1", role: "admin" });
    expect(canUpdateUser(admin, me, { role: "user" }, 1)).toMatchObject({ allowed: false, code: "CONFLICT" });
    expect(canUpdateUser(admin, me, { active: false }, 1)).toMatchObject({ allowed: false, code: "CONFLICT" });
  });

  it("o último admin ativo não pode ser rebaixado nem desativado", () => {
    const last = target({ id: "a2", role: "admin" });
    expect(canUpdateUser(admin, last, { role: "user" }, 0)).toMatchObject({ allowed: false, code: "CONFLICT" });
    expect(canUpdateUser(admin, last, { active: false }, 0)).toMatchObject({ allowed: false, code: "CONFLICT" });
    expect(canUpdateUser(admin, last, { role: "user", active: false }, 0).allowed).toBe(false);
  });

  it("com outro admin ativo, rebaixar/desativar é permitido; manter admin e ativar também", () => {
    const other = target({ id: "a2", role: "admin" });
    expect(canUpdateUser(admin, other, { role: "user" }, 1).allowed).toBe(true);
    expect(canUpdateUser(admin, other, { active: false }, 1).allowed).toBe(true);
    expect(canUpdateUser(admin, other, { role: "admin" }, 0).allowed).toBe(true);
    expect(canUpdateUser(admin, target({ id: "a3", role: "admin", active: false }), { active: true }, 0).allowed).toBe(true);
  });

  it("usuário comum muda de papel e é desativado/reativado livremente", () => {
    expect(canUpdateUser(admin, target(), { role: "admin" }, 0).allowed).toBe(true);
    expect(canUpdateUser(admin, target(), { active: false }, 0).allowed).toBe(true);
    expect(canUpdateUser(admin, target({ active: false }), { active: true }, 0).allowed).toBe(true);
  });

  it("countOtherActiveAdmins ignora o alvo, inativos e não-admins", () => {
    const list: AccountState[] = [
      { id: "a1", role: "admin", active: true },
      { id: "a2", role: "admin", active: true },
      { id: "a3", role: "admin", active: false },
      { id: "u1", role: "user", active: true },
    ];
    expect(countOtherActiveAdmins(list, "a1")).toBe(1);
    expect(countOtherActiveAdmins(list, "u1")).toBe(2);
  });
});

describe("checkAdminTwoFactor", () => {
  it("admin sem 2FA e não isento -> TWO_FACTOR_REQUIRED", () => {
    expect(checkAdminTwoFactor({ role: "admin" }, { exempt: false })).toMatchObject({ allowed: false, code: "TWO_FACTOR_REQUIRED" });
    expect(checkAdminTwoFactor({ role: "admin", twoFactorEnabled: false }, { exempt: false }).allowed).toBe(false);
  });
  it("2FA ligado ou conta isenta passa; outros papéis -> FORBIDDEN", () => {
    expect(checkAdminTwoFactor({ role: "admin", twoFactorEnabled: true }, { exempt: false }).allowed).toBe(true);
    expect(checkAdminTwoFactor({ role: "admin" }, { exempt: true }).allowed).toBe(true);
    expect(checkAdminTwoFactor({ role: "user", twoFactorEnabled: true }, { exempt: true })).toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("inviteStatus", () => {
  const now = new Date("2026-10-19T12:00:00.000Z");
  const base = { expiresAt: "2026-10-20T12:00:00.000Z" };
  it("pending, accepted, revoked, expired (aceito vence revogado; revogado vence expirado)", () => {
    expect(inviteStatus(base, now)).toBe("pending");
    expect(inviteStatus({ ...base, usedAt: "2026-10-19T11:00:00.000Z", revokedAt: "x" }, now)).toBe("accepted");
    expect(inviteStatus({ ...base, revokedAt: "2026-10-19T11:00:00.000Z" }, now)).toBe("revoked");
    expect(inviteStatus({ expiresAt: "2026-10-19T12:00:00.000Z" }, now)).toBe("expired");
    expect(inviteStatus({ expiresAt: "2026-10-18T12:00:00.000Z", revokedAt: "x" }, now)).toBe("revoked");
  });
});

describe("paginate", () => {
  const all = Array.from({ length: 45 }, (_, i) => i);
  it("página 1 com 20, totalPages 3; última com 5; além do fim vazia", () => {
    expect(paginate(all)).toMatchObject({ page: 1, pageSize: 20, total: 45, totalPages: 3 });
    expect(paginate(all).items).toHaveLength(20);
    expect(paginate(all, 3).items).toEqual([40, 41, 42, 43, 44]);
    expect(paginate(all, 9).items).toEqual([]);
  });
  it("lista vazia tem totalPages 1", () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  });
});
