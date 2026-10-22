import { describe, expect, it } from "vitest";
import { parseNext, withNext } from "./next-param";

describe("parseNext", () => {
  it("aceita o detalhe de um item com id simples", () => {
    expect(parseNext("/itens/item-01")).toBe("/itens/item-01");
    expect(parseNext("/itens/abc_123")).toBe("/itens/abc_123");
  });

  it.each([
    ["ausente", null],
    ["indefinido", undefined],
    ["vazio", ""],
    ["URL externa", "https://exemplo.com/itens/item-01"],
    ["protocolo relativo", "//exemplo.com/itens/item-01"],
    ["protocolo relativo com barra a mais", "///itens/item-01"],
    ["barra invertida", "/\\exemplo.com"],
    ["javascript", "javascript:alert(1)"],
    ["lista de itens", "/itens"],
    ["registrar item", "/itens/novo"],
    ["reivindicar", "/itens/item-01/reivindicar"],
    ["área da administração", "/admin"],
    ["entrar", "/entrar"],
    ["query", "/itens/item-01?x=1"],
    ["fragmento", "/itens/item-01#topo"],
    ["barra final", "/itens/item-01/"],
    ["sem barra inicial", "itens/item-01"],
    ["subida de diretório", "/itens/../admin"],
    ["id com espaço", "/itens/item 01"],
    ["id com percentual", "/itens/%2e%2e"],
    ["id longo demais", `/itens/${"a".repeat(65)}`],
    ["codificado duas vezes (%25 não é aceito no id nem no início)", "%252Fitens%252Fx"],
    ["caixa diferente em /ITENS (a lista é sensível a maiúsculas)", "/ITENS/x"],
    ["barra de largura total (U+FF0F) no lugar da barra", "\uFF0Fitens/x"],
    ["barra de largura total (U+FF0F) dentro do caminho", "/itens\uFF0Fx"],
    ["quebra de linha no final (`$` do JS não casa antes de \\n)", "/itens/x\n"],
    ["tabulação no final", "/itens/x\t"],
    ["query curta", "/itens/x?y=1"],
    ["fragmento curto", "/itens/x#h"],
  ])("ignora %s", (_label, value) => {
    expect(parseNext(value)).toBeNull();
  });
});

describe("parseNext: casos de borda aceitos", () => {
  it("só /itens/novo em minúsculas é recusado; /itens/NOVO é um id comum (a rota responde 'não encontrado')", () => {
    expect(parseNext("/itens/novo")).toBeNull();
    expect(parseNext("/itens/NOVO")).toBe("/itens/NOVO");
    expect(parseNext("/itens/novo2")).toBe("/itens/novo2");
  });
});

describe("withNext", () => {
  it("anexa o destino codificado quando válido", () => {
    expect(withNext("/entrar", "/itens/item-01")).toBe("/entrar?next=%2Fitens%2Fitem-01");
    expect(withNext("/cadastro", "/itens/item-01")).toBe("/cadastro?next=%2Fitens%2Fitem-01");
  });

  it("devolve o href puro quando o destino é inválido ou ausente", () => {
    expect(withNext("/entrar", null)).toBe("/entrar");
    expect(withNext("/entrar", "//exemplo.com")).toBe("/entrar");
    expect(withNext("/cadastro", "/admin")).toBe("/cadastro");
  });
});
