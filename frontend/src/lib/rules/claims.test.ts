import { describe, expect, it } from "vitest";
import { canClaim, canReviewClaim, canViewClaim, reviewClaim, submitClaim } from "./claims";
import { admin, externalUser, makeClaim, makeItem, NOW, otherStudent, student, teacher, unverified } from "./test-fixtures";

const input = { proofDetails: "Detalhe secreto do objeto.", lostWhereWhen: "Biblioteca, segunda." };

describe("canClaim: external e e-mail verificado", () => {
  it("usuário externo verificado reivindica como qualquer usuário", () => {
    expect(canClaim(externalUser, makeItem(), [])).toEqual({ allowed: true });
  });
  it("conta não verificada: EMAIL_NOT_VERIFIED, mesmo em item Disponível", () => {
    expect(canClaim(unverified, makeItem(), [])).toMatchObject({ allowed: false, code: "EMAIL_NOT_VERIFIED" });
    expect(() => submitClaim({ actor: unverified, item: makeItem(), itemClaims: [], input, now: NOW, id: "c1" })).toThrow(
      expect.objectContaining({ code: "EMAIL_NOT_VERIFIED" }),
    );
  });
});

describe("canClaim (AC04.1, P46)", () => {
  it("usuário comum pode reivindicar item Disponível", () => {
    expect(canClaim(student, makeItem(), [])).toEqual({ allowed: true });
    expect(canClaim(teacher, makeItem(), [])).toEqual({ allowed: true });
  });

  it("pode reivindicar item Em reivindicação (AC04.3)", () => {
    const item = makeItem({ status: "under_claim" });
    const others = [makeClaim({ claimantId: otherStudent.id })];
    expect(canClaim(student, item, others)).toEqual({ allowed: true });
  });

  it("quem registrou o item não pode reivindicá-lo (P46, AC04.12)", () => {
    const own = makeItem({ createdById: student.id });
    const denied = {
      allowed: false,
      code: "FORBIDDEN",
      message: "Você registrou este item, então não pode reivindicá-lo. Se ele é seu, procure a administração.",
    };
    expect(canClaim(student, own, [])).toEqual(denied);
    expect(() => submitClaim({ actor: student, item: own, itemClaims: [], input, now: NOW, id: "c1" })).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", message: denied.message }),
    );
    // a regra é por item e não mexe nas reivindicações de terceiros
    expect(canClaim(student, makeItem({ createdById: otherStudent.id }), [])).toEqual({ allowed: true });
    expect(canClaim(student, { ...own, status: "under_claim" }, [makeClaim({ claimantId: otherStudent.id })])).toEqual(denied);
  });

  it("administração que registrou o item: a mensagem da capacidade prevalece", () => {
    expect(canClaim(admin, makeItem({ createdById: admin.id }), [])).toEqual({
      allowed: false,
      code: "FORBIDDEN",
      message: "A administração analisa reivindicações, mas não reivindica itens.",
    });
  });

  it("cadastrante com e-mail não verificado: EMAIL_NOT_VERIFIED vem antes", () => {
    expect(canClaim(unverified, makeItem({ createdById: unverified.id }), [])).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
  });

  it("administração não reivindica", () => {
    expect(canClaim(admin, makeItem(), [])).toMatchObject({ allowed: false, code: "FORBIDDEN" });
  });

  it("visitante não reivindica", () => {
    expect(canClaim(null, makeItem(), [])).toMatchObject({ allowed: false, code: "UNAUTHENTICATED" });
  });

  it("item Devolvido não recebe reivindicações", () => {
    expect(canClaim(student, makeItem({ status: "returned" }), [])).toMatchObject({
      allowed: false,
      code: "ITEM_RETURNED",
    });
  });

  it.each(["pending", "accepted"] as const)("reivindicação %s própria bloqueia nova (duplicada)", (status) => {
    const item = makeItem({ status: "under_claim" });
    expect(canClaim(student, item, [makeClaim({ status })])).toMatchObject({
      allowed: false,
      code: "DUPLICATE_CLAIM",
    });
  });

  it("reivindicação própria já aceita explica que deve procurar a administração", () => {
    const item = makeItem({ status: "under_claim" });
    expect(canClaim(student, item, [makeClaim({ status: "accepted" })])).toEqual({
      allowed: false,
      code: "DUPLICATE_CLAIM",
      message: "Sua reivindicação foi aceita. Procure a administração para retirar o item.",
    });
  });

  it("reivindicação recusada própria bloqueia reenvio (AC04.7)", () => {
    const result = canClaim(student, makeItem(), [makeClaim({ status: "rejected" })]);
    expect(result).toMatchObject({ allowed: false, code: "CLAIM_BLOCKED" });
    if (!result.allowed) expect(result.message).toMatch(/administra/i);
  });

  it("reivindicações de outros usuários não bloqueiam", () => {
    const claims = [makeClaim({ claimantId: otherStudent.id, status: "rejected" })];
    expect(canClaim(student, makeItem(), claims)).toEqual({ allowed: true });
  });

  it("premissa: com reivindicação aceita de outro, novas são bloqueadas", () => {
    const item = makeItem({ status: "under_claim" });
    const claims = [makeClaim({ claimantId: otherStudent.id, status: "accepted" })];
    expect(canClaim(student, item, claims)).toMatchObject({ allowed: false, code: "CLAIM_BLOCKED" });
  });
});

