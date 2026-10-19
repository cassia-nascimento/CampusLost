import { describe, expect, it } from "vitest";
import { canDeleteItem, canEditItem, canRegisterItem, filterItems, searchItems, sortItems } from "./items";
import { admin, makeItem, student, teacher } from "./test-fixtures";

describe("permissões de item (AC06.1, P10)", () => {
  it("só administração edita e exclui", () => {
    for (const status of ["available", "under_claim"] as const) {
      const item = makeItem({ status });
      expect(canEditItem(admin, item)).toEqual({ allowed: true });
      expect(canDeleteItem(admin, item)).toEqual({ allowed: true });
      for (const actor of [student, teacher]) {
        expect(canEditItem(actor, item)).toMatchObject({ allowed: false, code: "FORBIDDEN" });
        expect(canDeleteItem(actor, item)).toMatchObject({ allowed: false, code: "FORBIDDEN" });
      }
    }
    expect(canEditItem(null, makeItem())).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("item Devolvido não é editável nem excluível, nem pela administração", () => {
    const item = makeItem({ status: "returned" });
    expect(canEditItem(admin, item)).toMatchObject({ allowed: false, code: "ITEM_RETURNED" });
    expect(canDeleteItem(admin, item)).toMatchObject({ allowed: false, code: "ITEM_RETURNED" });
  });

  it("qualquer usuário logado registra item (AC02.1)", () => {
    for (const actor of [student, teacher, admin]) {
      expect(canRegisterItem(actor)).toEqual({ allowed: true });
    }
    expect(canRegisterItem(null)).toMatchObject({ allowed: false, code: "UNAUTHENTICATED" });
  });
});

describe("filtros e ordenação da busca (AC03.x)", () => {
  const items = [
    makeItem({ id: "1", category: "Eletrônicos", foundLocation: "Biblioteca", foundDate: "2026-10-10", createdAt: "2026-10-10T10:00:00.000Z" }),
    makeItem({ id: "2", category: "Eletrônicos", foundLocation: "Bloco A", foundDate: "2026-10-15", createdAt: "2026-10-15T10:00:00.000Z", status: "under_claim" }),
    makeItem({ id: "3", category: "Chaves", foundLocation: "Biblioteca", foundDate: "2026-10-12", createdAt: "2026-10-12T10:00:00.000Z" }),
    makeItem({ id: "4", category: "Chaves", foundLocation: "Biblioteca", foundDate: "2026-10-17", createdAt: "2026-10-17T10:00:00.000Z", status: "returned" }),
  ];
  const ids = (list: { id: string }[]) => list.map((i) => i.id);

  it("itens Devolvidos nunca aparecem; Em reivindicação aparecem (AC03.2)", () => {
    expect(ids(filterItems(items))).toEqual(["1", "2", "3"]);
  });

  it("filtros combinam entre si (AC03.3)", () => {
    expect(ids(filterItems(items, { category: "Eletrônicos" }))).toEqual(["1", "2"]);
    expect(ids(filterItems(items, { location: "Biblioteca" }))).toEqual(["1", "3"]);
    expect(ids(filterItems(items, { category: "Eletrônicos", location: "Biblioteca" }))).toEqual(["1"]);
    expect(ids(filterItems(items, { from: "2026-10-11", to: "2026-10-14" }))).toEqual(["3"]);
    expect(ids(filterItems(items, { category: "Chaves", location: "Biblioteca", from: "2026-10-13" }))).toEqual([]);
  });

  it("período é inclusivo nas duas pontas e usa a data em que foi encontrado (P11)", () => {
    expect(ids(filterItems(items, { from: "2026-10-12", to: "2026-10-15" }))).toEqual(["2", "3"]);
  });

  it("filtro por status", () => {
    expect(ids(filterItems(items, { status: "under_claim" }))).toEqual(["2"]);
  });

  it("mais recentes primeiro (AC03.4)", () => {
    expect(ids(searchItems(items))).toEqual(["2", "3", "1"]);
  });

  it("ordenação alternativa por data encontrada e desempate estável", () => {
    expect(ids(sortItems(items, "found"))).toEqual(["4", "2", "3", "1"]);
    const tie = [makeItem({ id: "b" }), makeItem({ id: "a" })];
    expect(ids(sortItems(tie))).toEqual(["a", "b"]);
  });

  it("não muta o array original", () => {
    const copy = [...items];
    sortItems(items);
    expect(items).toEqual(copy);
  });
});
