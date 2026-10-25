import { describe, expect, it } from "vitest";
import { ServiceError } from "@/types/domain";
import {
  EXPIRED_CHALLENGE_MESSAGE,
  classifyTwoFactorFailure,
  codeStepSchema,
  recoveryStepSchema,
  verifyPayload,
  wrongCodeMessage,
} from "./two-factor-step";

describe("código do aplicativo", () => {
  it("aceita 6 dígitos, com ou sem espaço", () => {
    expect(codeStepSchema.safeParse({ value: "123456" }).success).toBe(true);
    expect(codeStepSchema.safeParse({ value: "123 456" }).success).toBe(true);
  });
  it("recusa vazio, curto e letras", () => {
    for (const value of ["", "12345", "12345a", "1234567"]) {
      expect(codeStepSchema.safeParse({ value }).success).toBe(false);
    }
  });
});

describe("código de recuperação", () => {
  it("aceita xxxxx-xxxxx em qualquer caixa e sem hífen", () => {
    for (const value of ["abcde-23456", "ABCDE-23456", "abcde23456", "  abcde-23456 "]) {
      expect(recoveryStepSchema.safeParse({ value }).success).toBe(true);
    }
  });
  it("recusa vazio e formato errado", () => {
    for (const value of ["", "abc", "abcde-2345", "abcde-23456-1"]) {
      expect(recoveryStepSchema.safeParse({ value }).success).toBe(false);
    }
  });
});

describe("corpo do verifyTwoFactor", () => {
  it("envia só um dos campos, normalizado", () => {
    expect(verifyPayload("code", "123 456")).toEqual({ code: "123456" });
    expect(verifyPayload("recovery", "ABCDE23456")).toEqual({ recoveryCode: "abcde-23456" });
  });
});

describe("falhas do passo de código", () => {
  it("código errado vira erro no campo, com a mensagem do serviço quando existe", () => {
    expect(classifyTwoFactorFailure(new ServiceError("INVALID_CREDENTIALS", "x"), "code")).toEqual({
      kind: "field",
      message: wrongCodeMessage("code"),
    });
    expect(
      classifyTwoFactorFailure(new ServiceError("INVALID_CREDENTIALS", "x", { fieldErrors: { code: "Código inválido." } }), "recovery"),
    ).toEqual({ kind: "field", message: "Código inválido." });
    expect(classifyTwoFactorFailure(new ServiceError("INVALID_CREDENTIALS", "x"), "recovery")).toMatchObject({
      kind: "field",
      message: wrongCodeMessage("recovery"),
    });
  });
  it("desafio expirado volta ao login", () => {
    expect(classifyTwoFactorFailure(new ServiceError("UNAUTHENTICATED", "x"), "code")).toEqual({
      kind: "expired",
      message: EXPIRED_CHALLENGE_MESSAGE,
    });
  });
  it("conta desativada e limites usam a mensagem do serviço", () => {
    for (const code of ["ACCOUNT_DISABLED", "RATE_LIMITED", "NETWORK"] as const) {
      expect(classifyTwoFactorFailure(new ServiceError(code, "Mensagem do serviço."), "code")).toEqual({
        kind: "form",
        message: "Mensagem do serviço.",
      });
    }
  });
  it("validação sem campo e erros desconhecidos viram falha geral", () => {
    expect(classifyTwoFactorFailure(new ServiceError("VALIDATION", "x"), "code").kind).toBe("form");
    expect(classifyTwoFactorFailure(new Error("x"), "code").kind).toBe("form");
    expect(classifyTwoFactorFailure(new ServiceError("CAPTCHA_FAILED", "x"), "code").kind).toBe("form");
  });
});
