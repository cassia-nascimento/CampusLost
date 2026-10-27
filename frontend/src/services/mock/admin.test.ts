import { describe, expect, it } from "vitest";
import { totpCode } from "@/lib/rules";
import { DEMO_PASSWORD } from "./seed";
import { createHarness, expectCode, googleCredential, signInAsRafael, userOf, validItem, type Harness } from "./test-utils";

const PW = "senha-segura-1";
const ADMIN_PW = "outra-senha-longa-9";

/** Entra como a administração demo (isenta de 2FA). */
async function asAdmin(h: Harness) {
  return h.services.auth.signInAsDemo("admin");
}

/** Cria um convite como admin demo e aceita; devolve a nova conta admin (sem 2FA) já logada. */
async function newInvitedAdmin(h: Harness, email = "nova@demo.test") {
  await asAdmin(h);
  const invite = await h.services.admin.createInvite(email);
  const token = new URL(invite.devLink!, "http://x.test").searchParams.get("token")!;
  await h.services.auth.signOut();
  const user = await h.services.auth.acceptInvite({ token, name: "Nova Admin", password: ADMIN_PW });
  return { user, token, invite };
}

/** Liga o 2FA do usuário logado e devolve segredo e códigos de recuperação. */
async function enable2fa(h: Harness) {
  const { secret } = await h.services.auth.setupTwoFactor();
  const { recoveryCodes } = await h.services.auth.enableTwoFactor(totpCode(secret, h.clock())!);
  return { secret, recoveryCodes };
}

describe("2FA: configurar, ligar e desligar", () => {
  it("setup devolve segredo base32 e URI otpauth; nada muda até enable", async () => {
    const h = createHarness();
    await h.services.auth.signInAsDemo("user");
    const setup = await h.services.auth.setupTwoFactor();
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.otpauthUri).toBe(
      `otpauth://totp/CampusLost%3Amarina%40demo.test?secret=${setup.secret}&issuer=CampusLost&algorithm=SHA1&digits=6&period=30`,
    );
    expect((await h.services.auth.getCurrentUser())?.twoFactorEnabled).toBeFalsy();
    // chamar de novo troca o segredo pendente
    const again = await h.services.auth.setupTwoFactor();
    expect(again.secret).not.toBe(setup.secret);
  });

  it("enable: código errado é VALIDATION em fieldErrors.code; certo devolve 8 códigos de recuperação", async () => {
    const h = createHarness();
    await h.services.auth.signInAsDemo("user");
    await expectCode(h.services.auth.enableTwoFactor("123456"), "CONFLICT"); // sem setup
    const { secret } = await h.services.auth.setupTwoFactor();
    const wrong = await expectCode(h.services.auth.enableTwoFactor("000000"), "VALIDATION");
    expect(wrong.fieldErrors?.code).toBe("Código incorreto ou expirado.");
    await expectCode(h.services.auth.enableTwoFactor("abc"), "VALIDATION");
    const { recoveryCodes } = await h.services.auth.enableTwoFactor(totpCode(secret, h.clock())!);
    expect(recoveryCodes).toHaveLength(8);
    expect(recoveryCodes.every((c) => /^[a-z0-9]{5}-[a-z0-9]{5}$/.test(c))).toBe(true);
    expect((await h.services.auth.getCurrentUser())?.twoFactorEnabled).toBe(true);
    await expectCode(h.services.auth.setupTwoFactor(), "CONFLICT");
    await expectCode(h.services.auth.enableTwoFactor(totpCode(secret, h.clock())!), "CONFLICT");
  });

  it("exige sessão", async () => {
    const h = createHarness();
    await expectCode(h.services.auth.setupTwoFactor(), "UNAUTHENTICATED");
    await expectCode(h.services.auth.enableTwoFactor("123456"), "UNAUTHENTICATED");
    await expectCode(h.services.auth.disableTwoFactor({ code: "123456" }), "UNAUTHENTICATED");
  });

  it("disable: exige senha (conta com senha) e código; erra -> INVALID_CREDENTIALS e continua ligado; acerta -> desliga", async () => {
    const h = createHarness();
    await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    await expectCode(h.services.auth.disableTwoFactor({ password: DEMO_PASSWORD, code: "123456" }), "CONFLICT"); // não está ativo
    const { secret } = await enable2fa(h);
    h.advance(30_000);
    const code = totpCode(secret, h.clock())!;
    const e1 = await expectCode(h.services.auth.disableTwoFactor({ password: "errada-errada-1", code }), "INVALID_CREDENTIALS");
    expect(e1.fieldErrors?.password).toBeTruthy();
    await expectCode(h.services.auth.disableTwoFactor({ code }), "INVALID_CREDENTIALS"); // sem senha
    await expectCode(h.services.auth.disableTwoFactor({ password: DEMO_PASSWORD, code: "000000" }), "INVALID_CREDENTIALS");
    expect((await h.services.auth.getCurrentUser())?.twoFactorEnabled).toBe(true);
    await h.services.auth.disableTwoFactor({ password: DEMO_PASSWORD, code });
    expect((await h.services.auth.getCurrentUser())?.twoFactorEnabled).toBe(false);
  });

  it("disable aceita um código de recuperação no lugar do TOTP", async () => {
    const h = createHarness();
    await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    const { recoveryCodes } = await enable2fa(h);
    await h.services.auth.disableTwoFactor({ password: DEMO_PASSWORD, code: recoveryCodes[0].toUpperCase() });
    expect((await h.services.auth.getCurrentUser())?.twoFactorEnabled).toBe(false);
  });

  it("conta só-Google desliga só com o código (sem senha)", async () => {
    const h = createHarness();
    const google = { email: "externa@gmail.test", name: "Externa Gmail" };
    await h.services.auth.signInWithGoogle(googleCredential(google), { acceptedTerms: true });
    const { secret } = await enable2fa(h);
    h.advance(30_000);
    await h.services.auth.disableTwoFactor({ code: totpCode(secret, h.clock())! });
    expect((await h.services.auth.getCurrentUser())?.twoFactorEnabled).toBe(false);
  });
});

