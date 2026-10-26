import { describe, expect, it } from "vitest";
import { ServiceError } from "@/types/domain";
import { SESSION_HINT_KEY } from "./http";
import { createHarness, rawSession, rawUser } from "./test-utils";

async function failure(promise: Promise<unknown>): Promise<ServiceError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ServiceError) return error;
    throw error;
  }
  throw new Error("esperava rejeição");
}

const page = (items: unknown[]) => ({ items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });
const adminRow = {
  id: "user-lucas",
  name: "Lucas Prado",
  email: "lucas@demo.test",
  role: "student",
  provider: "password",
  active: true,
  disabledAt: null,
  emailVerified: true,
  twoFactorEnabled: false,
  createdAt: "2026-10-01T10:00:00.000Z",
};

describe("2FA (API.md §4.2.7)", () => {
  it("signIn com 2FA ligado devolve needs_2fa e NÃO marca sessão", async () => {
    const { api, services, storage } = createHarness();
    api.reply({ json: { status: "needs_2fa", challengeToken: "chal-1" } });
    const result = await services.auth.signIn({ email: "marina@demo.test", password: "demonstracao123" });
    expect(result).toEqual({ status: "needs_2fa", challengeToken: "chal-1" });
    expect(storage.getItem(SESSION_HINT_KEY)).toBeNull();
  });

  it("signInWithGoogle: needs_2fa também é repassado", async () => {
    const { api, services } = createHarness();
    api.reply({ json: { status: "needs_2fa", challengeToken: "chal-2" } });
    expect(await services.auth.signInWithGoogle("cred")).toEqual({ status: "needs_2fa", challengeToken: "chal-2" });
  });

  it("verifyTwoFactor: POST /auth/2fa/verify sem Authorization, com code ou recoveryCode; marca a sessão", async () => {
    const { api, services, storage } = createHarness();
    api.reply({ json: rawSession }, { json: rawSession });
    expect(await services.auth.verifyTwoFactor({ challengeToken: "chal-1", code: "123456" })).toEqual(rawUser);
    expect(api.calls[0].method).toBe("POST");
    expect(api.calls[0].url.pathname).toBe("/auth/2fa/verify");
    expect(JSON.parse(String(api.calls[0].body))).toEqual({ challengeToken: "chal-1", code: "123456" });
    expect(api.calls[0].headers.Authorization).toBeUndefined();
    expect(api.calls[0].headers["X-Requested-With"]).toBe("CampusLost");
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
    await services.auth.verifyTwoFactor({ challengeToken: "chal-1", recoveryCode: "abcde-fghjk" });
    expect(JSON.parse(String(api.calls[1].body))).toEqual({ challengeToken: "chal-1", recoveryCode: "abcde-fghjk" });
  });

  it("verifyTwoFactor: erros do servidor (código errado, desafio expirado, conta desativada)", async () => {
    const { api, services } = createHarness();
    api.reply(
      { status: 401, json: { code: "INVALID_CREDENTIALS", message: "Código incorreto ou expirado.", fieldErrors: { code: "Código incorreto ou expirado." } } },
      { status: 401, json: { code: "UNAUTHENTICATED", message: "A verificação expirou. Entre novamente." } },
      { status: 403, json: { code: "ACCOUNT_DISABLED", message: "Esta conta está desativada." } },
    );
    const a = await failure(services.auth.verifyTwoFactor({ challengeToken: "c", code: "000000" }));
    expect(a).toMatchObject({ code: "INVALID_CREDENTIALS", fieldErrors: { code: "Código incorreto ou expirado." } });
    expect((await failure(services.auth.verifyTwoFactor({ challengeToken: "c", code: "000000" }))).code).toBe("UNAUTHENTICATED");
    expect((await failure(services.auth.verifyTwoFactor({ challengeToken: "c", code: "000000" }))).code).toBe("ACCOUNT_DISABLED");
  });

  it("setup / enable / disable: rotas, corpos e cookies (sem Authorization)", async () => {
    const { api, services } = createHarness();
    api.reply({ json: rawSession }, { json: { secret: "ABC", otpauthUri: "otpauth://totp/x" } });
    await services.auth.signIn({ email: "marina@demo.test", password: "demonstracao123" });
    expect(await services.auth.setupTwoFactor()).toEqual({ secret: "ABC", otpauthUri: "otpauth://totp/x" });
    expect(api.calls[1]).toMatchObject({ method: "POST" });
    expect(api.calls[1].url.pathname).toBe("/auth/2fa/setup");
    expect(api.calls[1].headers.Authorization).toBeUndefined();

    api.reply({ json: { enabled: true, recoveryCodes: ["aaaaa-bbbbb", "ccccc-ddddd"] } });
    expect(await services.auth.enableTwoFactor("123456")).toEqual({ recoveryCodes: ["aaaaa-bbbbb", "ccccc-ddddd"] });
    expect(api.calls[2].url.pathname).toBe("/auth/2fa/enable");
    expect(JSON.parse(String(api.calls[2].body))).toEqual({ code: "123456" });

    api.reply({ json: { enabled: false } }, { json: { enabled: false } });
    await services.auth.disableTwoFactor({ password: "demonstracao123", code: "123456" });
    expect(api.calls[3].url.pathname).toBe("/auth/2fa/disable");
    expect(JSON.parse(String(api.calls[3].body))).toEqual({ password: "demonstracao123", code: "123456" });
    await services.auth.disableTwoFactor({ code: "abcde-fghjk" }); // conta só-Google: sem senha
    expect(JSON.parse(String(api.calls[4].body))).toEqual({ code: "abcde-fghjk" });
  });

  it("enable com código errado: VALIDATION com fieldErrors.code", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 422, json: { code: "VALIDATION", message: "Confira os campos destacados.", fieldErrors: { code: "Código incorreto ou expirado." } } });
    expect(await failure(services.auth.enableTwoFactor("000000"))).toMatchObject({ code: "VALIDATION", fieldErrors: { code: "Código incorreto ou expirado." } });
  });

  it("disable com senha/código errados: INVALID_CREDENTIALS (403) mantém a sessão", async () => {
    const { api, services, storage } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply({ status: 403, json: { code: "INVALID_CREDENTIALS", message: "Senha ou código incorretos.", fieldErrors: { password: "Confira a senha e o código." } } });
    expect((await failure(services.auth.disableTwoFactor({ password: "x", code: "000000" }))).code).toBe("INVALID_CREDENTIALS");
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
  });

  it("aceitar convite: POST /auth/accept-invite sem Bearer, sem acceptedTerms; abre sessão", async () => {
    const { api, services, storage } = createHarness();
    api.reply({ status: 201, json: { ...rawSession, user: { ...rawUser, role: "admin" } } });
    const user = await services.auth.acceptInvite({ token: "t".repeat(40), name: "Nova Admin", password: "senha-longa-123", acceptedTerms: true });
    expect(user.role).toBe("admin");
    expect(api.calls[0].url.pathname).toBe("/auth/accept-invite");
    expect(JSON.parse(String(api.calls[0].body))).toEqual({ token: "t".repeat(40), name: "Nova Admin", password: "senha-longa-123" });
    expect(api.calls[0].headers.Authorization).toBeUndefined();
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
  });

  it("convite inválido vira TOKEN_INVALID (INVALID_TOKEN normalizado)", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 400, json: { code: "INVALID_TOKEN", message: "Link inválido ou expirado. Peça um novo." } });
    expect((await failure(services.auth.acceptInvite({ token: "t".repeat(40), name: "Nova Admin", password: "senha-longa-123" }))).code).toBe("TOKEN_INVALID");
  });
});

