import { describe, expect, it } from "vitest";
import {
  canAccessAdminArea,
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
  ];

  it("cobre todas as capacidades declaradas", () => {
    expect(matrix.map((m) => m[0]).sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  it.each(matrix)("%s", (capability, student, teacher, admin) => {
    expect(hasCapability({ role: "student" }, capability)).toBe(student);
    expect(hasCapability({ role: "teacher" }, capability)).toBe(teacher);
    expect(hasCapability({ role: "admin" }, capability)).toBe(admin);
    expect(hasCapability(null, capability)).toBe(false);
  });

  it("guarda de /admin: só administração", () => {
    expect(canAccessAdminArea({ role: "admin" })).toBe(true);
    expect(canAccessAdminArea({ role: "student" })).toBe(false);
    expect(canAccessAdminArea({ role: "teacher" })).toBe(false);
    expect(canAccessAdminArea(null)).toBe(false);
  });

  it("checkCapability distingue visitante de papel insuficiente", () => {
    expect(checkCapability(null, "search_items")).toMatchObject({ allowed: false, code: "UNAUTHENTICATED" });
    expect(checkCapability({ role: "student" }, "review_claims")).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(checkCapability({ role: "admin" }, "review_claims")).toEqual({ allowed: true });
  });
});