describe("login com 2FA", () => {
  async function accountWith2fa() {
    const h = createHarness();
    await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    const tf = await enable2fa(h);
    await h.services.auth.signOut();
    return { h, ...tf };
  }

  it("signIn devolve needs_2fa, SEM sessão; verify com TOTP abre a sessão", async () => {
    const { h, secret } = await accountWith2fa();
    const result = await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    expect(result.status).toBe("needs_2fa");
    if (result.status !== "needs_2fa") throw new Error();
    expect(result.challengeToken.length).toBeGreaterThan(10);
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    h.advance(30_000); // o passo do enable já foi consumido (anti-reuso)
    const user = await h.services.auth.verifyTwoFactor({ challengeToken: result.challengeToken, code: totpCode(secret, h.clock())! });
    expect(user.id).toBe("user-marina");
    expect((await h.services.auth.getCurrentUser())?.id).toBe("user-marina");
  });

  it("senha errada continua INVALID_CREDENTIALS (nem chega ao 2FA)", async () => {
    const { h } = await accountWith2fa();
    await expectCode(h.services.auth.signIn({ email: "marina@demo.test", password: "errada-errada-1" }), "INVALID_CREDENTIALS");
  });

  it("código errado: INVALID_CREDENTIALS com fieldErrors.code; sem sessão", async () => {
    const { h } = await accountWith2fa();
    const r = await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    if (r.status !== "needs_2fa") throw new Error();
    const e = await expectCode(h.services.auth.verifyTwoFactor({ challengeToken: r.challengeToken, code: "000000" }), "INVALID_CREDENTIALS");
    expect(e.fieldErrors?.code).toBe("Código incorreto ou expirado.");
    expect(await h.services.auth.getCurrentUser()).toBeNull();
  });

  it("não aceita reuso do mesmo código (passo já consumido)", async () => {
    const { h, secret } = await accountWith2fa();
    const first = await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    if (first.status !== "needs_2fa") throw new Error();
    h.advance(30_000);
    const code = totpCode(secret, h.clock())!;
    await h.services.auth.verifyTwoFactor({ challengeToken: first.challengeToken, code });
    await h.services.auth.signOut();
    const second = await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    if (second.status !== "needs_2fa") throw new Error();
    await expectCode(h.services.auth.verifyTwoFactor({ challengeToken: second.challengeToken, code }), "INVALID_CREDENTIALS");
    h.advance(30_000);
    await h.services.auth.verifyTwoFactor({ challengeToken: second.challengeToken, code: totpCode(secret, h.clock())! });
  });

  it("código de recuperação vale uma vez", async () => {
    const { h, recoveryCodes } = await accountWith2fa();
    const a = await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    if (a.status !== "needs_2fa") throw new Error();
    await h.services.auth.verifyTwoFactor({ challengeToken: a.challengeToken, recoveryCode: recoveryCodes[0] });
    await h.services.auth.signOut();
    const b = await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    if (b.status !== "needs_2fa") throw new Error();
    await expectCode(h.services.auth.verifyTwoFactor({ challengeToken: b.challengeToken, recoveryCode: recoveryCodes[0] }), "INVALID_CREDENTIALS");
    await h.services.auth.verifyTwoFactor({ challengeToken: b.challengeToken, recoveryCode: recoveryCodes[1].toUpperCase() });
  });

  it("desafio expira em 5 minutos, é inválido se forjado e exige código OU recuperação", async () => {
    const { h, secret } = await accountWith2fa();
    const r = await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    if (r.status !== "needs_2fa") throw new Error();
    await expectCode(h.services.auth.verifyTwoFactor({ challengeToken: "lixo", code: "123456" }), "UNAUTHENTICATED");
    await expectCode(h.services.auth.verifyTwoFactor({ challengeToken: r.challengeToken }), "VALIDATION");
    await expectCode(
      h.services.auth.verifyTwoFactor({ challengeToken: r.challengeToken, code: "123456", recoveryCode: "abcde-fghjk" }),
      "VALIDATION",
    );
    h.advance(5 * 60 * 1000 + 1000);
    await expectCode(h.services.auth.verifyTwoFactor({ challengeToken: r.challengeToken, code: totpCode(secret, h.clock())! }), "UNAUTHENTICATED");
  });

  it("Google: conta existente com 2FA também devolve needs_2fa", async () => {
    const h = createHarness();
    const google = { email: "externa@gmail.test", name: "Externa Gmail" };
    await h.services.auth.signInWithGoogle(googleCredential(google), { acceptedTerms: true });
    const { secret } = await enable2fa(h);
    await h.services.auth.signOut();
    const r = await h.services.auth.signInWithGoogle(googleCredential(google));
    expect(r.status).toBe("needs_2fa");
    if (r.status !== "needs_2fa") throw new Error();
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    h.advance(30_000);
    const user = await h.services.auth.verifyTwoFactor({ challengeToken: r.challengeToken, code: totpCode(secret, h.clock())! });
    expect(user.email).toBe(google.email);
  });

  it("signInAsDemo não passa pelo 2FA (atalho só do protótipo)", async () => {
    const { h } = await accountWith2fa();
    expect((await h.services.auth.signInAsDemo("user")).id).toBe("user-marina");
  });
});