describe("administração (API.md §4.8)", () => {
  it("listUsers: GET /admin/users com q, role, status e paginação na query", async () => {
    const { api, services, storage } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply({ json: page([adminRow]) });
    const result = await services.admin.listUsers({ q: " lucas ", role: "student", status: "active", page: 2, pageSize: 10 });
    expect(result).toEqual(page([adminRow]));
    const { method, url, headers } = api.calls[0];
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/admin/users");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "lucas", role: "student", status: "active", page: "2", pageSize: "10" });
    expect(headers.Authorization).toBeUndefined();
    expect(headers["X-Requested-With"]).toBeUndefined(); // só em mutações
  });

  it("listUsers sem filtros não manda parâmetros vazios", async () => {
    const { api, services } = createHarness();
    api.reply({ json: page([]) });
    await services.admin.listUsers({ q: "", role: undefined });
    expect(api.calls[0].url.search).toBe("");
  });

  it("updateUser usa PATCH com X-Requested-With e só os campos informados", async () => {
    const { api, services } = createHarness();
    api.reply({ json: { ...adminRow, role: "teacher" } }, { json: { ...adminRow, active: false } });
    expect((await services.admin.updateUser("user-lucas", { role: "teacher" })).role).toBe("teacher");
    expect(api.calls[0].method).toBe("PATCH");
    expect(api.calls[0].url.pathname).toBe("/admin/users/user-lucas");
    expect(api.calls[0].headers["X-Requested-With"]).toBe("CampusLost");
    expect(JSON.parse(String(api.calls[0].body))).toEqual({ role: "teacher" });
    await services.admin.updateUser("user-lucas", { active: false });
    expect(JSON.parse(String(api.calls[1].body))).toEqual({ active: false });
  });

  it("CONFLICT (própria conta / último admin), TWO_FACTOR_REQUIRED e FORBIDDEN chegam com o código certo", async () => {
    const { api, services } = createHarness();
    api.reply(
      { status: 409, json: { code: "CONFLICT", message: "Esta é a última conta de administração ativa. Crie outra antes." } },
      { status: 403, json: { code: "TWO_FACTOR_REQUIRED", message: "A administração precisa ativar a verificação em duas etapas antes de continuar." } },
      { status: 403, json: { code: "FORBIDDEN", message: "Sem permissão." } },
    );
    expect((await failure(services.admin.updateUser("user-admin", { active: false }))).code).toBe("CONFLICT");
    expect((await failure(services.admin.listUsers())).code).toBe("TWO_FACTOR_REQUIRED");
    expect((await failure(services.admin.listAuditLog())).code).toBe("FORBIDDEN");
  });

  it("login de conta desativada: ACCOUNT_DISABLED", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 403, json: { code: "ACCOUNT_DISABLED", message: "Esta conta está desativada. Fale com a administração do campus." } });
    const e = await failure(services.auth.signIn({ email: "marina@demo.test", password: "demonstracao123" }));
    expect(e.code).toBe("ACCOUNT_DISABLED");
  });

  it("convites: criar (sem devLink), listar e revogar (204)", async () => {
    const { api, services } = createHarness();
    const invite = { id: "invite-x", email: "nova@demo.test", status: "pending", createdAt: "2026-10-19T10:00:00.000Z", expiresAt: "2026-10-21T10:00:00.000Z", invitedById: "user-admin" };
    api.reply({ status: 201, json: invite }, { json: page([invite]) }, { status: 204 });
    const created = await services.admin.createInvite("nova@demo.test");
    expect(created).toEqual(invite);
    expect(created.devLink).toBeUndefined();
    expect(api.calls[0].method).toBe("POST");
    expect(api.calls[0].url.pathname).toBe("/admin/invites");
    expect(JSON.parse(String(api.calls[0].body))).toEqual({ email: "nova@demo.test" });
    expect((await services.admin.listInvites({ page: 1, pageSize: 5 })).items).toEqual([invite]);
    expect(Object.fromEntries(api.calls[1].url.searchParams)).toEqual({ page: "1", pageSize: "5" });
    await services.admin.revokeInvite("invite-x");
    expect(api.calls[2].method).toBe("DELETE");
    expect(api.calls[2].url.pathname).toBe("/admin/invites/invite-x");
    expect(api.calls[2].headers["X-Requested-With"]).toBe("CampusLost");
  });

  it("EMAIL_TAKEN ao convidar", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 409, json: { code: "EMAIL_TAKEN", message: "Este e-mail já está cadastrado.", fieldErrors: { email: "Este e-mail já está cadastrado." } } });
    expect(await failure(services.admin.createInvite("marina@demo.test"))).toMatchObject({ code: "EMAIL_TAKEN", fieldErrors: { email: "Este e-mail já está cadastrado." } });
  });

  it("auditoria: GET /admin/audit com action e actor", async () => {
    const { api, services } = createHarness();
    const entry = { id: "7", at: "2026-10-19T10:00:00.000Z", actorId: "user-admin", actorName: "Administração Demo", action: "user.disable", targetType: "user", targetId: "user-lucas", ip: "127.0.0.1", metadata: null };
    api.reply({ json: page([entry]) });
    const result = await services.admin.listAuditLog({ action: "user.disable", actor: "user-admin", page: 3 });
    expect(result.items).toEqual([entry]);
    expect(api.calls[0].url.pathname).toBe("/admin/audit");
    expect(Object.fromEntries(api.calls[0].url.searchParams)).toEqual({ action: "user.disable", actor: "user-admin", page: "3" });
  });

  it("resposta fora do formato vira UNEXPECTED", async () => {
    const { api, services } = createHarness();
    api.reply({ json: { foo: 1 } });
    expect((await failure(services.admin.listUsers())).code).toBe("UNEXPECTED");
  });
});
