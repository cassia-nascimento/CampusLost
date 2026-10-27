/** Verificação de e-mail, redefinição de senha, exportação/exclusão de conta e papel externo (mock). */
import { describe, expect, it } from "vitest";
import { DB_KEY } from "./store";
import { DEMO_PASSWORD } from "./seed";
import { createHarness, expectCode, validClaim, validItem, type Harness, signInAsRafael, userOf } from "./test-utils";

const PW = "uma senha longa 1";
const base = { name: "Carla Dias", email: "carla@demo.test", password: PW, acceptedTerms: true as const };
const HOUR = 3_600_000;

const tokenOf = (link?: string) => new URL(link ?? "", "http://x").searchParams.get("token") ?? "";

async function signUp(h: Harness, over: Partial<typeof base> = {}) {
  const user = await h.services.auth.signUp({ ...base, ...over });
  const mail = await h.services.auth.peekSimulatedEmail?.();
  return { user, token: tokenOf(mail?.devLink) };
}

describe("cadastro por senha: conta nasce não verificada", () => {
  it("emailVerified=false, e-mail simulado com link /verificar-email", async () => {
    const h = createHarness();
    const { user, token } = await signUp(h);
    expect(user.emailVerified).toBe(false);
    const mail = await h.services.auth.peekSimulatedEmail?.();
    expect(mail?.kind).toBe("verify_email");
    expect(mail?.devLink).toMatch(/^\/verificar-email\?token=[0-9a-f]{32}$/);
    expect(token).toHaveLength(32);
  });

  it("cadastro: termos obrigatórios; conta nasce user; um `role` enviado (admin) é ignorado", async () => {
    const h = createHarness();
    await expectCode(h.services.auth.signUp({ ...base, acceptedTerms: false as never }), "VALIDATION");
    const user = await h.services.auth.signUp({ ...base, role: "admin" } as never);
    expect(user.role).toBe("user");
    expect(user.affiliation).toBe("external"); // demo.test não é domínio institucional
    // nenhuma conta do banco ganhou papel admin além da administração do seed
    const admins = (await h.services.auth.signInAsDemo("admin")) && (await h.services.admin.listUsers({ role: "admin" }));
    expect(admins.items.map((u) => u.id)).toEqual(["user-admin"]);
  });

  it("vínculo vem só do domínio do e-mail no cadastro: domínio e subdomínio institucionais; parecidos não", async () => {
    const cases: [string, "institutional" | "external"][] = [
      ["ana@undb.edu.br", "institutional"],
      ["ana@ALUNOS.UNDB.edu.br", "institutional"],
      ["ana@evilundb.edu.br", "external"],
      ["ana@undb.edu.br.evil.com", "external"],
      ["ana@gmail.com", "external"],
    ];
    for (const [email, affiliation] of cases) {
      const h = createHarness();
      const user = await h.services.auth.signUp({ ...base, email });
      expect(user.affiliation, email).toBe(affiliation);
    }
    const custom = createHarness({ allowedGoogleDomains: ["demo.test"] });
    expect((await custom.services.auth.signUp({ ...base })).affiliation).toBe("institutional");
  });

  it("política de senha: comum, igual ao e-mail e longa demais (bytes) são recusadas", async () => {
    const h = createHarness();
    for (const password of ["senha12345", "carla@demo.test", "é".repeat(37)]) {
      const err = await expectCode(h.services.auth.signUp({ ...base, password }), "VALIDATION");
      expect(err.fieldErrors?.password).toBeTruthy();
    }
  });

  it("não verificada NÃO cadastra item nem reivindica (EMAIL_NOT_VERIFIED); leitura segue livre", async () => {
    const h = createHarness();
    await signUp(h);
    await expectCode(h.services.items.create(validItem), "EMAIL_NOT_VERIFIED");
    await expectCode(h.services.claims.create("item-01", validClaim), "EMAIL_NOT_VERIFIED");
    const detail = await h.services.items.get("item-01");
    expect(detail.viewer.claim).toMatchObject({ allowed: false, code: "EMAIL_NOT_VERIFIED" });
    expect((await h.services.items.list()).length).toBeGreaterThan(0);
    expect(await h.services.claims.listMine()).toEqual([]);
  });
});

