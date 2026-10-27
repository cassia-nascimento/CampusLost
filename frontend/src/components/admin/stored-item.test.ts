import { describe, expect, it } from "vitest";
import { makeItem } from "@/lib/rules/test-fixtures";
import { toStoredItem } from "./stored-item";

describe("toStoredItem", () => {
  it("mantém o local de guarda quando existe", () => {
    const item = makeItem({ storedAt: "Portaria" });
    expect(toStoredItem(item)).toEqual(item);
  });

  it("mantém o autor quando existe", () => {
    const item = makeItem({ createdById: "user-9" });
    expect(toStoredItem(item).createdById).toBe("user-9");
  });

  it("não inventa o local de guarda: ausente continua ausente e null continua null", () => {
    const { storedAt: _storedAt, createdById: _createdById, ...view } = makeItem();
    void _storedAt;
    void _createdById;
    const withoutPermission = toStoredItem(view);
    expect("storedAt" in withoutPermission).toBe(false);
    expect(withoutPermission.createdById).toBe("");
    expect(toStoredItem(makeItem({ storedAt: null })).storedAt).toBeNull();
  });
});
