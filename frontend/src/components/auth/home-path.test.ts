import { describe, expect, it } from "vitest";
import { homePathFor } from "./home-path";

describe("homePathFor", () => {
  it("administração vai ao painel", () => {
    expect(homePathFor("admin")).toBe("/admin");
  });

  it("aluno e professor vão à busca de itens", () => {
    expect(homePathFor("student")).toBe("/itens");
    expect(homePathFor("teacher")).toBe("/itens");
  });
});
