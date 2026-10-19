import { describe, expect, it } from "vitest";
import { canRegisterReturn, filterReturnsByPeriod, registerReturn, sortReturns } from "./returns";
import { admin, makeClaim, makeItem, NOW, student, teacher } from "./test-fixtures";

const underClaim = makeItem({ status: "under_claim" });
const accepted = makeClaim({ id: "acc", status: "accepted", claimantId: student.id });

describe("canRegisterReturn (AC05.1)", () => {
  it("administração, item Em reivindicação e reivindicação aceita", () => {
    expect(canRegisterReturn(admin, underClaim, [accepted])).toEqual({ allowed: true });
  });

  it("sem reivindicação aceita não pode", () => {
    const pending = makeClaim({ status: "pending" });
    expect(canRegisterReturn(admin, underClaim, [pending])).toMatchObject({ allowed: false, code: "INVALID_TRANSITION" });
    expect(canRegisterReturn(admin, underClaim, [])).toMatchObject({ allowed: false, code: "INVALID_TRANSITION" });
  });

  it("item Disponível não pode ser devolvido", () => {
    expect(canRegisterReturn(admin, makeItem(), [accepted])).toMatchObject({ allowed: false, code: "INVALID_TRANSITION" });
  });

  it("item já Devolvido não pode ser devolvido de novo", () => {
    expect(canRegisterReturn(admin, makeItem({ status: "returned" }), [accepted])).toMatchObject({
      allowed: false,
      code: "ITEM_RETURNED",
    });
  });

  it("usuário comum e visitante não podem", () => {
    expect(canRegisterReturn(student, underClaim, [accepted])).toMatchObject({ code: "FORBIDDEN" });
    expect(canRegisterReturn(teacher, underClaim, [accepted])).toMatchObject({ code: "FORBIDDEN" });
    expect(canRegisterReturn(null, underClaim, [accepted])).toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("registerReturn (AC05.2)", () => {
  it("Em reivindicação → Devolvido e gera o registro com o dono da reivindicação aceita", () => {
    const other = makeClaim({ id: "rej", status: "rejected", claimantId: teacher.id });
    const r = registerReturn({ actor: admin, item: underClaim, itemClaims: [other, accepted], id: "ret1", now: NOW });
    expect(r.item.status).toBe("returned");
    expect(r.record).toEqual({
      id: "ret1",
      itemId: underClaim.id,
      claimId: "acc",
      returnedToId: student.id,
      registeredById: admin.id,
      returnedAt: NOW.toISOString(),
    });
  });

  it("lança erro tipado quando não permitido", () => {
    expect(() =>
      registerReturn({ actor: student, item: underClaim, itemClaims: [accepted], id: "r", now: NOW }),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() =>
      registerReturn({ actor: admin, item: underClaim, itemClaims: [], id: "r", now: NOW }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });
});

describe("listagem de devoluções (AC05.3)", () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
  const records = [
    { id: "a", returnedAt: at(2026, 10, 1) },
    { id: "b", returnedAt: at(2026, 10, 10) },
    { id: "c", returnedAt: at(2026, 10, 15) },
  ];

  it("filtra por período inclusivo", () => {
    expect(filterReturnsByPeriod(records, { from: "2026-10-10", to: "2026-10-15" }).map((r) => r.id)).toEqual(["b", "c"]);
    expect(filterReturnsByPeriod(records, { from: "2026-10-11" }).map((r) => r.id)).toEqual(["c"]);
    expect(filterReturnsByPeriod(records, { to: "2026-10-01" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterReturnsByPeriod(records)).toHaveLength(3);
  });

  it("ordena das mais recentes para as mais antigas", () => {
    expect(sortReturns(records).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
});
