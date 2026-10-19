import { describe, expect, it } from "vitest";
import { DEMO_CATEGORIES, DEMO_LOCATIONS } from "@/types/catalog";
import { addDays, toLocalDateString } from "@/lib/rules/dates";
import { isActiveClaim } from "@/lib/rules";
import { buildSeed, DEMO_DATA_NOTICE } from "./seed";
import { TEST_NOW } from "./test-utils";

describe("seed", () => {
  const db = buildSeed(TEST_NOW);

  it("é reproduzível para a mesma data", () => {
    expect(buildSeed(TEST_NOW)).toEqual(db);
  });

  it("tem ~10 itens cobrindo os três status", () => {
    expect(db.items.length).toBeGreaterThanOrEqual(10);
    expect(new Set(db.items.map((i) => i.status))).toEqual(new Set(["available", "under_claim", "returned"]));
  });

  it("tem reivindicações pendentes, aceitas e recusadas", () => {
    expect(new Set(db.claims.map((c) => c.status))).toEqual(new Set(["pending", "accepted", "rejected"]));
  });

  it("tem os 3 perfis de demonstração com e-mail @demo.test", () => {
    for (const role of ["student", "teacher", "admin"] as const) {
      expect(db.users.filter((u) => u.role === role && u.email.endsWith("@demo.test")).length).toBeGreaterThan(0);
    }
    expect(db.users.every((u) => u.email.endsWith("@demo.test"))).toBe(true);
  });

  it("datas são relativas a hoje e nunca futuras", () => {
    const today = toLocalDateString(TEST_NOW);
    const earliest = toLocalDateString(addDays(TEST_NOW, -30));
    for (const item of db.items) {
      expect(item.foundDate <= today).toBe(true);
      expect(item.foundDate >= earliest).toBe(true);
      expect(new Date(item.createdAt).getTime()).toBeLessThanOrEqual(TEST_NOW.getTime());
    }
    const shifted = buildSeed(addDays(TEST_NOW, 10));
    expect(shifted.items[0].foundDate).not.toBe(db.items[0].foundDate);
  });

  it("categorias e locais pertencem às listas demonstrativas", () => {
    for (const item of db.items) {
      expect(DEMO_CATEGORIES).toContain(item.category);
      expect(DEMO_LOCATIONS).toContain(item.foundLocation);
    }
  });

  it("textos usam só locais do catálogo demonstrativo e há aviso de dados fictícios (S6)", () => {
    expect(DEMO_DATA_NOTICE).toMatch(/fictícios/);
    for (const item of db.items) {
      expect([...DEMO_LOCATIONS, "Entregue ao dono"]).toContain(item.storedAt);
    }
    const text = db.claims.map((c) => `${c.proofDetails} ${c.lostWhereWhen}`).join(" ");
    expect(text).not.toMatch(/\bsala\b|\bmesa\b|laborat|corredor/i);
  });

  it("é consistente com a máquina de estados", () => {
    for (const item of db.items) {
      const claims = db.claims.filter((c) => c.itemId === item.id);
      const ret = db.returns.find((r) => r.itemId === item.id);
      if (item.status === "available") expect(claims.some(isActiveClaim)).toBe(false);
      if (item.status === "under_claim") expect(claims.some(isActiveClaim)).toBe(true);
      if (item.status === "returned") {
        expect(ret).toBeDefined();
        expect(claims.filter((c) => c.status === "accepted")).toHaveLength(1);
        expect(ret!.claimId).toBe(claims.find((c) => c.status === "accepted")!.id);
      } else {
        expect(ret).toBeUndefined();
      }
      expect(claims.filter((c) => c.status === "accepted").length).toBeLessThanOrEqual(1);
      if (claims.some((c) => c.status === "accepted")) expect(claims.some((c) => c.status === "pending")).toBe(false);
      // no máximo uma reivindicação ativa por usuário e item
      const active = claims.filter(isActiveClaim).map((c) => c.claimantId);
      expect(new Set(active).size).toBe(active.length);
    }
  });

  it("referências apontam para registros existentes", () => {
    const userIds = new Set(db.users.map((u) => u.id));
    const itemIds = new Set(db.items.map((i) => i.id));
    const claimIds = new Set(db.claims.map((c) => c.id));
    expect(db.items.every((i) => userIds.has(i.createdById))).toBe(true);
    expect(db.claims.every((c) => userIds.has(c.claimantId) && itemIds.has(c.itemId))).toBe(true);
    expect(db.returns.every((r) => claimIds.has(r.claimId) && itemIds.has(r.itemId) && userIds.has(r.returnedToId) && userIds.has(r.registeredById))).toBe(true);
    expect(new Set(db.items.map((i) => i.id)).size).toBe(db.items.length);
  });
});
