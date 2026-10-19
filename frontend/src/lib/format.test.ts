import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatInstantDate,
  formatRelativeDate,
  formatRelativeInstant,
  formatTime,
  getInitial,
} from "./format";

/** 19/10/2026, 15:30 no fuso local do processo de teste. */
const NOW = new Date(2026, 9, 19, 15, 30);

describe("formatDate", () => {
  it("formata YYYY-MM-DD como dd/mm/aaaa sem deslocar o dia por fuso", () => {
    expect(formatDate("2026-10-01")).toBe("01/10/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });

  it("devolve o texto original quando o formato é desconhecido", () => {
    expect(formatDate("ontem")).toBe("ontem");
  });
});

describe("formatRelativeDate", () => {
  it("hoje e ontem", () => {
    expect(formatRelativeDate("2026-10-19", NOW)).toBe("hoje");
    expect(formatRelativeDate("2026-10-18", NOW)).toBe("ontem");
  });

  it("há N dias até o limite de 7", () => {
    expect(formatRelativeDate("2026-10-17", NOW)).toBe("há 2 dias");
    expect(formatRelativeDate("2026-10-12", NOW)).toBe("há 7 dias");
  });

  it("depois de 7 dias, data completa", () => {
    expect(formatRelativeDate("2026-10-11", NOW)).toBe("11/10/2026");
  });

  it("atravessa mudança de mês e de horário de verão", () => {
    expect(formatRelativeDate("2026-09-30", new Date(2026, 9, 1, 0, 5))).toBe("ontem");
  });

  it("data futura mostra a data completa", () => {
    expect(formatRelativeDate("2026-10-20", NOW)).toBe("20/10/2026");
  });
});

describe("instantes", () => {
  const instant = new Date(2026, 9, 18, 9, 5).toISOString();

  it("converte para o fuso local", () => {
    expect(formatInstantDate(instant)).toBe("18/10/2026");
    expect(formatTime(instant)).toBe("09:05");
    expect(formatDateTime(instant)).toBe("18/10/2026 às 09:05");
    expect(formatRelativeInstant(instant, NOW)).toBe("ontem");
  });
});

describe("formatCount e getInitial", () => {
  it("singular e plural", () => {
    expect(formatCount(1, "item", "itens")).toBe("1 item");
    expect(formatCount(0, "item", "itens")).toBe("0 itens");
    expect(formatCount(12, "item", "itens")).toBe("12 itens");
  });

  it("inicial em maiúscula", () => {
    expect(getInitial("  maria Exemplo")).toBe("M");
    expect(getInitial("")).toBe("?");
  });
});
