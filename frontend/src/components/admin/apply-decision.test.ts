import { describe, expect, it } from "vitest";
import { reviewClaim } from "@/lib/rules";
import { admin, makeClaim, makeItem, NOW, otherStudent, student } from "@/lib/rules/test-fixtures";
import type { ClaimDecisionResult, ClaimView, ItemDetail } from "@/services";
import { applyDecision, type ReviewState } from "./apply-decision";

const item = makeItem({ status: "under_claim" });
const mine = makeClaim({ id: "c1", itemId: item.id, claimantId: student.id });
const theirs = makeClaim({ id: "c2", itemId: item.id, claimantId: otherStudent.id });

function stateOf(claims: ReturnType<typeof makeClaim>[], reviewing: string): ReviewState {
  const withClaimant = claims.map((c) => ({ ...c, claimant: c.claimantId === student.id ? student : otherStudent }));
  const claim = withClaimant.find((c) => c.id === reviewing)!;
  const detail: ItemDetail = {
    item,
    createdBy: { id: admin.id, name: admin.name, role: admin.role },
    myClaims: [],
    claims: withClaimant,
    returnRecord: null,
    viewer: {
      claim: { allowed: false, code: "FORBIDDEN", message: "x" },
      edit: { allowed: true },
      delete: { allowed: true },
      registerReturn: { allowed: false, code: "INVALID_TRANSITION", message: "Aceite uma reivindicação antes." },
    },
  };
  return { claim: { ...claim, item } as ClaimView, detail };
}

function decide(state: ReviewState, decision: "accept" | "reject"): ClaimDecisionResult {
  const result = reviewClaim({
    actor: admin,
    item: state.detail.item,
    itemClaims: state.detail.claims,
    claimId: state.claim.id,
    decision,
    now: NOW,
  });
  return { claim: result.claim, item: result.item, autoRejectedIds: result.autoRejectedIds };
}

describe("applyDecision", () => {
  it("aceitar: a reivindicação vira Aceita, as outras pendentes ficam Recusadas e a devolução fica liberada", () => {
    const before = stateOf([mine, theirs], "c1");
    const after = applyDecision(admin, before, decide(before, "accept"));

    expect(after.claim.status).toBe("accepted");
    expect(after.claim.claimant.name).toBe(student.name); // mantém o reivindicante
    expect(after.detail.claims.map((c) => [c.id, c.status])).toEqual([
      ["c1", "accepted"],
      ["c2", "rejected"],
    ]);
    expect(after.detail.item.status).toBe("under_claim");
    expect(after.detail.viewer.registerReturn.allowed).toBe(true);
    expect(after.detail.viewer.edit.allowed).toBe(true);
  });

  it("recusar a última ativa: o item volta a Disponível e a devolução continua bloqueada", () => {
    const before = stateOf([mine], "c1");
    const after = applyDecision(admin, before, decide(before, "reject"));

    expect(after.claim.status).toBe("rejected");
    expect(after.claim.item.status).toBe("available");
    expect(after.detail.item.status).toBe("available");
    expect(after.detail.viewer.registerReturn.allowed).toBe(false);
  });

  it("recusar com outra pendente: o item continua Em reivindicação", () => {
    const before = stateOf([mine, theirs], "c1");
    const after = applyDecision(admin, before, decide(before, "reject"));

    expect(after.detail.item.status).toBe("under_claim");
    expect(after.detail.claims.map((c) => c.status)).toEqual(["rejected", "pending"]);
  });

  it("não altera o estado de entrada", () => {
    const before = stateOf([mine, theirs], "c1");
    applyDecision(admin, before, decide(before, "accept"));
    expect(before.claim.status).toBe("pending");
    expect(before.detail.claims.every((c) => c.status === "pending")).toBe(true);
  });
});
