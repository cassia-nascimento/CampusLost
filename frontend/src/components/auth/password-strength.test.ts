import { describe, expect, it } from "vitest";
import { PASSWORD_HINT, STRENGTH_SEGMENTS, strengthView } from "./password-strength";

describe("medidor de força da senha", () => {
  it("sempre acende ao menos uma barra e nunca passa do total", () => {
    for (const level of [0, 1, 2, 3, 4] as const) {
      const { filled } = strengthView(level);
      expect(filled).toBeGreaterThanOrEqual(1);
      expect(filled).toBeLessThanOrEqual(STRENGTH_SEGMENTS);
    }
  });

  it("tom acompanha a nota: fraca perigo, razoável aviso, boa e forte sucesso", () => {
    expect(strengthView(0).tone).toBe("danger");
    expect(strengthView(1).tone).toBe("danger");
    expect(strengthView(2).tone).toBe("warning");
    expect(strengthView(3).tone).toBe("success");
    expect(strengthView(4)).toEqual({ filled: 4, tone: "success" });
  });

  it("a dica é simples: mínimo de 10 caracteres, sem falar em bytes", () => {
    expect(PASSWORD_HINT).toContain("10 caracteres");
    expect(PASSWORD_HINT.toLowerCase()).not.toContain("byte");
  });
});
