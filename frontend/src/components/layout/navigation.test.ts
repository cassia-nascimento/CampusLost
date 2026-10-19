import { describe, expect, it } from "vitest";
import {
  getActiveHref,
  getBottomNavItems,
  getHeaderNavItems,
  getRouteChrome,
  showsBottomNav,
} from "./navigation";

describe("itens de navegação por perfil", () => {
  it("aluno e professor: Itens, Registrar, Reivindicações", () => {
    for (const role of ["student", "teacher"] as const) {
      expect(getBottomNavItems(role).map((i) => i.href)).toEqual([
        "/itens",
        "/itens/novo",
        "/minhas-reivindicacoes",
      ]);
    }
  });

  it("administração: Painel, Itens, Registrar, Devoluções (sem Minhas reivindicações)", () => {
    const hrefs = getBottomNavItems("admin").map((i) => i.href);
    expect(hrefs).toEqual(["/admin", "/itens", "/itens/novo", "/admin/devolucoes"]);
    expect(hrefs).not.toContain("/minhas-reivindicacoes");
  });

  it("header desktop não repete Registrar (é botão)", () => {
    expect(getHeaderNavItems("student").map((i) => i.href)).toEqual(["/itens", "/minhas-reivindicacoes"]);
    expect(getHeaderNavItems("admin").map((i) => i.href)).toEqual(["/admin", "/itens", "/admin/devolucoes"]);
  });

  it("Minhas reivindicações tem rótulo completo para leitor de tela", () => {
    const item = getBottomNavItems("student").find((i) => i.href === "/minhas-reivindicacoes");
    expect(item?.fullLabel).toBe("Minhas reivindicações");
  });
});

describe("item ativo", () => {
  it("escolhe o href mais específico", () => {
    expect(getActiveHref("student", "/itens")).toBe("/itens");
    expect(getActiveHref("student", "/itens/abc")).toBe("/itens");
    expect(getActiveHref("student", "/itens/novo")).toBe("/itens/novo");
    expect(getActiveHref("admin", "/admin")).toBe("/admin");
    expect(getActiveHref("admin", "/admin/devolucoes")).toBe("/admin/devolucoes");
    expect(getActiveHref("admin", "/admin/reivindicacoes/x")).toBe("/admin");
  });

  it("sem correspondência, nenhum ativo", () => {
    expect(getActiveHref("student", "/outra")).toBeNull();
  });
});

describe("cromo por rota", () => {
  it("páginas de topo", () => {
    for (const path of ["/itens", "/minhas-reivindicacoes", "/admin", "/admin/devolucoes"]) {
      expect(getRouteChrome(path)).toEqual({ kind: "top" });
      expect(showsBottomNav(path)).toBe(true);
    }
  });

  it("detalhe e formulários: título e voltar", () => {
    expect(getRouteChrome("/itens/novo")).toEqual({ kind: "detail", title: "Registrar item", backHref: "/itens" });
    expect(getRouteChrome("/itens/i1")).toEqual({ kind: "detail", title: "Detalhe do item", backHref: "/itens" });
    expect(getRouteChrome("/itens/i1/reivindicar")).toEqual({
      kind: "detail",
      title: "Reivindicar item",
      backHref: "/itens/i1",
    });
    expect(getRouteChrome("/admin/reivindicacoes/c1")).toEqual({
      kind: "detail",
      title: "Analisar reivindicação",
      backHref: "/admin",
    });
    expect(getRouteChrome("/admin/itens/i1/editar")).toEqual({
      kind: "detail",
      title: "Editar item",
      backHref: "/itens/i1",
    });
    expect(showsBottomNav("/itens/novo")).toBe(false);
    expect(showsBottomNav("/itens/i1")).toBe(false);
  });

  it("voltar do detalhe e do registro reabre a última busca; as demais rotas ignoram", () => {
    const search = "?categoria=Chaves&de=2026-10-01";
    expect(getRouteChrome("/itens/i1", search)).toMatchObject({ backHref: `/itens${search}` });
    expect(getRouteChrome("/itens/novo", search)).toMatchObject({ backHref: `/itens${search}` });
    expect(getRouteChrome("/itens/i1/reivindicar", search)).toMatchObject({ backHref: "/itens/i1" });
    expect(getRouteChrome("/admin/itens/i1/editar", search)).toMatchObject({ backHref: "/itens/i1" });
    expect(getRouteChrome("/itens/i1", "")).toMatchObject({ backHref: "/itens" });
  });
});
