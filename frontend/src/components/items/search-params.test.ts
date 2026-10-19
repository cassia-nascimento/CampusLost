import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  filtersToSearch,
  getActiveChips,
  parseFilterParams,
  periodError,
  toItemFilters,
} from "./search-params";

const parse = (query: string) => parseFilterParams(new URLSearchParams(query));

describe("parseFilterParams", () => {
  it("lê os quatro filtros válidos", () => {
    expect(parse("categoria=Eletr%C3%B4nicos&local=Bloco+A&de=2026-10-01&ate=2026-10-15")).toEqual({
      category: "Eletrônicos",
      location: "Bloco A",
      from: "2026-10-01",
      to: "2026-10-15",
    });
  });

  it("sem parâmetros devolve filtros vazios", () => {
    expect(parse("")).toEqual(EMPTY_FILTERS);
  });

  it("ignora categoria/local desconhecidos e datas inexistentes", () => {
    expect(parse("categoria=Joias&local=Lua&de=2026-02-30&ate=ontem")).toEqual(EMPTY_FILTERS);
  });

  it("período invertido: mantém a data inicial e descarta a final", () => {
    expect(parse("de=2026-10-20&ate=2026-10-01")).toEqual({ ...EMPTY_FILTERS, from: "2026-10-20" });
  });
});

describe("filtersToSearch", () => {
  it("URL limpa quando não há filtro", () => {
    expect(filtersToSearch(EMPTY_FILTERS)).toBe("");
  });

  it("só inclui campos preenchidos e vai e volta sem perda", () => {
    const values = { ...EMPTY_FILTERS, category: "Chaves", from: "2026-10-05" };
    const search = filtersToSearch(values);
    expect(search).toBe("?categoria=Chaves&de=2026-10-05");
    expect(parse(search.slice(1))).toEqual(values);
  });
});

describe("toItemFilters", () => {
  it("omite campos vazios", () => {
    expect(toItemFilters(EMPTY_FILTERS)).toEqual({});
    expect(toItemFilters({ ...EMPTY_FILTERS, location: "Cantina", to: "2026-10-10" })).toEqual({
      location: "Cantina",
      to: "2026-10-10",
    });
  });
});

describe("periodError", () => {
  it("aceita período vazio, parcial e ordenado", () => {
    expect(periodError(EMPTY_FILTERS)).toBeNull();
    expect(periodError({ from: "2026-10-01", to: "" })).toBeNull();
    expect(periodError({ from: "2026-10-01", to: "2026-10-01" })).toBeNull();
  });

  it("recusa data final anterior à inicial", () => {
    expect(periodError({ from: "2026-10-05", to: "2026-10-01" })).toMatch(/data final/i);
  });
});

describe("getActiveChips", () => {
  it("um chip por filtro ativo, com datas em dd/mm/aaaa", () => {
    expect(getActiveChips({ category: "Roupas", location: "", from: "2026-10-01", to: "2026-10-09" })).toEqual([
      { key: "category", label: "Roupas" },
      { key: "from", label: "A partir de 01/10/2026" },
      { key: "to", label: "Até 09/10/2026" },
    ]);
    expect(getActiveChips(EMPTY_FILTERS)).toEqual([]);
  });
});
