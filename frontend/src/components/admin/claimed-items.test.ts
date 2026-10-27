import { describe, expect, it } from "vitest";
import type { ClaimView } from "@/services";
import type { Item, User } from "@/types/domain";
import { summarizeClaimedItems } from "./claimed-items";

const user: User = { id: "u1", name: "Pessoa", email: "p@demo.test", role: "user", affiliation: "institutional", emailVerified: true };

function makeItem(id: string): Item {
  return {
    id,
    title: id,
    description: "Descrição de teste",
    category: "Outros",
    foundLocation: "Portaria",
    foundDate: "2026-10-10",
    storedAt: "Portaria",
    status: "under_claim",
    createdById: "u1",
    createdAt: "2026-10-10T10:00:00.000Z",
  };
}

function makeClaim(
  id: string,
  item: Item,
  status: ClaimView["status"],
  createdAt: string,
  reviewedAt?: string,
): ClaimView {
  return {
    id,
    itemId: item.id,
    claimantId: user.id,
    proofDetails: "x",
    lostWhereWhen: "y",
    status,
    createdAt,
    ...(reviewedAt ? { reviewedAt } : {}),
    claimant: user,
    item,
  };
}

describe("summarizeClaimedItems", () => {
  it("coloca primeiro o item com reivindicação aceita e depois os que só têm pendentes", () => {
    const a = makeItem("a");
    const b = makeItem("b");
    const result = summarizeClaimedItems(
      [a, b],
      [
        [makeClaim("a1", a, "pending", "2026-10-11T10:00:00.000Z")],
        [
          makeClaim("b1", b, "accepted", "2026-10-12T10:00:00.000Z", "2026-10-13T10:00:00.000Z"),
          makeClaim("b2", b, "rejected", "2026-10-12T11:00:00.000Z", "2026-10-13T10:00:00.000Z"),
        ],
      ],
    );
    expect(result.map((r) => r.item.id)).toEqual(["b", "a"]);
    expect(result[0].accepted?.id).toBe("b1");
    expect(result[0].reviewClaimId).toBe("b1");
    expect(result[0].pendingCount).toBe(0);
  });

  it("conta pendentes e aponta a mais antiga; ordena a espera mais antiga primeiro", () => {
    const a = makeItem("a");
    const b = makeItem("b");
    const result = summarizeClaimedItems(
      [a, b],
      [
        [
          makeClaim("a2", a, "pending", "2026-10-15T10:00:00.000Z"),
          makeClaim("a1", a, "pending", "2026-10-14T10:00:00.000Z"),
        ],
        [makeClaim("b1", b, "pending", "2026-10-12T10:00:00.000Z")],
      ],
    );
    expect(result.map((r) => r.item.id)).toEqual(["b", "a"]);
    expect(result[1].pendingCount).toBe(2);
    expect(result[1].reviewClaimId).toBe("a1");
  });

  it("omite itens sem reivindicação ativa", () => {
    const a = makeItem("a");
    expect(summarizeClaimedItems([a], [[makeClaim("a1", a, "rejected", "2026-10-14T10:00:00.000Z")]])).toEqual([]);
    expect(summarizeClaimedItems([a], [])).toEqual([]);
  });
});