describe("submitClaim (AC04.2)", () => {
  it("Disponível → Em reivindicação com reivindicação pendente", () => {
    const result = submitClaim({ actor: student, item: makeItem(), itemClaims: [], input, id: "c1", now: NOW });
    expect(result.item.status).toBe("under_claim");
    expect(result.claim).toMatchObject({
      id: "c1",
      itemId: "item-x",
      claimantId: student.id,
      status: "pending",
      createdAt: NOW.toISOString(),
      ...input,
    });
    expect(result.claim.reviewedAt).toBeUndefined();
  });

  it("segunda reivindicação mantém Em reivindicação", () => {
    const item = makeItem({ status: "under_claim" });
    const first = makeClaim({ claimantId: otherStudent.id });
    const result = submitClaim({ actor: student, item, itemClaims: [first], input, id: "c2", now: NOW });
    expect(result.item.status).toBe("under_claim");
  });

  it("não muta o item de entrada", () => {
    const item = makeItem();
    submitClaim({ actor: student, item, itemClaims: [], input, id: "c1", now: NOW });
    expect(item.status).toBe("available");
  });

  it("lança o erro tipado quando proibido", () => {
    expect(() =>
      submitClaim({ actor: admin, item: makeItem(), itemClaims: [], input, id: "c1", now: NOW }),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() =>
      submitClaim({
        actor: student,
        item: makeItem({ status: "under_claim" }),
        itemClaims: [makeClaim()],
        input,
        id: "c1",
        now: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: "DUPLICATE_CLAIM" }));
  });
});

