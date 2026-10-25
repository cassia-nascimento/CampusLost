import { describe, expect, it } from "vitest";
import { ServiceError } from "@/types/domain";
import { classifyAdminFailure, isForbidden, isTwoFactorRequired } from "./admin-errors";

describe("falhas da administração", () => {
  it("TWO_FACTOR_REQUIRED leva a /conta", () => {
    expect(classifyAdminFailure(new ServiceError("TWO_FACTOR_REQUIRED", "x"), "f")).toEqual({ kind: "two-factor" });
    expect(isTwoFactorRequired(new ServiceError("TWO_FACTOR_REQUIRED", "x"))).toBe(true);
    expect(isTwoFactorRequired(new Error("x"))).toBe(false);
  });
  it("CONFLICT, FORBIDDEN e NOT_FOUND mostram a mensagem do serviço", () => {
    for (const code of ["CONFLICT", "FORBIDDEN", "NOT_FOUND"] as const) {
      expect(classifyAdminFailure(new ServiceError(code, "Motivo."), "f")).toEqual({ kind: "message", message: "Motivo." });
    }
    expect(isForbidden(new ServiceError("FORBIDDEN", "x"))).toBe(true);
  });
  it("o resto usa a mensagem padrão", () => {
    expect(classifyAdminFailure(new ServiceError("NETWORK", "x"), "Falhou.")).toEqual({ kind: "message", message: "Falhou." });
    expect(classifyAdminFailure(new Error("x"), "Falhou.")).toEqual({ kind: "message", message: "Falhou." });
  });
});
