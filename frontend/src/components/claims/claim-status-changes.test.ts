import { describe, expect, it } from "vitest";
import { describeStatusChanges, snapshotStatuses, snapshotsEqual } from "./claim-status-changes";
import type { ClaimStatus } from "@/types/domain";

const claim = (id: string, status: ClaimStatus, title = `Item ${id}`) => ({ id, status, item: { title } });

describe("mudanças de status das reivindicações (AC04.8)", () => {
  it("sem mudança: nada a anunciar", () => {
    const claims = [claim("a", "pending"), claim("b", "rejected")];
    expect(describeStatusChanges(snapshotStatuses(claims), claims)).toBeNull();
  });

  it("anuncia o novo status com o título do item", () => {
    const before = snapshotStatuses([claim("a", "pending", "Chaveiro")]);
    expect(describeStatusChanges(before, [claim("a", "accepted", "Chaveiro")])).toBe(
      "Status atualizado: Aceita (Chaveiro).",
    );
  });

  it("junta várias mudanças em uma única frase", () => {
    const before = snapshotStatuses([claim("a", "pending", "Chaveiro"), claim("b", "pending", "Notebook")]);
    const now = [claim("a", "accepted", "Chaveiro"), claim("b", "rejected", "Notebook")];
    expect(describeStatusChanges(before, now)).toBe("Status atualizado: Aceita (Chaveiro); Recusada (Notebook).");
  });

  it("reivindicação nova (não estava na leitura anterior) não é anúncio de mudança", () => {
    const before = snapshotStatuses([claim("a", "pending")]);
    expect(describeStatusChanges(before, [claim("a", "pending"), claim("b", "pending")])).toBeNull();
  });

  it("compara instantâneos", () => {
    expect(snapshotsEqual({ a: "pending" }, { a: "pending" })).toBe(true);
    expect(snapshotsEqual({ a: "pending" }, { a: "accepted" })).toBe(false);
    expect(snapshotsEqual({ a: "pending" }, { a: "pending", b: "pending" })).toBe(false);
  });
});
