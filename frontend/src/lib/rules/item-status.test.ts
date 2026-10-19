import { describe, expect, it } from "vitest";
import { ITEM_STATUSES, ServiceError } from "@/types/domain";
import { assertTransition, canTransition, isItemLocked } from "./item-status";

describe("máquina de estados do item (SPEC §4)", () => {
  const allowed = new Set(["available>under_claim", "under_claim>returned", "under_claim>available"]);

  it.each(ITEM_STATUSES.flatMap((from) => ITEM_STATUSES.map((to) => [from, to] as const)))(
    "%s → %s",
    (from, to) => {
      expect(canTransition(from, to)).toBe(allowed.has(`${from}>${to}`));
    },
  );

  it("Disponível não vai direto para Devolvido", () => {
    expect(() => assertTransition("available", "returned")).toThrowError(
      expect.objectContaining({ code: "INVALID_TRANSITION" }),
    );
  });

  it("Devolvido é terminal e tem erro próprio", () => {
    expect(() => assertTransition("returned", "available")).toThrowError(ServiceError);
    expect(() => assertTransition("returned", "under_claim")).toThrowError(
      expect.objectContaining({ code: "ITEM_RETURNED" }),
    );
    expect(isItemLocked("returned")).toBe(true);
    expect(isItemLocked("under_claim")).toBe(false);
  });
});
