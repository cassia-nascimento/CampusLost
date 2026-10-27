import { describe, expect, it } from "vitest";
import {
  adminNeedsTwoFactor,
  effectiveTwoFactor,
  formatSecret,
  parseAccountReason,
  recoveryCodesFileName,
  serializeRecoveryCodes,
} from "./two-factor";

describe("motivo da ida a /conta", () => {
  it("aceita só os motivos conhecidos", () => {
    expect(parseAccountReason("2fa")).toBe("2fa");
    expect(parseAccountReason("convite")).toBe("convite");
    for (const bad of ["", "x", "//evil.test", null, undefined]) expect(parseAccountReason(bad)).toBeNull();
  });
});

describe("administração sem 2FA", () => {
  it("só vale para administração sem o 2FA ligado", () => {
    expect(adminNeedsTwoFactor({ role: "admin", twoFactorEnabled: false })).toBe(true);
    expect(adminNeedsTwoFactor({ role: "admin" })).toBe(true);
    expect(adminNeedsTwoFactor({ role: "admin", twoFactorEnabled: true })).toBe(false);
    expect(adminNeedsTwoFactor({ role: "user", twoFactorEnabled: false })).toBe(false);
  });
});

describe("estado efetivo do 2FA", () => {
  it("prefere o dado do usuário, depois o desta tela, depois desligado", () => {
    expect(effectiveTwoFactor(true, false)).toBe(true);
    expect(effectiveTwoFactor(false, true)).toBe(false);
    expect(effectiveTwoFactor(undefined, true)).toBe(true);
    expect(effectiveTwoFactor(undefined, null)).toBe(false);
  });
});

describe("segredo e códigos de recuperação", () => {
  it("agrupa o segredo de 4 em 4", () => {
    expect(formatSecret("ABCDEFGHIJ")).toBe("ABCD EFGH IJ");
    expect(formatSecret("ABCDEFGH")).toBe("ABCD EFGH");
    expect(formatSecret("")).toBe("");
  });
  it("nomeia o arquivo com o dia", () => {
    expect(recoveryCodesFileName("2026-10-25")).toBe("campuslost-codigos-de-recuperacao-2026-10-25.txt");
    expect(recoveryCodesFileName("x")).toBe("campuslost-codigos-de-recuperacao.txt");
  });
  it("o arquivo traz a conta, o aviso e um código por linha", () => {
    const text = serializeRecoveryCodes(["abcde-23456", "fghjk-78923"], "a@b.test");
    const lines = text.split("\n");
    expect(lines).toContain("abcde-23456");
    expect(lines).toContain("fghjk-78923");
    expect(text).toContain("a@b.test");
    expect(text).toContain("uma única vez");
  });
});
