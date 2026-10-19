import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSearch, rememberItemsSearch } from "./last-search";

function stubStorage(store: Map<string, string>) {
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
}

describe("última busca de /itens", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    stubStorage(store);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("guarda e devolve a query string", () => {
    rememberItemsSearch("?categoria=Chaves&de=2026-10-01");
    expect(readSearch()).toBe("?categoria=Chaves&de=2026-10-01");
  });

  it("busca vazia apaga o que estava guardado", () => {
    rememberItemsSearch("?local=Portaria");
    rememberItemsSearch("");
    expect(readSearch()).toBe("");
    expect(store.size).toBe(0);
  });

  it("descarta parâmetros desconhecidos ou inválidos ao ler", () => {
    store.set("campuslost:proto:v1:last-items-search", "?categoria=Nada&x=1&local=Portaria&de=hoje");
    expect(readSearch()).toBe("?local=Portaria");
  });

  it("sem armazenamento (lança erro), cai em vazio sem quebrar", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(() => rememberItemsSearch("?local=Portaria")).not.toThrow();
    expect(readSearch()).toBe("");
  });

  it("sem sessionStorage (servidor), devolve vazio", () => {
    vi.unstubAllGlobals();
    expect(readSearch()).toBe("");
  });
});
