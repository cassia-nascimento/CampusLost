import { describe, expect, it } from "vitest";
import {
  ADMIN_SECTIONS,
  getActiveHref,
  getBottomNavItems,
  getHeaderNavItems,
  getRouteChrome,
  parseOrigin,
  showsBottomNav,
  withOrigin,
} from "./navigation";

describe("itens de navegação por perfil", () => {
  it("usuário: Itens, Registrar, Reivindicações", () => {
    expect(getBottomNavItems("user").map((i) => i.href)).toEqual(["/itens", "/itens/novo", "/minhas-reivindicacoes"]);
  });

  it("administração: Painel, Itens, Registrar, Devoluções (sem Minhas reivindicações)", () => {
    const hrefs = getBottomNavItems("admin").map((i) => i.href);
    expect(hrefs).toEqual(["/admin", "/itens", "/itens/novo", "/admin/devolucoes"]);
    expect(hrefs).not.toContain("/minhas-reivindicacoes");
  });

  it("header desktop não repete Registrar (é botão)", () => {
    expect(getHeaderNavItems("user").map((i) => i.href)).toEqual(["/itens", "/minhas-reivindicacoes"]);
    expect(getHeaderNavItems("admin").map((i) => i.href)).toEqual(["/admin", "/itens", "/admin/devolucoes"]);
  });

  it("Minhas reivindicações tem rótulo completo para leitor de tela", () => {
    const item = getBottomNavItems("user").find((i) => i.href === "/minhas-reivindicacoes");
    expect(item?.fullLabel).toBe("Minhas reivindicações");
  });
});

