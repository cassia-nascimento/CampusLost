import { describe, expect, it } from "vitest";
import { addDays, isFutureDate, isValidIsoDate, localDateOfInstant, toLocalDateString } from "./dates";

describe("datas", () => {
  it("formata no calendário local", () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
  it("valida datas reais", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("19/10/2026")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
  it("soma dias atravessando o mês", () => {
    expect(toLocalDateString(addDays(new Date(2026, 9, 31), 1))).toBe("2026-11-01");
    expect(toLocalDateString(addDays(new Date(2026, 9, 1), -1))).toBe("2026-09-30");
  });
  it("compara com hoje", () => {
    expect(isFutureDate("2026-10-20", "2026-10-19")).toBe(true);
    expect(isFutureDate("2026-10-19", "2026-10-19")).toBe(false);
  });
  it("data local de um instante", () => {
    expect(localDateOfInstant(new Date(2026, 5, 1, 12).toISOString())).toBe("2026-06-01");
  });
});