describe("verifyEmail / resendVerification", () => {
  it("token válido verifica e libera cadastrar item e reivindicar; é de uso único", async () => {
    const h = createHarness();
    const { token } = await signUp(h);
    await h.services.auth.verifyEmail(token);
    expect((await h.services.auth.getCurrentUser())?.emailVerified).toBe(true);
    expect(await h.services.auth.peekSimulatedEmail?.()).toBeNull();
    expect((await h.services.items.create(validItem)).status).toBe("available");
    expect((await h.services.claims.create("item-01", validClaim)).status).toBe("pending");
    await expectCode(h.services.auth.verifyEmail(token), "TOKEN_INVALID");
  });

  it("funciona sem sessão (link aberto em outra aba/dispositivo)", async () => {
    const h = createHarness();
    const { user, token } = await signUp(h);
    await h.services.auth.signOut();
    await h.services.auth.verifyEmail(token);
    expect(user.emailVerified).toBe(false); // o objeto antigo não muda; a releitura traz o novo valor
    await h.services.auth.signIn({ email: base.email, password: PW });
    expect((await h.services.auth.getCurrentUser())?.emailVerified).toBe(true);
  });

  it("token inexistente/vazio: TOKEN_INVALID / VALIDATION; expirado após 24 h: TOKEN_EXPIRED", async () => {
    const h = createHarness();
    const { token } = await signUp(h);
    await expectCode(h.services.auth.verifyEmail("naoexiste"), "TOKEN_INVALID");
    await expectCode(h.services.auth.verifyEmail(""), "VALIDATION");
    h.advance(24 * HOUR + 1000);
    await expectCode(h.services.auth.verifyEmail(token), "TOKEN_EXPIRED");
    expect((await h.services.auth.getCurrentUser())?.emailVerified).toBe(false);
    expect(await h.services.auth.peekSimulatedEmail?.()).toBeNull();
  });

  it("reenviar gera link novo e invalida o anterior; verificada não recebe link; sem sessão: UNAUTHENTICATED", async () => {
    const h = createHarness();
    const { token: first } = await signUp(h);
    const { devLink } = await h.services.auth.resendVerification();
    const second = tokenOf(devLink);
    expect(second).toHaveLength(32);
    expect(second).not.toBe(first);
    await expectCode(h.services.auth.verifyEmail(first), "TOKEN_INVALID");
    await h.services.auth.verifyEmail(second);
    expect(await h.services.auth.resendVerification()).toEqual({});
    await h.services.auth.signOut();
    await expectCode(h.services.auth.resendVerification(), "UNAUTHENTICATED");
  });

  it("tokens persistem no banco (localStorage) e ficam fora das visões de usuário", async () => {
    const h = createHarness();
    const { user, token } = await signUp(h);
    const db = JSON.parse(h.storage.getItem(DB_KEY)!);
    expect(db.tokens).toEqual([expect.objectContaining({ token, userId: user.id, kind: "verify_email" })]);
    expect(JSON.stringify(user)).not.toContain(token);
  });
});

