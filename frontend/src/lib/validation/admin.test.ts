import { describe, expect, it } from "vitest";
import {
  acceptInviteSchema,
  adminUserFiltersSchema,
  auditFiltersSchema,
  disableTwoFactorSchema,
  enableTwoFactorSchema,
  inviteSchema,
  toFieldErrors,
  userPatchSchema,
  verifyTwoFactorSchema,
} from "./index";

const errors = (r: { success: boolean; error?: Parameters<typeof toFieldErrors>[0] }) => (r.success ? {} : toFieldErrors(r.error!));

describe("2FA", () => {
  it("código de 6 dígitos (espaços ignorados)", () => {
    expect(enableTwoFactorSchema.parse({ code: "123 456" }).code).toBe("123456");
    expect(errors(enableTwoFactorSchema.safeParse({ code: "12345" })).code).toBe("Informe o código de 6 dígitos.");
    expect(errors(enableTwoFactorSchema.safeParse({ code: "abcdef" })).code).toBe("Informe o código de 6 dígitos.");
    expect(errors(enableTwoFactorSchema.safeParse({})).code).toBe("Informe o código de 6 dígitos.");
  });

  it("desligar: código obrigatório (TOTP ou recuperação), senha opcional", () => {
    expect(disableTwoFactorSchema.safeParse({ code: "abcde-fghjk" }).success).toBe(true);
    expect(disableTwoFactorSchema.safeParse({ password: "x", code: "123456" }).success).toBe(true);
    expect(errors(disableTwoFactorSchema.safeParse({ code: "  " })).code).toBe("Informe o código.");
  });

  it("verificar login: exatamente um entre code e recoveryCode", () => {
    expect(verifyTwoFactorSchema.safeParse({ challengeToken: "t", code: "123456" }).success).toBe(true);
    expect(verifyTwoFactorSchema.safeParse({ challengeToken: "t", recoveryCode: "abcde-fghjk" }).success).toBe(true);
    expect(errors(verifyTwoFactorSchema.safeParse({ challengeToken: "t" })).code).toBe("Informe o código de 6 dígitos.");
    expect(errors(verifyTwoFactorSchema.safeParse({ challengeToken: "t", code: "1", recoveryCode: "a" })).recoveryCode).toBeTruthy();
    expect(errors(verifyTwoFactorSchema.safeParse({ code: "123456" })).challengeToken).toBe("A verificação expirou. Entre novamente.");
  });
});

describe("filtros e edição de usuários", () => {
  it("normaliza vazios, converte página numérica e valida limites", () => {
    expect(adminUserFiltersSchema.parse({ q: "  ", role: "", status: "", page: "", pageSize: "" })).toEqual({});
    expect(adminUserFiltersSchema.parse({ q: " ana ", role: "admin", status: "disabled", page: "2", pageSize: 50 })).toEqual({
      q: "ana",
      role: "admin",
      status: "disabled",
      page: 2,
      pageSize: 50,
    });
    expect(errors(adminUserFiltersSchema.safeParse({ page: 0 })).page).toBeTruthy();
    expect(errors(adminUserFiltersSchema.safeParse({ page: 1.5 })).page).toBeTruthy();
    expect(errors(adminUserFiltersSchema.safeParse({ pageSize: 101 })).pageSize).toBe("Use de 1 a 100.");
    expect(errors(adminUserFiltersSchema.safeParse({ role: "root" })).role).toBe("Papel inválido.");
    expect(errors(adminUserFiltersSchema.safeParse({ status: "x" })).status).toBeTruthy();
  });

  it("alteração exige papel válido e/ou active booleano", () => {
    expect(userPatchSchema.safeParse({ role: "admin" }).success).toBe(true);
    expect(userPatchSchema.safeParse({ role: "teacher" }).success).toBe(false); // papéis antigos não existem mais
    expect(userPatchSchema.safeParse({ active: false }).success).toBe(true);
    expect(errors(userPatchSchema.safeParse({}))._form).toBe("Informe o papel e/ou o estado da conta.");
    expect(userPatchSchema.safeParse({ role: "root" }).success).toBe(false);
    expect(userPatchSchema.safeParse({ active: "sim" }).success).toBe(false);
  });
});

describe("convites e auditoria", () => {
  it("convite exige e-mail válido (normalizado)", () => {
    expect(inviteSchema.parse({ email: " Nova@Demo.TEST " }).email).toBe("nova@demo.test");
    expect(errors(inviteSchema.safeParse({ email: "nao-e-email" })).email).toBeTruthy();
    expect(errors(inviteSchema.safeParse({})).email).toBe("Informe seu e-mail.");
  });

  it("aceitar convite: token, nome 2-80, senha pela política; acceptedTerms opcional", () => {
    const ok = { token: "t".repeat(40), name: "Nova Admin", password: "senha-segura-1" };
    expect(acceptInviteSchema.safeParse(ok).success).toBe(true);
    expect(acceptInviteSchema.safeParse({ ...ok, acceptedTerms: true }).success).toBe(true);
    expect(errors(acceptInviteSchema.safeParse({ ...ok, name: "N" })).name).toBe("Use pelo menos 2 caracteres.");
    expect(errors(acceptInviteSchema.safeParse({ ...ok, password: "curta" })).password).toBeTruthy();
    expect(errors(acceptInviteSchema.safeParse({ ...ok, token: "curto" })).token).toBe("Link inválido ou incompleto.");
  });

  it("filtros da auditoria", () => {
    expect(auditFiltersSchema.parse({ action: "", actor: " user-admin ", page: "3" })).toEqual({ actor: "user-admin", page: 3 });
    expect(errors(auditFiltersSchema.safeParse({ pageSize: 0 })).pageSize).toBeTruthy();
  });
});