describe("contas desativadas", () => {
  it("não entram (senha certa -> ACCOUNT_DISABLED, senha errada continua INVALID_CREDENTIALS); Google idem", async () => {
    const h = createHarness();
    await asAdmin(h);
    const users = await h.services.admin.listUsers({ q: "tiago" });
    expect(users.items[0]).toMatchObject({ id: "user-tiago", active: false, provider: "google" });
    // ativa a conta Google do Tiago para testar: reativa e desativa Marina (com senha)
    await h.services.admin.updateUser("user-marina", { active: false });
    await h.services.auth.signOut();
    await expectCode(h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD }), "ACCOUNT_DISABLED");
    await expectCode(h.services.auth.signIn({ email: "marina@demo.test", password: "errada-errada-1" }), "INVALID_CREDENTIALS");
    await expectCode(h.services.auth.signInWithGoogle(googleCredential({ email: "tiago@demo.test", name: "Tiago Rocha" })), "ACCOUNT_DISABLED");
  });

  it("desativar derruba a sessão que a pessoa já tinha (próxima chamada = sem sessão)", async () => {
    const h = createHarness();
    const marina = await h.services.auth.signInAsDemo("user"); // aba da Marina
    const adminTab = createHarness({ storage: h.storage });
    await adminTab.services.auth.signInAsDemo("admin");
    await adminTab.services.admin.updateUser(marina.id, { active: false });
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    await expectCode(h.services.claims.listMine(), "UNAUTHENTICATED");
    // reativar não restaura a sessão sozinha? Em aba nova a pessoa entra de novo
    await adminTab.services.admin.updateUser(marina.id, { active: true });
    expect((await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD })).status).toBe("signed_in");
  });

  it("2FA: conta desativada entre senha e código recebe ACCOUNT_DISABLED", async () => {
    const h = createHarness();
    await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    const { secret } = await enable2fa(h);
    await h.services.auth.signOut();
    const r = await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    if (r.status !== "needs_2fa") throw new Error();
    await asAdmin(h);
    await h.services.admin.updateUser("user-marina", { active: false });
    await h.services.auth.signOut();
    h.advance(30_000);
    await expectCode(h.services.auth.verifyTwoFactor({ challengeToken: r.challengeToken, code: totpCode(secret, h.clock())! }), "ACCOUNT_DISABLED");
  });
});

