import { describe, expect, it } from "vitest";
import { NO_USER_FILTERS, hasUserFilters, parseAffiliationFilter, parseRoleFilter, parseStatusFilter, toListUsersFilters } from "./user-filters";

describe("filtros de usuários", () => {
  it("sem filtro, nada é enviado além da página", () => {
    expect(toListUsersFilters(NO_USER_FILTERS, 1)).toEqual({ q: undefined, role: undefined, affiliation: undefined, status: undefined, page: 1 });
    expect(hasUserFilters(NO_USER_FILTERS)).toBe(false);
  });
  it("aparar a busca e ignorar valores desconhecidos", () => {
    expect(toListUsersFilters({ q: "  ana ", role: "admin", affiliation: "external", status: "disabled" }, 3)).toEqual({
      q: "ana",
      role: "admin",
      affiliation: "external",
      status: "disabled",
      page: 3,
    });
    expect(parseRoleFilter("root")).toBeUndefined();
    expect(parseStatusFilter("all")).toBeUndefined();
    expect(parseAffiliationFilter("student")).toBeUndefined();
    expect(parseAffiliationFilter("institutional")).toBe("institutional");
  });
  it("só espaços na busca não conta como filtro", () => {
    expect(hasUserFilters({ q: "   ", role: "", affiliation: "", status: "" })).toBe(false);
    expect(hasUserFilters({ q: "", role: "admin", affiliation: "", status: "" })).toBe(true);
    expect(hasUserFilters({ q: "", role: "", affiliation: "external", status: "" })).toBe(true);
  });
});
