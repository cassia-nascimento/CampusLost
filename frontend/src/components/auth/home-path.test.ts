import { describe, expect, it } from "vitest";
import { homePathFor } from "./home-path";

describe("homePathFor", () => {
  it("administração vai ao painel", () => {
    expect(homePathFor("admin")).toBe("/admin");
  });

  it("usuário vai à busca de itens", () => {
    expect(homePathFor("user")).toBe("/itens");
  });
});
