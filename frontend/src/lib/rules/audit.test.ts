import { describe, expect, it } from "vitest";
import { cleanAuditMetadata, emailFingerprint } from "./audit";

describe("cleanAuditMetadata (nunca grava segredos)", () => {
  it("descarta chaves sensíveis (qualquer caixa) e mantém o resto", () => {
    expect(
      cleanAuditMetadata({
        password: "x",
        newPassword: "x",
        token: "t",
        challengeToken: "t",
        totpSecret: "s",
        secret: "s",
        code: "123456",
        recoveryCode: "abcde-fghjk",
        passwordHash: "h",
        credential: "c",
        cookie: "k",
        method: "password",
        from: "student",
        autoRejected: 2,
        flag: true,
      }),
    ).toEqual({ method: "password", from: "student", autoRejected: 2, flag: true });
  });
  it("sem nada a guardar vira null; valores longos são cortados; objetos viram texto", () => {
    expect(cleanAuditMetadata(undefined)).toBeNull();
    expect(cleanAuditMetadata({ token: "x" })).toBeNull();
    expect((cleanAuditMetadata({ title: "a".repeat(500) })!.title as string).length).toBe(200);
    expect(cleanAuditMetadata({ nota: null })).toEqual({ nota: null });
  });
});

describe("emailFingerprint", () => {
  it("12 hexadecimais, estável e sem diferenciar caixa/espaços", () => {
    const ref = emailFingerprint("Ana@Demo.test ");
    expect(ref).toMatch(/^[0-9a-f]{12}$/);
    expect(emailFingerprint("ana@demo.test")).toBe(ref);
    expect(emailFingerprint("outra@demo.test")).not.toBe(ref);
    expect(ref).not.toContain("ana");
  });
});