describe("administração de usuários", () => {
  it("só administração (FORBIDDEN) e logada (UNAUTHENTICATED)", async () => {
    const h = createHarness();
    await expectCode(h.services.admin.listUsers(), "UNAUTHENTICATED");
    await signInAsRafael(h.services);
    await expectCode(h.services.admin.listUsers(), "FORBIDDEN");
    await expectCode(h.services.admin.updateUser("user-marina", { role: "admin" }), "FORBIDDEN");
    await expectCode(h.services.admin.createInvite("x@demo.test"), "FORBIDDEN");
    await expectCode(h.services.admin.listInvites(), "FORBIDDEN");
    await expectCode(h.services.admin.revokeInvite("invite-01"), "FORBIDDEN");
    await expectCode(h.services.admin.listAuditLog(), "FORBIDDEN");
  });

  it("listUsers: filtros q/role/status, ordem e paginação; sem hash nem segredo", async () => {
    const h = createHarness();
    await asAdmin(h);
    const all = await h.services.admin.listUsers();
    expect(all).toMatchObject({ page: 1, pageSize: 20, total: 7, totalPages: 1 });
    expect(all.items.map((u) => u.id)).toEqual(
      expect.arrayContaining(["user-marina", "user-rafael", "user-admin", "user-externo", "user-lucas", "user-beatriz", "user-tiago"]),
    );
    expect(Object.keys(all.items[0]).sort()).toEqual(
      ["active", "affiliation", "createdAt", "disabledAt", "email", "emailVerified", "id", "name", "provider", "role", "twoFactorEnabled"].sort(),
    );
    const createdAts = all.items.map((u) => u.createdAt);
    expect([...createdAts].sort().reverse()).toEqual(createdAts);
    expect((await h.services.admin.listUsers({ q: "MARINA" })).items.map((u) => u.id)).toEqual(["user-marina"]);
    expect((await h.services.admin.listUsers({ q: "demo.test" })).total).toBe(7);
    expect((await h.services.admin.listUsers({ role: "admin" })).items.map((u) => u.id)).toEqual(["user-admin"]);
    expect((await h.services.admin.listUsers({ role: "user" })).total).toBe(6);
    expect((await h.services.admin.listUsers({ affiliation: "external" })).items.map((u) => u.id)).toEqual(["user-externo"]);
    expect((await h.services.admin.listUsers({ affiliation: "institutional" })).total).toBe(6);
    expect((await h.services.admin.listUsers({ affiliation: "institutional", role: "admin" })).items.map((u) => u.id)).toEqual(["user-admin"]);
    await expectCode(h.services.admin.listUsers({ affiliation: "x" as never }), "VALIDATION");
    expect((await h.services.admin.listUsers({ status: "disabled" })).items.map((u) => u.id)).toEqual(["user-tiago"]);
    expect((await h.services.admin.listUsers({ status: "active" })).total).toBe(6);
    const p2 = await h.services.admin.listUsers({ pageSize: 3, page: 3 });
    expect(p2).toMatchObject({ page: 3, pageSize: 3, total: 7, totalPages: 3 });
    expect(p2.items).toHaveLength(1);
    expect((await h.services.admin.listUsers({ pageSize: 3, page: 9 })).items).toEqual([]);
    await expectCode(h.services.admin.listUsers({ page: 0 }), "VALIDATION");
    await expectCode(h.services.admin.listUsers({ pageSize: 101 }), "VALIDATION");
    await expectCode(h.services.admin.listUsers({ role: "root" as never }), "VALIDATION");
    await expectCode(h.services.admin.listUsers({ status: "x" as never }), "VALIDATION");
  });

  it("updateUser: muda papel e estado; registra auditoria; ninguém altera a si mesmo", async () => {
    const h = createHarness();
    await asAdmin(h);
    const promoted = await h.services.admin.updateUser("user-lucas", { role: "admin" });
    expect(promoted).toMatchObject({ id: "user-lucas", role: "admin", affiliation: "institutional", active: true });
    const off = await h.services.admin.updateUser("user-lucas", { active: false });
    expect(off.active).toBe(false);
    expect(off.disabledAt).toBe(h.clock().toISOString());
    expect((await h.services.admin.updateUser("user-lucas", { active: true })).disabledAt).toBeNull();
    await expectCode(h.services.admin.updateUser("user-admin", { role: "user" }), "CONFLICT");
    await expectCode(h.services.admin.updateUser("user-admin", { active: false }), "CONFLICT");
    await expectCode(h.services.admin.updateUser("nao-existe", { active: false }), "NOT_FOUND");
    await expectCode(h.services.admin.updateUser("user-lucas", {}), "VALIDATION");
    await expectCode(h.services.admin.updateUser("user-lucas", { role: "root" as never }), "VALIDATION");
    await expectCode(h.services.admin.updateUser("user-lucas", { active: "sim" as never }), "VALIDATION");
    const log = await h.services.admin.listAuditLog({ action: "user.role_change" });
    expect(log.items[0]).toMatchObject({ actorId: "user-admin", actorName: "Administração Demo", targetId: "user-lucas", metadata: { from: "user", to: "admin" } });
  });

  it("admin convidado pode rebaixar/desativar a demo; o último admin ativo não pode ser tirado", async () => {
    const h = createHarness();
    const { user: second } = await newInvitedAdmin(h);
    // a nova admin não tem 2FA: o /admin/* exige antes
    await expectCode(h.services.admin.listUsers(), "TWO_FACTOR_REQUIRED");
    h.advance(30_000);
    await enable2fa(h);
    // com 2 admins ativos, desativa a demo
    await h.services.admin.updateUser("user-admin", { active: false });
    // agora a convidada é a única ativa: não pode (nem a si mesma)
    await expectCode(h.services.admin.updateUser(second.id, { active: false }), "CONFLICT");
    // reativa a demo e então rebaixa a demo: permitido; a outra continua admin
    await h.services.admin.updateUser("user-admin", { active: true });
    await h.services.admin.updateUser("user-admin", { role: "user" });
    const admins = await h.services.admin.listUsers({ role: "admin" });
    expect(admins.items.map((u) => u.id)).toEqual([second.id]);
  });

  it("conta excluída (LGPD) some da lista de usuários", async () => {
    const h = createHarness();
    await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    await h.services.auth.deleteMyAccount({ password: DEMO_PASSWORD });
    await asAdmin(h);
    const list = await h.services.admin.listUsers();
    expect(list.total).toBe(6);
    expect(list.items.some((u) => u.id === "user-marina")).toBe(false);
    await expectCode(h.services.admin.updateUser("user-marina", { active: false }), "NOT_FOUND");
  });
});

