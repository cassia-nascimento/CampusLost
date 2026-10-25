import { describe, expect, it } from "vitest";
import { NO_USER_FILTERS, hasUserFilters, parseRoleFilter, parseStatusFilter, toListUsersFilters } from "./user-filters";

describe("filtros de usuários", () => {
  it("sem filtro, nada é enviado além da página", () => {
    expect(toListUsersFilters(NO_USER_FILTERS, 1)).toEqual({ q: undefined, role: undefined, status: undefined, page: 1 });
    expect(hasUserFilters(NO_USER_FILTERS)).toBe(false);
  });
  it("aparar a busca e ignorar valores desconhecidos", () => {
    expect(toListUsersFilters({ q: "  ana ", role: "admin", status: "disabled" }, 3)).toEqual({
      q: "ana",
      role: "admin",
      status: "disabled",
      page: 3,
    });
    expect(parseRoleFilter("root")).toBeUndefined();
    expect(parseStatusFilter("all")).toBeUndefined();
  });
  it("só espaços na busca não conta como filtro", () => {
    expect(hasUserFilters({ q: "   ", role: "", status: "" })).toBe(false);
    expect(hasUserFilters({ q: "", role: "student", status: "" })).toBe(true);
  });
});
