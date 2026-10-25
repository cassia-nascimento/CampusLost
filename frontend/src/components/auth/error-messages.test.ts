import { describe, expect, it } from "vitest";
import { ServiceError } from "@/types/domain";
import { accountErrorMessage, SECURITY_CHECK_MESSAGE } from "./error-messages";

describe("mensagem de erro de conta", () => {
  it("CAPTCHA_FAILED e CSRF_FAILED viram a mensagem genérica", () => {
    expect(accountErrorMessage(new ServiceError("CAPTCHA_FAILED", "x"), "f")).toBe(SECURITY_CHECK_MESSAGE);
    expect(accountErrorMessage(new ServiceError("CSRF_FAILED", "x"), "f")).toBe(SECURITY_CHECK_MESSAGE);
  });
  it("outros erros usam o texto de reserva", () => {
    expect(accountErrorMessage(new ServiceError("NETWORK", "x"), "f")).toBe("f");
    expect(accountErrorMessage(new Error("x"), "f")).toBe("f");
  });
});