describe("2FA obrigatório para a administração", () => {
  it("admin demo é isento (como o backend em DEMO_MODE) e a isenção é configurável", async () => {
    const h = createHarness();
    await asAdmin(h);
    expect((await h.services.admin.listUsers()).total).toBeGreaterThan(0);
    const strict = createHarness({ twoFactorExemptUserIds: [] });
    await strict.services.auth.signInAsDemo("admin");
    await expectCode(strict.services.admin.listUsers(), "TWO_FACTOR_REQUIRED");
    await expectCode(strict.services.admin.listAuditLog(), "TWO_FACTOR_REQUIRED");
    await expectCode(strict.services.admin.createInvite("a@demo.test"), "TWO_FACTOR_REQUIRED");
    // ligar o 2FA libera
    await enable2fa(strict);
    expect((await strict.services.admin.listUsers()).total).toBeGreaterThan(0);
  });

  it("admin recém-convidado só acessa /admin/* depois de ligar o 2FA; rotas antigas do painel seguem livres", async () => {
    const h = createHarness();
    await newInvitedAdmin(h);
    await expectCode(h.services.admin.listAuditLog(), "TWO_FACTOR_REQUIRED");
    expect((await h.services.claims.listPending()).length).toBeGreaterThan(0);
    await enable2fa(h);
    expect((await h.services.admin.listAuditLog()).total).toBeGreaterThan(0);
  });
});