describe("item ativo", () => {
  it("escolhe o href mais específico", () => {
    expect(getActiveHref("user", "/itens")).toBe("/itens");
    expect(getActiveHref("user", "/itens/abc")).toBe("/itens");
    expect(getActiveHref("user", "/itens/novo")).toBe("/itens/novo");
    expect(getActiveHref("admin", "/admin")).toBe("/admin");
    expect(getActiveHref("admin", "/admin/devolucoes")).toBe("/admin/devolucoes");
    expect(getActiveHref("admin", "/admin/reivindicacoes/x")).toBe("/admin");
    // As seções de gestão não têm item próprio na navegação: o Painel continua ativo.
    expect(getActiveHref("admin", "/admin/usuarios")).toBe("/admin");
  });

  it("sem correspondência, nenhum ativo", () => {
    expect(getActiveHref("user", "/outra")).toBeNull();
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
    expect(getRouteChrome("/itens/novo")).toEqual({ kind: "detail", title: "Registrar item", backHref: "/itens", backLabel: "Voltar aos itens" });
    expect(getRouteChrome("/itens/i1")).toEqual({ kind: "detail", title: "Detalhe do item", backHref: "/itens", backLabel: "Voltar aos itens" });
    expect(getRouteChrome("/itens/i1/reivindicar")).toEqual({
      kind: "detail",
      title: "Reivindicar item",
      backHref: "/itens/i1",
      backLabel: "Voltar ao item",
    });
    expect(getRouteChrome("/admin/reivindicacoes/c1")).toEqual({
      kind: "detail",
      title: "Analisar reivindicação",
      backHref: "/admin",
      backLabel: "Voltar ao painel",
    });
    expect(getRouteChrome("/admin/itens/i1/editar")).toEqual({
      kind: "detail",
      title: "Editar item",
      backHref: "/itens/i1",
      backLabel: "Voltar ao item",
    });
    expect(showsBottomNav("/itens/novo")).toBe(false);
    expect(showsBottomNav("/itens/i1")).toBe(false);
  });

  it("seções de gestão da administração: título e voltar ao painel, sem BottomNav", () => {
    const titles: Record<string, string> = {
      "/admin/usuarios": "Usuários",
      "/admin/convites": "Convites",
      "/admin/auditoria": "Auditoria",
    };
    for (const [path, title] of Object.entries(titles)) {
      expect(getRouteChrome(path, "?categoria=Chaves")).toEqual({ kind: "detail", title, backHref: "/admin", backLabel: "Voltar ao painel" });
      expect(showsBottomNav(path)).toBe(false);
    }
  });

  it("minha conta e privacidade: voltar para os itens, sem BottomNav", () => {
    expect(getRouteChrome("/conta")).toEqual({ kind: "detail", title: "Minha conta", backHref: "/itens", backLabel: "Voltar aos itens" });
    expect(getRouteChrome("/privacidade")).toEqual({ kind: "detail", title: "Privacidade", backHref: "/itens", backLabel: "Voltar aos itens" });
    expect(showsBottomNav("/conta")).toBe(false);
    expect(showsBottomNav("/privacidade")).toBe(false);
    expect(getRouteChrome("/termos")).toEqual({ kind: "detail", title: "Termos de uso", backHref: "/itens", backLabel: "Voltar aos itens" });
    expect(showsBottomNav("/termos")).toBe(false);
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

describe("página de origem (?de=) no voltar", () => {
  it("withOrigin codifica o caminho e parseOrigin o devolve", () => {
    const href = withOrigin("/itens/i1", "/minhas-reivindicacoes");
    expect(href).toBe("/itens/i1?de=%2Fminhas-reivindicacoes");
    const raw = new URL(href, "http://x").searchParams.get("de");
    expect(parseOrigin(raw)).toBe("/minhas-reivindicacoes");
  });

  it("parseOrigin só aceita caminhos do app permitidos", () => {
    for (const ok of ["/minhas-reivindicacoes", "/admin/devolucoes", "/admin/reivindicacoes/claim-01", "/itens/item-04"]) {
      expect(parseOrigin(ok)).toBe(ok);
    }
    for (const bad of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "javascript:alert(1)",
      "/admin",
      "/admin/itens/i1/editar",
      "/itens/novo",
      "/itens/i1/reivindicar",
      "/itens/i1/../x",
      "/minhas-reivindicacoes?x=1",
      "/minhas-reivindicacoes/",
      "",
      null,
      undefined,
    ]) {
      expect(parseOrigin(bad)).toBeNull();
    }
  });

  it("detalhe do item: Minhas reivindicações / Devoluções / Análise → voltar à origem", () => {
    const search = "?categoria=Chaves";
    expect(getRouteChrome("/itens/i1", search, "/minhas-reivindicacoes")).toMatchObject({
      backHref: "/minhas-reivindicacoes",
    });
    expect(getRouteChrome("/itens/i1", search, "/admin/devolucoes")).toMatchObject({ backHref: "/admin/devolucoes" });
    expect(getRouteChrome("/itens/i1", "", "/admin/reivindicacoes/c1")).toMatchObject({
      backHref: "/admin/reivindicacoes/c1",
    });
  });

  it("detalhe do item sem origem (ou com origem inválida) reabre a última busca", () => {
    const search = "?local=Portaria";
    expect(getRouteChrome("/itens/i1", search)).toMatchObject({ backHref: `/itens${search}` });
    expect(getRouteChrome("/itens/i1", search, null)).toMatchObject({ backHref: `/itens${search}` });
    expect(getRouteChrome("/itens/i1", search, "https://evil.test")).toMatchObject({ backHref: `/itens${search}` });
    expect(getRouteChrome("/itens/i1", search, "/itens/outro")).toMatchObject({ backHref: `/itens${search}` });
  });

  it("análise: vinda do item, voltar ao item; sem origem, ao painel", () => {
    expect(getRouteChrome("/admin/reivindicacoes/c1", "", "/itens/i1")).toMatchObject({ backHref: "/itens/i1" });
    expect(getRouteChrome("/admin/reivindicacoes/c1")).toMatchObject({ backHref: "/admin" });
    expect(getRouteChrome("/admin/reivindicacoes/c1", "", "/admin/devolucoes")).toMatchObject({ backHref: "/admin" });
    expect(getRouteChrome("/admin/reivindicacoes/c1", "", "//evil.test")).toMatchObject({ backHref: "/admin" });
  });

  it("registrar, reivindicar e editar ignoram a origem", () => {
    expect(getRouteChrome("/itens/novo", "", "/minhas-reivindicacoes")).toMatchObject({ backHref: "/itens" });
    expect(getRouteChrome("/itens/i1/reivindicar", "", "/minhas-reivindicacoes")).toMatchObject({ backHref: "/itens/i1" });
    expect(getRouteChrome("/admin/itens/i1/editar", "", "/admin/devolucoes")).toMatchObject({ backHref: "/itens/i1" });
  });
});

describe("rótulo do voltar (backLabel) acompanha o destino", () => {
  const label = (path: string, search = "", origin: string | null = null) => {
    const chrome = getRouteChrome(path, search, origin);
    return chrome.kind === "detail" ? { href: chrome.backHref, label: chrome.backLabel } : null;
  };

  it("detalhe do item: um rótulo por origem", () => {
    expect(label("/itens/i1", "", "/minhas-reivindicacoes")).toEqual({
      href: "/minhas-reivindicacoes",
      label: "Voltar às minhas reivindicações",
    });
    expect(label("/itens/i1", "", "/admin/devolucoes")).toEqual({ href: "/admin/devolucoes", label: "Voltar às devoluções" });
    expect(label("/itens/i1", "", "/admin/reivindicacoes/c1")).toEqual({
      href: "/admin/reivindicacoes/c1",
      label: "Voltar à análise",
    });
  });

  it("detalhe do item sem origem válida: lista de itens com a busca preservada", () => {
    const search = "?categoria=Chaves&pagina=2";
    expect(label("/itens/i1", search)).toEqual({ href: `/itens${search}`, label: "Voltar aos itens" });
    expect(label("/itens/i1", search, "//evil.test")).toEqual({ href: `/itens${search}`, label: "Voltar aos itens" });
    expect(label("/itens/novo", search)).toEqual({ href: `/itens${search}`, label: "Voltar aos itens" });
  });

  it("análise: do item volta ao item; abertura direta ou origem não aceita, ao painel", () => {
    expect(label("/admin/reivindicacoes/c1", "", "/itens/i1")).toEqual({ href: "/itens/i1", label: "Voltar ao item" });
    expect(label("/admin/reivindicacoes/c1")).toEqual({ href: "/admin", label: "Voltar ao painel" });
    expect(label("/admin/reivindicacoes/c1", "", "/minhas-reivindicacoes")).toEqual({
      href: "/admin",
      label: "Voltar ao painel",
    });
  });

  it("reivindicar e editar voltam ao item; gestão ao painel; conta e textos legais aos itens", () => {
    expect(label("/itens/i1/reivindicar")).toEqual({ href: "/itens/i1", label: "Voltar ao item" });
    expect(label("/admin/itens/i1/editar")).toEqual({ href: "/itens/i1", label: "Voltar ao item" });
    for (const path of ["/admin/usuarios", "/admin/convites", "/admin/auditoria"]) {
      expect(label(path)).toEqual({ href: "/admin", label: "Voltar ao painel" });
    }
    for (const path of ["/conta", "/privacidade", "/termos"]) {
      expect(label(path, "?categoria=Chaves")).toEqual({ href: "/itens", label: "Voltar aos itens" });
    }
  });

  it("páginas de topo não têm voltar", () => {
    for (const path of ["/itens", "/minhas-reivindicacoes", "/admin", "/admin/devolucoes"]) {
      expect(label(path)).toBeNull();
    }
  });

  it("toda rota de detalhe tem rótulo não vazio que começa com Voltar", () => {
    for (const path of ["/itens/novo", "/itens/i1", "/itens/i1/reivindicar", "/admin/reivindicacoes/c1", "/admin/itens/i1/editar", "/conta"]) {
      expect(label(path)?.label).toMatch(/^Voltar /);
    }
  });
});

describe("seções de gestão", () => {
  it("lista usuários, convites e auditoria, cada uma com rota de detalhe", () => {
    expect(ADMIN_SECTIONS.map((s) => s.href)).toEqual(["/admin/usuarios", "/admin/convites", "/admin/auditoria"]);
    for (const { href } of ADMIN_SECTIONS) expect(getRouteChrome(href).kind).toBe("detail");
  });

  it("o BottomNav da administração não cresce além de 4 itens", () => {
    expect(getBottomNavItems("admin")).toHaveLength(4);
  });
});
