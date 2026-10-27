import { describe, expect, it } from "vitest";
import type { ClaimView } from "@/services";
import type { Item, User } from "@/types/domain";
import { summarizeAwaitingReturn } from "./awaiting-return";

const user: User = { id: "u1", name: "Pessoa", email: "p@demo.test", role: "user", affiliation: "institutional", emailVerified: true };

function makeItem(id: string, status: Item["status"] = "under_claim"): Item {
  return {
    id,
    title: id,
    description: "Descrição de teste",
    category: "Outros",
    categoryOther: "Item diverso",
    foundLocation: "Portaria",
    foundDate: "2026-10-10",
    storedAt: "Portaria",
    status,
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

describe("summarizeAwaitingReturn", () => {
  it("omite item que só tem reivindicações pendentes", () => {
    const a = makeItem("a");
    expect(summarizeAwaitingReturn([a], [[makeClaim("a1", a, "pending", "2026-10-11T10:00:00.000Z")]])).toEqual([]);
  });

  it("inclui item com aceita mesmo com outras recusadas", () => {
    const b = makeItem("b");
    const result = summarizeAwaitingReturn(
      [b],
      [
        [
          makeClaim("b2", b, "rejected", "2026-10-12T11:00:00.000Z", "2026-10-13T10:00:00.000Z"),
          makeClaim("b1", b, "accepted", "2026-10-12T10:00:00.000Z", "2026-10-13T10:00:00.000Z"),
        ],
      ],
    );
    expect(result).toHaveLength(1);
    expect(result[0].item.id).toBe("b");
    expect(result[0].accepted.id).toBe("b1");
  });

  it("omite item já devolvido, mesmo com reivindicação aceita", () => {
    const c = makeItem("c", "returned");
    const claim = makeClaim("c1", c, "accepted", "2026-10-12T10:00:00.000Z", "2026-10-13T10:00:00.000Z");
    expect(summarizeAwaitingReturn([c], [[claim]])).toEqual([]);
  });

  it("ordena pela aceitação mais antiga primeiro, em vários itens", () => {
    const a = makeItem("a");
    const b = makeItem("b");
    const c = makeItem("c");
    const result = summarizeAwaitingReturn(
      [a, b, c],
      [
        [makeClaim("a1", a, "accepted", "2026-10-01T10:00:00.000Z", "2026-10-20T10:00:00.000Z")],
        [makeClaim("b1", b, "accepted", "2026-10-15T10:00:00.000Z", "2026-10-16T10:00:00.000Z")],
        [makeClaim("c1", c, "pending", "2026-10-02T10:00:00.000Z")],
      ],
    );
    expect(result.map((r) => r.item.id)).toEqual(["b", "a"]);
  });

  it("devolve lista vazia sem itens ou sem reivindicações", () => {
    const a = makeItem("a");
    expect(summarizeAwaitingReturn([], [])).toEqual([]);
    expect(summarizeAwaitingReturn([a], [])).toEqual([]);
    expect(summarizeAwaitingReturn([a], [[makeClaim("a1", a, "rejected", "2026-10-14T10:00:00.000Z")]])).toEqual([]);
  });
});