describe("convites de administração", () => {
  it("criar devolve devLink e dados do convite (sem token na lista); aceitar cria admin verificado, sem 2FA, e abre sessão", async () => {
    const h = createHarness();
    await asAdmin(h);
    const created = await h.services.admin.createInvite("  Nova@Demo.test ");
    expect(created).toMatchObject({ email: "nova@demo.test", status: "pending", invitedById: "user-admin" });
    expect(created.devLink).toMatch(/^\/aceitar-convite\?token=[0-9a-f]{64}$/);
    expect(new Date(created.expiresAt).getTime() - new Date(created.createdAt).getTime()).toBe(48 * 3600 * 1000);
    const listed = await h.services.admin.listInvites();
    expect(listed.items[0]).toEqual({ ...created, devLink: undefined });
    expect(JSON.stringify(listed)).not.toContain("token");

    const token = new URL(created.devLink!, "http://x.test").searchParams.get("token")!;
    await h.services.auth.signOut();
    const user = await h.services.auth.acceptInvite({ token, name: "Nova Admin", password: ADMIN_PW, acceptedTerms: true });
    expect(user).toMatchObject({ email: "nova@demo.test", role: "admin", emailVerified: true, twoFactorEnabled: false });
    expect((await h.services.auth.getCurrentUser())?.id).toBe(user.id);
    // pode entrar com a senha escolhida
    await h.services.auth.signOut();
    expect(userOf(await h.services.auth.signIn({ email: "nova@demo.test", password: ADMIN_PW })).id).toBe(user.id);
  });

  it("uso único: o mesmo link não funciona duas vezes; token desconhecido é TOKEN_INVALID", async () => {
    const h = createHarness();
    const { token } = await newInvitedAdmin(h);
    await h.services.auth.signOut();
    await expectCode(h.services.auth.acceptInvite({ token, name: "Outra Pessoa", password: ADMIN_PW }), "TOKEN_INVALID");
    await expectCode(h.services.auth.acceptInvite({ token: "x".repeat(32), name: "Outra Pessoa", password: ADMIN_PW }), "TOKEN_INVALID");
    await expectCode(h.services.auth.acceptInvite({ token: "", name: "Outra Pessoa", password: ADMIN_PW }), "TOKEN_INVALID");
  });

  it("valida nome e senha (política) sem gastar o convite", async () => {
    const h = createHarness();
    await asAdmin(h);
    const created = await h.services.admin.createInvite("nova@demo.test");
    const token = new URL(created.devLink!, "http://x.test").searchParams.get("token")!;
    await h.services.auth.signOut();
    const e = await expectCode(h.services.auth.acceptInvite({ token, name: "N", password: "curta" }), "VALIDATION");
    expect(e.fieldErrors?.name).toBeTruthy();
    expect(e.fieldErrors?.password).toBeTruthy();
    const same = await expectCode(h.services.auth.acceptInvite({ token, name: "Nova Admin", password: "nova@demo.test" }), "VALIDATION");
    expect(same.fieldErrors?.password).toBeTruthy();
    await h.services.auth.acceptInvite({ token, name: "Nova Admin", password: ADMIN_PW });
  });

  it("expira em 48 h; revogado e reemitido para o mesmo e-mail invalidam o anterior", async () => {
    const h = createHarness();
    await asAdmin(h);
    const first = await h.services.admin.createInvite("nova@demo.test");
    const second = await h.services.admin.createInvite("nova@demo.test");
    const list = await h.services.admin.listInvites();
    expect(list.items.find((i) => i.id === first.id)?.status).toBe("revoked");
    expect(list.items.find((i) => i.id === second.id)?.status).toBe("pending");
    const t1 = new URL(first.devLink!, "http://x.test").searchParams.get("token")!;
    const t2 = new URL(second.devLink!, "http://x.test").searchParams.get("token")!;
    await h.services.auth.signOut();
    await expectCode(h.services.auth.acceptInvite({ token: t1, name: "Nova Admin", password: ADMIN_PW }), "TOKEN_INVALID");
    h.advance(48 * 3600 * 1000);
    await expectCode(h.services.auth.acceptInvite({ token: t2, name: "Nova Admin", password: ADMIN_PW }), "TOKEN_INVALID");
    await asAdmin(h);
    expect((await h.services.admin.listInvites()).items.find((i) => i.id === second.id)?.status).toBe("expired");
  });

  it("revogar é idempotente; aceito não revoga (CONFLICT); inexistente é NOT_FOUND", async () => {
    const h = createHarness();
    await asAdmin(h);
    const created = await h.services.admin.createInvite("nova@demo.test");
    await h.services.admin.revokeInvite(created.id);
    await h.services.admin.revokeInvite(created.id);
    expect((await h.services.admin.listInvites()).items.find((i) => i.id === created.id)?.status).toBe("revoked");
    await expectCode(h.services.admin.revokeInvite("nao-existe"), "NOT_FOUND");
    const again = await h.services.admin.createInvite("outra@demo.test");
    const token = new URL(again.devLink!, "http://x.test").searchParams.get("token")!;
    await h.services.auth.signOut();
    await h.services.auth.acceptInvite({ token, name: "Outra Admin", password: ADMIN_PW });
    await asAdmin(h);
    await expectCode(h.services.admin.revokeInvite(again.id), "CONFLICT");
    expect((await h.services.admin.listInvites()).items.find((i) => i.id === again.id)?.status).toBe("accepted");
  });

  it("e-mail já cadastrado: EMAIL_TAKEN na criação e no aceite (cadastro depois do convite)", async () => {
    const h = createHarness();
    await asAdmin(h);
    await expectCode(h.services.admin.createInvite("marina@demo.test"), "EMAIL_TAKEN");
    await expectCode(h.services.admin.createInvite("nao-e-email"), "VALIDATION");
    const created = await h.services.admin.createInvite("tarde@demo.test");
    const token = new URL(created.devLink!, "http://x.test").searchParams.get("token")!;
    await h.services.auth.signOut();
    await h.services.auth.signUp({ name: "Quem Chegou", email: "tarde@demo.test", password: PW, acceptedTerms: true });
    await h.services.auth.signOut();
    await expectCode(h.services.auth.acceptInvite({ token, name: "Nova Admin", password: ADMIN_PW }), "EMAIL_TAKEN");
  });

  it("a seed traz convites antigos (expirado e revogado) para a tela mostrar estados", async () => {
    const h = createHarness();
    await asAdmin(h);
    const statuses = (await h.services.admin.listInvites()).items.map((i) => i.status).sort();
    expect(statuses).toEqual(["expired", "revoked"]);
    const paged = await h.services.admin.listInvites({ page: 2, pageSize: 1 });
    expect(paged).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
  });
});