describe("reviewClaim", () => {
  const item = makeItem({ status: "under_claim" });
  const a = makeClaim({ id: "a", claimantId: student.id });
  const b = makeClaim({ id: "b", claimantId: otherStudent.id });
  const c = makeClaim({ id: "c", claimantId: teacher.id });

  it("aceitar recusa automaticamente as demais pendentes e mantém o item Em reivindicação (AC04.5)", () => {
    const r = reviewClaim({ actor: admin, item, itemClaims: [a, b, c], claimId: "b", decision: "accept", now: NOW });
    expect(r.claim).toMatchObject({ id: "b", status: "accepted", reviewedAt: NOW.toISOString() });
    expect(r.claims.find((x) => x.id === "a")).toMatchObject({ status: "rejected", reviewedAt: NOW.toISOString() });
    expect(r.claims.find((x) => x.id === "c")).toMatchObject({ status: "rejected" });
    expect(r.autoRejectedIds.sort()).toEqual(["a", "c"]);
    expect(r.item.status).toBe("under_claim");
  });

  it("aceitar não altera reivindicações já recusadas", () => {
    const old = makeClaim({ id: "old", status: "rejected", reviewedAt: "2026-10-01T00:00:00.000Z" });
    const r = reviewClaim({ actor: admin, item, itemClaims: [old, a], claimId: "a", decision: "accept", now: NOW });
    expect(r.claims.find((x) => x.id === "old")).toEqual(old);
    expect(r.autoRejectedIds).toEqual([]);
  });

  it("recusar uma entre várias ativas mantém o item Em reivindicação", () => {
    const r = reviewClaim({ actor: admin, item, itemClaims: [a, b], claimId: "a", decision: "reject", now: NOW });
    expect(r.claim.status).toBe("rejected");
    expect(r.claims.find((x) => x.id === "b")?.status).toBe("pending");
    expect(r.item.status).toBe("under_claim");
  });

  it("recusar a última ativa devolve o item a Disponível (AC04.6)", () => {
    const r = reviewClaim({ actor: admin, item, itemClaims: [a], claimId: "a", decision: "reject", now: NOW });
    expect(r.item.status).toBe("available");
  });

  it("recusar a última ativa, havendo outras já recusadas, devolve a Disponível", () => {
    const old = makeClaim({ id: "old", status: "rejected" });
    const r = reviewClaim({ actor: admin, item, itemClaims: [old, a], claimId: "a", decision: "reject", now: NOW });
    expect(r.item.status).toBe("available");
  });

  it("recusar a pendente quando há uma aceita não é possível (aceita já recusou as demais)", () => {
    const accepted = makeClaim({ id: "acc", status: "accepted" });
    expect(() =>
      reviewClaim({ actor: admin, item, itemClaims: [accepted], claimId: "acc", decision: "reject", now: NOW }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("reivindicação já analisada não pode ser reanalisada", () => {
    const done = makeClaim({ id: "d", status: "rejected" });
    for (const decision of ["accept", "reject"] as const) {
      expect(() =>
        reviewClaim({ actor: admin, item, itemClaims: [done], claimId: "d", decision, now: NOW }),
      ).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
    }
  });

  it("só administração analisa", () => {
    for (const actor of [student, teacher, null]) {
      expect(() =>
        reviewClaim({ actor, item, itemClaims: [a], claimId: "a", decision: "accept", now: NOW }),
      ).toThrowError(expect.objectContaining({ code: actor ? "FORBIDDEN" : "UNAUTHENTICATED" }));
    }
  });

  it("id inexistente → NOT_FOUND", () => {
    expect(() =>
      reviewClaim({ actor: admin, item, itemClaims: [a], claimId: "zzz", decision: "accept", now: NOW }),
    ).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("item Devolvido não aceita análise", () => {
    expect(canReviewClaim(admin, makeItem({ status: "returned" }), a)).toMatchObject({
      allowed: false,
      code: "ITEM_RETURNED",
    });
  });

  it("não muta as entradas", () => {
    const claims = [a, b];
    const snapshot = JSON.stringify({ item, claims });
    reviewClaim({ actor: admin, item, itemClaims: claims, claimId: "a", decision: "accept", now: NOW });
    expect(JSON.stringify({ item, claims })).toBe(snapshot);
  });
});

describe("canViewClaim (S1)", () => {
  const claim = makeClaim({ claimantId: student.id });
  it("administração e o próprio autor veem", () => {
    expect(canViewClaim(admin, claim)).toEqual({ allowed: true });
    expect(canViewClaim(student, claim)).toEqual({ allowed: true });
  });
  it("outros usuários não veem; visitante é UNAUTHENTICATED", () => {
    expect(canViewClaim(otherStudent, claim)).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(canViewClaim(teacher, claim)).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(canViewClaim(null, claim)).toMatchObject({ allowed: false, code: "UNAUTHENTICATED" });
  });
});
