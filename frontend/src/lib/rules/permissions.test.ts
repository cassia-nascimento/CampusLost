import { describe, expect, it } from "vitest";
import { externalUser, unverified, student, admin } from "./test-fixtures";
import {
  canAccessAdminArea,
  checkEmailVerified,
  checkCapability,
  hasCapability,
  PERMISSIONS,
  type Capability,
} from "./permissions";

describe("permissões por papel (SPEC §2)", () => {
  // [capacidade, aluno, professor, administração]
  const matrix: [Capability, boolean, boolean, boolean][] = [
    ["register_item", true, true, true],
    ["search_items", true, true, true],
    ["claim_item", true, true, false],
    ["view_own_claims", true, true, false],
    ["review_claims", false, false, true],
    ["edit_item", false, false, true],
    ["delete_item", false, false, true],
    ["register_return", false, false, true],
    ["view_returns", false, false, true],
    ["manage_users", false, false, true],
    ["view_audit", false, false, true],
  ];

  it("cobre todas as capacidades declaradas", () => {
    expect(matrix.map((m) => m[0]).sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  it.each(matrix)("%s", (capability, student, teacher, admin) => {
    expect(hasCapability({ role: "student" }, capability)).toBe(student);
    expect(hasCapability({ role: "teacher" }, capability)).toBe(teacher);
    expect(hasCapability({ role: "admin" }, capability)).toBe(admin);
    // visitante (P26): só ver/buscar itens
    expect(hasCapability(null, capability)).toBe(capability === "search_items");
  });

  it("guarda de /admin: só administração", () => {
    expect(canAccessAdminArea({ role: "admin" })).toBe(true);
    expect(canAccessAdminArea({ role: "student" })).toBe(false);
    expect(canAccessAdminArea({ role: "teacher" })).toBe(false);
    expect(canAccessAdminArea(null)).toBe(false);
  });

  it("checkCapability distingue visitante de papel insuficiente", () => {
    expect(checkCapability(null, "search_items")).toEqual({ allowed: true });
    for (const cap of ["register_item", "claim_item", "view_own_claims", "review_claims", "edit_item", "delete_item", "register_return", "view_returns"] as const) {
      expect(checkCapability(null, cap)).toMatchObject({ allowed: false, code: "UNAUTHENTICATED" });
    }
    expect(checkCapability({ role: "student" }, "review_claims")).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(checkCapability({ role: "admin" }, "review_claims")).toEqual({ allowed: true });
  });
});

describe("papel external e e-mail verificado", () => {
  it("external tem as mesmas permissões de student/teacher em todas as capacidades", () => {
    for (const c of Object.keys(PERMISSIONS) as Capability[]) {
      expect(hasCapability({ role: "external" }, c)).toBe(hasCapability({ role: "student" }, c));
    }
    expect(canAccessAdminArea(externalUser)).toBe(false);
  });

  it("conta não verificada não registra item nem reivindica (EMAIL_NOT_VERIFIED); o resto segue permitido", () => {
    for (const c of ["register_item", "claim_item"] as const) {
      expect(checkCapability(unverified, c)).toMatchObject({ allowed: false, code: "EMAIL_NOT_VERIFIED" });
      expect(checkCapability(student, c)).toEqual({ allowed: true });
      expect(checkCapability(externalUser, c)).toEqual({ allowed: true });
    }
    for (const c of ["search_items", "view_own_claims"] as const) {
      expect(checkCapability(unverified, c)).toEqual({ allowed: true });
    }
  });

  it("checkEmailVerified: visitante, não verificado, verificado e admin", () => {
    expect(checkEmailVerified(null)).toMatchObject({ allowed: false, code: "UNAUTHENTICATED" });
    expect(checkEmailVerified(unverified)).toMatchObject({ allowed: false, code: "EMAIL_NOT_VERIFIED" });
    expect(checkEmailVerified(student)).toEqual({ allowed: true });
    expect(checkEmailVerified(admin)).toEqual({ allowed: true });
  });
});