describe("trilha de auditoria", () => {
  it("a seed já mostra eventos; filtros por ação e ator; mais recentes primeiro; paginação", async () => {
    const h = createHarness();
    await asAdmin(h);
    const all = await h.services.admin.listAuditLog();
    expect(all.total).toBeGreaterThanOrEqual(8);
    const ats = all.items.map((e) => e.at);
    expect([...ats].sort().reverse()).toEqual(ats);
    expect(all.items.every((e) => e.ip === null)).toBe(true);
    expect((await h.services.admin.listAuditLog({ action: "return.register" })).total).toBe(2);
    expect((await h.services.admin.listAuditLog({ action: "nada" })).total).toBe(0);
    const byActor = await h.services.admin.listAuditLog({ actor: "user-admin" });
    expect(byActor.items.every((e) => e.actorId === "user-admin" && e.actorName === "Administração Demo")).toBe(true);
    expect((await h.services.admin.listAuditLog({ pageSize: 2, page: 2 })).items).toHaveLength(2);
    await expectCode(h.services.admin.listAuditLog({ pageSize: 0 }), "VALIDATION");
  });

  it("registra login, falha, cadastro, decisões, devolução, exclusão, convite e 2FA", async () => {
    const h = createHarness();
    await h.services.auth.signUp({ name: "Carla Dias", email: "carla@demo.test", password: PW, acceptedTerms: true });
    await h.services.auth.signOut();
    await expectCode(h.services.auth.signIn({ email: "carla@demo.test", password: "errada-errada-1" }), "INVALID_CREDENTIALS");
    await h.services.auth.signIn({ email: "carla@demo.test", password: PW });
    await h.services.auth.signInAsDemo("admin");
    await h.services.claims.accept("claim-01");
    await h.services.claims.reject("claim-06");
    await h.services.returns.register("item-03");
    await h.services.items.create({ ...validItem });
    await h.services.items.delete("item-01");
    await h.services.admin.createInvite("nova@demo.test");
    await enable2fa(h);
    await h.services.auth.signOut();

    await asAdmin(h);
    const actions = new Set((await h.services.admin.listAuditLog({ pageSize: 100 })).items.map((e) => e.action));
    for (const action of [
      "signup", "login.success", "login.failure", "logout", "claim.accept", "claim.reject", "return.register",
      "item.delete", "invite.create", "2fa.enable",
    ]) {
      expect(actions, action).toContain(action);
    }
    const del = (await h.services.admin.listAuditLog({ action: "item.delete" })).items[0];
    expect(del).toMatchObject({ targetType: "item", targetId: "item-01", metadata: { title: "Fones de ouvido sem fio", status: "available" } });
    const accept = (await h.services.admin.listAuditLog({ action: "claim.accept" })).items[0];
    expect(accept.metadata).toMatchObject({ itemId: "item-03", autoRejected: 1 });
    const failure = (await h.services.admin.listAuditLog({ action: "login.failure" })).items[0];
    expect(failure.metadata).toMatchObject({ method: "password" });
    expect((failure.metadata as { emailRef: string }).emailRef).toMatch(/^[0-9a-f]{12}$/);
  });

  it("registra desativação, papel, 2FA incorreto, convite aceito/revogado e exclusão de conta", async () => {
    const h = createHarness();
    await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    await h.services.auth.setupTwoFactor();
    await expectCode(h.services.auth.enableTwoFactor("000000"), "VALIDATION");
    await h.services.auth.deleteMyAccount({ password: DEMO_PASSWORD });
    await asAdmin(h);
    await h.services.admin.updateUser("user-lucas", { active: false });
    await h.services.admin.updateUser("user-lucas", { active: true });
    const created = await h.services.admin.createInvite("nova@demo.test");
    await h.services.admin.revokeInvite(created.id);
    const actions = new Set((await h.services.admin.listAuditLog({ pageSize: 100 })).items.map((e) => e.action));
    for (const a of ["account.delete", "2fa.failure", "user.disable", "user.enable", "invite.revoke"]) expect(actions, a).toContain(a);
  });

  it("NUNCA guarda senha, token, segredo TOTP nem código (varre o JSON inteiro da trilha)", async () => {
    const h = createHarness();
    await h.services.auth.signUp({ name: "Carla Dias", email: "carla@demo.test", password: PW, acceptedTerms: true });
    await expectCode(h.services.auth.signIn({ email: "carla@demo.test", password: "segredo-digitado-no-campo-errado" }), "INVALID_CREDENTIALS");
    const { secret, recoveryCodes } = await enable2fa(h);
    await h.services.auth.signOut();
    const r = await h.services.auth.signIn({ email: "carla@demo.test", password: PW });
    if (r.status !== "needs_2fa") throw new Error();
    await expectCode(h.services.auth.verifyTwoFactor({ challengeToken: r.challengeToken, code: "111111" }), "INVALID_CREDENTIALS");
    h.advance(30_000);
    const typedCode = totpCode(secret, h.clock())!;
    await h.services.auth.verifyTwoFactor({ challengeToken: r.challengeToken, code: typedCode });
    await h.services.auth.disableTwoFactor({ password: PW, code: recoveryCodes[0] });
    await asAdmin(h);
    const invite = await h.services.admin.createInvite("nova@demo.test");
    const token = new URL(invite.devLink!, "http://x.test").searchParams.get("token")!;
    const dump = JSON.stringify((await h.services.admin.listAuditLog({ pageSize: 100 })).items);
    for (const secretText of [PW, "segredo-digitado-no-campo-errado", secret, typedCode, "111111", token, r.challengeToken, ...recoveryCodes]) {
      expect(dump).not.toContain(secretText);
    }
    expect(dump).not.toContain("carla@demo.test"); // e-mail digitado vira só emailRef
    expect(dump.toLowerCase()).not.toMatch(/"(password|secret|token|code|hash)[a-z]*"\s*:/);
  });

  it("o mock guarda só os eventos mais recentes (limite)", async () => {
    const h = createHarness();
    await asAdmin(h);
    for (let i = 0; i < 520; i++) await h.services.auth.signInAsDemo("admin");
    expect((await h.services.admin.listAuditLog({ pageSize: 1 })).total).toBe(500);
  });
});