describe("forgotPassword / resetPassword", () => {
  it("gera link de redefinição; nova senha entra e a antiga deixa de valer; link é de uso único", async () => {
    const h = createHarness();
    await signUp(h);
    await h.services.auth.signOut();
    const { devLink } = await h.services.auth.forgotPassword(" CARLA@demo.test ");
    expect(devLink).toMatch(/^\/redefinir-senha\?token=/);
    const token = tokenOf(devLink);
    await h.services.auth.resetPassword(token, "outra senha longa 2");
    await expectCode(h.services.auth.signIn({ email: base.email, password: PW }), "INVALID_CREDENTIALS");
    expect(userOf(await h.services.auth.signIn({ email: base.email, password: "outra senha longa 2" })).email).toBe(base.email);
    await expectCode(h.services.auth.resetPassword(token, "mais uma senha 33"), "TOKEN_INVALID");
  });

  it("e-mail desconhecido ou conta só-Google: sucesso silencioso, sem link (não revela a conta)", async () => {
    const h = createHarness();
    expect(await h.services.auth.forgotPassword("ninguem@demo.test")).toEqual({});
    await h.services.auth.signInWithGoogle(JSON.stringify({ email: "so.google@gmail.com", name: "So Google" }));
    await h.services.auth.signOut();
    expect(await h.services.auth.forgotPassword("so.google@gmail.com")).toEqual({});
    expect(await h.services.auth.forgotPassword("marina@demo.test")).toEqual({ devLink: expect.any(String) });
    await expectCode(h.services.auth.forgotPassword("nao-e-email"), "VALIDATION");
  });

  it("novo pedido invalida o link anterior; link expira em 1 h", async () => {
    const h = createHarness();
    const a = tokenOf((await h.services.auth.forgotPassword("marina@demo.test")).devLink);
    const b = tokenOf((await h.services.auth.forgotPassword("marina@demo.test")).devLink);
    await expectCode(h.services.auth.resetPassword(a, "outra senha longa 2"), "TOKEN_INVALID");
    h.advance(HOUR + 1000);
    await expectCode(h.services.auth.resetPassword(b, "outra senha longa 2"), "TOKEN_EXPIRED");
  });

  it("senha nova passa pela política e, se recusada, o link continua válido", async () => {
    const h = createHarness();
    const token = tokenOf((await h.services.auth.forgotPassword("marina@demo.test")).devLink);
    const err = await expectCode(h.services.auth.resetPassword(token, "senha12345"), "VALIDATION");
    expect(err.fieldErrors?.password).toBeTruthy();
    await h.services.auth.resetPassword(token, "outra senha longa 2");
  });

  it("token de verificação não serve para redefinir senha", async () => {
    const h = createHarness();
    const { token } = await signUp(h);
    await expectCode(h.services.auth.resetPassword(token, "outra senha longa 2"), "TOKEN_INVALID");
  });
});

