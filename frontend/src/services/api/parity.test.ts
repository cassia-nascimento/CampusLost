import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "../mock/storage";
import { createMockServices } from "../mock";
import { createApiServices } from "./index";
import { BASE, createFakeApi } from "./test-utils";

/** Todas as chaves (recursivamente) de um objeto de serviços, como `auth.signIn`. */
function keys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, v]) =>
    typeof v === "function" ? [`${prefix}${key}`] : typeof v === "object" && v !== null ? keys(v, `${prefix}${key}.`) : [],
  );
}

describe("paridade do cliente REST com o contrato", () => {
  it("implementa todas as chaves de Services que o mock implementa (e nenhuma a mais)", () => {
    const mock = createMockServices({ storage: createMemoryStorage(), sessionStorage: createMemoryStorage(), latency: 0 });
    const api = createApiServices({ baseUrl: BASE, fetch: createFakeApi().fetch, storage: createMemoryStorage() });
    expect(keys(api).sort()).toEqual(keys(mock).sort());
    expect(keys(api).length).toBeGreaterThanOrEqual(25);
  });
});