describe("2FA nas rotas administrativas antigas", () => {
  const strictAdmin = async () => {
    const h = createHarness({ twoFactorExemptUserIds: [] });
    await h.services.auth.signInAsDemo("admin");
    return h;
  };

  it("sem 2FA (e não isento): aceitar, recusar, excluir item, registrar e listar devoluções -> TWO_FACTOR_REQUIRED", async () => {
    const h = await strictAdmin();
    await expectCode(h.services.claims.accept("claim-01"), "TWO_FACTOR_REQUIRED");
    await expectCode(h.services.claims.reject("claim-01"), "TWO_FACTOR_REQUIRED");
    await expectCode(h.services.items.delete("item-01"), "TWO_FACTOR_REQUIRED");
    await expectCode(h.services.returns.register("item-05"), "TWO_FACTOR_REQUIRED");
    await expectCode(h.services.returns.list(), "TWO_FACTOR_REQUIRED");
  });

  it("nada foi alterado pelas tentativas barradas; leituras e edição de item seguem livres (como no backend)", async () => {
    const h = await strictAdmin();
    await expectCode(h.services.claims.accept("claim-01"), "TWO_FACTOR_REQUIRED");
    await expectCode(h.services.items.delete("item-01"), "TWO_FACTOR_REQUIRED");
    expect((await h.services.claims.listPending()).some((c) => c.id === "claim-01")).toBe(true);
    expect((await h.services.items.get("item-01")).item.id).toBe("item-01");
    await h.services.items.update("item-01", { ...validItem });
  });

  it("depois de ligar o 2FA as mesmas operações funcionam", async () => {
    const h = await strictAdmin();
    await enable2fa(h);
    expect((await h.services.claims.accept("claim-01")).claim.status).toBe("accepted");
    expect((await h.services.returns.list()).length).toBeGreaterThan(0);
    await h.services.items.delete("item-01");
  });

  it("não-admin continua FORBIDDEN (não vira TWO_FACTOR_REQUIRED); admin demo isento segue normal", async () => {
    const h = createHarness({ twoFactorExemptUserIds: [] });
    await signInAsRafael(h.services);
    await expectCode(h.services.claims.accept("claim-01"), "FORBIDDEN");
    await expectCode(h.services.items.delete("item-01"), "FORBIDDEN");
    await expectCode(h.services.returns.list(), "FORBIDDEN");
    const demo = createHarness();
    await demo.services.auth.signInAsDemo("admin");
    expect((await demo.services.returns.list()).length).toBeGreaterThan(0);
  });
});