describe("exportMyData / deleteMyAccount", () => {
  it("exporta só os dados do usuário atual; exige sessão", async () => {
    const h = createHarness();
    await expectCode(h.services.auth.exportMyData(), "UNAUTHENTICATED");
    await h.services.auth.signInAsDemo("institutional");
    const data = await h.services.auth.exportMyData();
    expect(data.format).toBe("campuslost-export-v1");
    expect(data.account).toMatchObject({ id: "user-marina", provider: "password", role: "user", affiliation: "institutional" });
    expect(data.itemsRegistered.length).toBeGreaterThan(0);
    expect(data.itemsRegistered.every((i) => i.createdById === "user-marina")).toBe(true);
    expect(data.claims.every((c) => "itemTitle" in c)).toBe(true);
    expect(data.sessions).toEqual([]);
    expect(data.claims.length).toBeGreaterThan(0);
    expect(data.claims.every((c) => c.claimantId === "user-marina")).toBe(true);
    expect(data.exportedAt).toBe(h.clock().toISOString());
    expect(JSON.stringify(data)).not.toMatch(/hash|salt/);
  });

  it("excluir exige a senha (conta por senha); errada não apaga; certa apaga, encerra a sessão e libera o e-mail", async () => {
    const h = createHarness();
    await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    await expectCode(h.services.auth.deleteMyAccount(), "INVALID_CREDENTIALS");
    await expectCode(h.services.auth.deleteMyAccount({ password: "errada errada 1" }), "INVALID_CREDENTIALS");
    expect(await h.services.auth.getCurrentUser()).not.toBeNull();
    await h.services.auth.deleteMyAccount({ password: DEMO_PASSWORD });
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    await expectCode(h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD }), "INVALID_CREDENTIALS");
    const db = JSON.parse(h.storage.getItem(DB_KEY)!);
    expect(db.credentials.some((c: { userId: string }) => c.userId === "user-marina")).toBe(false);
    const row = db.users.find((u: { id: string }) => u.id === "user-marina");
    expect(row).toMatchObject({ name: "Usuário removido", email: "removido-user-marina@excluido.invalid", emailVerified: false });
    // reivindicações ficam, mas encerradas e com o texto apagado
    const claims = db.claims.filter((c: { claimantId: string }) => c.claimantId === "user-marina");
    expect(claims.length).toBeGreaterThan(0);
    for (const c of claims) {
      expect(c.proofDetails).toContain("removido");
      expect(c.lostWhereWhen).toContain("removido");
      expect(["rejected"]).toContain(c.status === "accepted" || c.status === "pending" ? "active" : "rejected");
    }
    // o e-mail volta a ficar livre
    const again = await h.services.auth.signUp({ ...base, email: "marina@demo.test", name: "Nova Marina" });
    expect(again.email).toBe("marina@demo.test");
  });

  it("itens do usuário removido ficam, com o autor anonimizado (\"Usuário removido\")", async () => {
    const h = createHarness();
    await signInAsRafael(h.services); // Rafael registrou o item-01
    await h.services.auth.deleteMyAccount({ password: DEMO_PASSWORD });
    await h.services.auth.signInAsDemo("admin");
    const detail = await h.services.items.get("item-01");
    expect(detail.item.createdById).toBe("user-rafael");
    expect(detail.createdBy).toMatchObject({ id: "user-rafael", name: "Usuário removido" });
  });

  it("conta Google (sem senha) exclui sem senha; a única administração não se exclui; sem sessão: UNAUTHENTICATED", async () => {
    const h = createHarness();
    await expectCode(h.services.auth.deleteMyAccount(), "UNAUTHENTICATED");
    await h.services.auth.signInAsDemo("admin");
    // única conta de administração: CONFLICT (como na API)
    await expectCode(h.services.auth.deleteMyAccount({ password: DEMO_PASSWORD }), "CONFLICT");
    await h.services.auth.signOut();
    const email = "pessoa@gmail.com";
    const cred = JSON.stringify({ email, name: "Pessoa Externa" });
    const g = await h.services.auth.signInWithGoogle(cred, { acceptedTerms: true });
    expect(g.status === "signed_in" && g.user.hasPassword).toBe(false);
    // só-Google: a senha não serve; precisa de uma credencial Google DO MESMO e-mail
    await expectCode(h.services.auth.deleteMyAccount(), "INVALID_CREDENTIALS");
    await expectCode(h.services.auth.deleteMyAccount({ password: DEMO_PASSWORD }), "INVALID_CREDENTIALS");
    await expectCode(h.services.auth.deleteMyAccount({ credential: JSON.stringify({ email: "outra@gmail.com", name: "X" }) }), "INVALID_CREDENTIALS");
    expect(await h.services.auth.getCurrentUser()).not.toBeNull();
    await h.services.auth.deleteMyAccount({ credential: cred });
    expect(await h.services.auth.getCurrentUser()).toBeNull();
  });

  it("excluir a conta de quem reivindicou devolve o item a Disponível se não restar reivindicação ativa", async () => {
    const h = createHarness();
    await h.services.auth.signInAsDemo("institutional"); // Marina: item-05 aceita; item-06/07 pendentes
    const mine = await h.services.claims.listMine();
    const pendingOnly = mine.find((c) => c.status === "pending" && c.item.status === "under_claim");
    expect(pendingOnly).toBeDefined();
    await h.services.auth.deleteMyAccount({ password: DEMO_PASSWORD });
    await h.services.auth.signInAsDemo("admin");
    const detail = await h.services.items.get(pendingOnly!.itemId);
    const activeLeft = detail.claims.some((c) => c.status === "pending" || c.status === "accepted");
    expect(detail.item.status).toBe(activeLeft ? "under_claim" : "available");
  });
});

describe("papel external (seed)", () => {
  it("externo@demo.test é verificado, tem perfil de demonstração e age como aluno/professor", async () => {
    const h = createHarness();
    const user = userOf(await h.services.auth.signIn({ email: "externo@demo.test", password: DEMO_PASSWORD }));
    expect(user).toMatchObject({ role: "user", affiliation: "external", emailVerified: true });
    const created = await h.services.items.create(validItem);
    expect(created.createdById).toBe(user.id);
    const claim = await h.services.claims.create("item-01", validClaim);
    expect(claim.claimantId).toBe(user.id);
    expect((await h.services.claims.listMine()).map((c) => c.id)).toContain(claim.id);
    await expectCode(h.services.claims.listPending(), "FORBIDDEN");
    expect((await h.services.auth.signInAsDemo("external")).id).toBe(user.id);
  });
});
