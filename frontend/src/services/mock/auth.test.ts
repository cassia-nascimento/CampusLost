import { describe, expect, it } from "vitest";
import { PASSWORD_ISSUE_MESSAGE } from "@/lib/rules";
import { createMockServices } from "./index";
import { hashPassword } from "./password";
import { buildSeed, DB_VERSION, DEMO_PASSWORD, demoSalt } from "./seed";
import { DB_KEY, MockStore } from "./store";
import { createMemoryStorage } from "./storage";
import { createHarness, expectCode, googleCredential, googleTicket, TEST_NOW, userOf } from "./test-utils";

const PW = "senha-segura-1";
const google = { email: "Ana.Lima@alunos.UNDB.edu.br", name: "  Ana Lima " };

describe("senha (P29)", () => {
  it("cadastro com senha abre sessão e permite entrar depois com a mesma senha", async () => {
    const h = createHarness();
    const u = await h.services.auth.signUp({ name: "Carla Dias", email: "carla@demo.test", password: PW, role: "student", acceptedTerms: true });
    await h.services.auth.signOut();
    expect(userOf(await h.services.auth.signIn({ email: "CARLA@demo.test", password: PW })).id).toBe(u.id);
    expect((await h.services.auth.getCurrentUser())?.id).toBe(u.id);
  });

  it("cadastro rejeita senha curta/longa/ausente com fieldErrors.password", async () => {
    const h = createHarness();
    const base = { name: "Carla Dias", email: "carla@demo.test", role: "student" as const, acceptedTerms: true as const };
    for (const [password, msg] of [
      ["123456789", "Use pelo menos 10 caracteres."],
      ["a".repeat(73), PASSWORD_ISSUE_MESSAGE.too_long],
      ["senha12345", PASSWORD_ISSUE_MESSAGE.common],
      ["", "Crie uma senha."],
    ] as const) {
      const err = await expectCode(h.services.auth.signUp({ ...base, password }), "VALIDATION");
      expect(err.fieldErrors?.password).toBe(msg);
    }
    expect(await h.services.auth.getCurrentUser()).toBeNull();
  });

  it("senha errada, e-mail inexistente e senha vazia: INVALID_CREDENTIALS/VALIDATION; sem sessão", async () => {
    const h = createHarness();
    const a = await expectCode(h.services.auth.signIn({ email: "marina@demo.test", password: "demonstracao124" }), "INVALID_CREDENTIALS");
    const b = await expectCode(h.services.auth.signIn({ email: "nao@existe.test", password: "demonstracao123" }), "INVALID_CREDENTIALS");
    expect(a.message).toBe("E-mail ou senha incorretos.");
    expect(b.message).toBe(a.message);
    expect(a.fieldErrors).toBeUndefined();
    const v = await expectCode(h.services.auth.signIn({ email: "marina@demo.test", password: "" }), "VALIDATION");
    expect(v.fieldErrors?.password).toBe("Informe sua senha.");
    expect(await h.services.auth.getCurrentUser()).toBeNull();
  });

  it("a senha é sensível a maiúsculas e a espaços", async () => {
    const h = createHarness();
    await expectCode(h.services.auth.signIn({ email: "marina@demo.test", password: "DEMONSTRACAO123" }), "INVALID_CREDENTIALS");
    await expectCode(h.services.auth.signIn({ email: "marina@demo.test", password: " demonstracao123" }), "INVALID_CREDENTIALS");
  });

  it("as 6 contas de demonstração entram com DEMO_PASSWORD; perfis de um toque seguem sem senha", async () => {
    expect(DEMO_PASSWORD).toBe("demonstracao123");
    const h = createHarness();
    for (const email of ["marina", "rafael", "admin", "lucas", "beatriz", "externo"]) {
      const user = userOf(await h.services.auth.signIn({ email: `${email}@demo.test`, password: DEMO_PASSWORD }));
      expect(user.email).toBe(`${email}@demo.test`);
    }
    expect((await h.services.auth.signInAsDemo("admin")).role).toBe("admin");
  });

  it("hashes do seed conferem com PBKDF2 de DEMO_PASSWORD e são determinísticos", async () => {
    const db = buildSeed(TEST_NOW);
    expect(buildSeed(TEST_NOW).credentials).toEqual(db.credentials);
    expect(db.credentials).toHaveLength(db.users.length);
    const withPassword = db.credentials.filter((c) => c.provider === "password");
    expect(db.credentials.filter((c) => c.provider === "google").map((c) => c.userId)).toEqual(["user-tiago"]);
    for (const c of withPassword) {
      expect(c.salt).toBe(demoSalt(c.userId));
      expect(await hashPassword(DEMO_PASSWORD, c.salt!, c.iterations)).toBe(c.hash);
    }
    expect(new Set(withPassword.map((c) => c.hash)).size).toBe(withPassword.length);
  });

  it("senha guardada só como hash com sal aleatório por usuário", async () => {
    const h = createHarness();
    await h.services.auth.signUp({ name: "Carla Dias", email: "carla@demo.test", password: PW, role: "student", acceptedTerms: true });
    await h.services.auth.signUp({ name: "Dora Dias", email: "dora@demo.test", password: PW, role: "student", acceptedTerms: true });
    const raw = h.storage.getItem(DB_KEY)!;
    expect(raw).not.toContain(PW);
    const db = JSON.parse(raw);
    const [c, d] = db.credentials.slice(-2);
    expect(c.salt).not.toBe(d.salt);
    expect(c.hash).not.toBe(d.hash);
    expect(c.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(c.iterations).toBe(100_000);
  });

  it("hash/sal/senha não aparecem em nada devolvido à UI", async () => {
    const h = createHarness();
    const out: unknown[] = [];
    out.push(await h.services.auth.signUp({ name: "Carla Dias", email: "carla@demo.test", password: PW, role: "student", acceptedTerms: true }));
    out.push(await h.services.auth.getCurrentUser());
    out.push(await h.services.auth.listDemoProfiles());
    out.push(await h.services.auth.signIn({ email: "carla@demo.test", password: PW }));
    out.push(await h.services.auth.signInWithGoogle(googleCredential(google)));
    out.push(await h.services.auth.completeGoogleSignUp({ ticket: googleTicket(google), role: "teacher", acceptedTerms: true }));
    await h.services.auth.signInAsDemo("admin");
    out.push(await h.services.items.list(), await h.services.items.get("item-03"));
    out.push(await h.services.claims.listPending(), await h.services.claims.listByItem("item-03"));
    out.push(await h.services.returns.list());
    for (const value of out) {
      const json = JSON.stringify(value).replaceAll("hasPassword", "");
      expect(json).not.toMatch(/hash|salt|password|credential|iterations|provider/i);
      expect(json).not.toContain(PW);
      expect(json).not.toContain(DEMO_PASSWORD);
    }
  });

  it("EMAIL_TAKEN no cadastro com senha (qualquer caixa) e nenhuma credencial é criada", async () => {
    const h = createHarness();
    const before = JSON.parse(h.storage.getItem(DB_KEY) ?? "null");
    await expectCode(
      h.services.auth.signUp({ name: "Outra Marina", email: " MARINA@demo.test ", password: PW, role: "student", acceptedTerms: true }),
      "EMAIL_TAKEN",
    );
    expect(before).toBeNull(); // banco ainda nem gravado; a leitura abaixo grava o seed
    const db = new MockStore({ storage: h.storage, now: () => TEST_NOW }).read();
    expect(db.credentials).toHaveLength(db.users.length);
    expect(db.users.filter((u) => u.email === "marina@demo.test")).toHaveLength(1);
  });

  it("sessão sobrevive a 'recarregar' (novo serviço sobre o mesmo armazenamento) e sair encerra", async () => {
    const h = createHarness();
    await h.services.auth.signIn({ email: "marina@demo.test", password: DEMO_PASSWORD });
    const reloaded = createMockServices({ latency: 0, storage: h.storage, sessionStorage: h.sessionStorage, now: h.clock });
    expect((await reloaded.auth.getCurrentUser())?.id).toBe("user-marina");
    await reloaded.auth.signOut();
    expect(await reloaded.auth.getCurrentUser()).toBeNull();
  });
});

describe("Google institucional (P30)", () => {
  it("conta nova: needs_role (nada criado) -> completar -> sessão", async () => {
    const h = createHarness();
    const r = await h.services.auth.signInWithGoogle(googleCredential(google));
    expect(r).toEqual({
      status: "needs_role",
      profile: { email: "ana.lima@alunos.undb.edu.br", name: "Ana Lima" },
      ticket: expect.any(String),
    });
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    const ticket = r.status === "needs_role" ? r.ticket : "";
    const user = await h.services.auth.completeGoogleSignUp({ ticket, role: "teacher", acceptedTerms: true });
    expect(user).toMatchObject({ email: "ana.lima@alunos.undb.edu.br", name: "Ana Lima", role: "teacher" });
    expect((await h.services.auth.getCurrentUser())?.id).toBe(user.id);
  });

  it("ticket inválido ou adulterado: UNAUTHENTICATED e nada é criado", async () => {
    const h = createHarness();
    for (const ticket of ["", "lixo", "e30", "eyJmb28iOjF9"]) {
      await expectCode(h.services.auth.completeGoogleSignUp({ ticket, role: "student", acceptedTerms: true }), "UNAUTHENTICATED");
    }
    expect(await h.services.auth.getCurrentUser()).toBeNull();
  });

  it("nome com acentos sobrevive ao ticket", async () => {
    const h = createHarness();
    const user = await h.services.auth.completeGoogleSignUp({
      ticket: googleTicket({ email: "jose@undb.edu.br", name: "José Conceição" }),
      role: "student",
      acceptedTerms: true,
    });
    expect(user.name).toBe("José Conceição");
  });

  it("conta existente: signed_in direto, sem criar outra", async () => {
    const h = createHarness();
    const user = await h.services.auth.completeGoogleSignUp({ ticket: googleTicket(google), role: "student", acceptedTerms: true });
    await h.services.auth.signOut();
    const r = await h.services.auth.signInWithGoogle(googleCredential({ email: " ANA.LIMA@alunos.undb.edu.br", name: "Outro Nome" }));
    expect(r).toEqual({ status: "signed_in", user });
    expect((await h.services.auth.getCurrentUser())?.id).toBe(user.id);
  });

  it("e-mail fora do domínio: needs_terms (nada criado) -> aceite -> external verificada, por 2 caminhos", async () => {
    for (const email of ["ana@gmail.com", "ana@undb.edu.br.evil.com", "ana@evilundb.edu.br"]) {
      const h = createHarness();
      const r = await h.services.auth.signInWithGoogle(googleCredential({ email, name: "Ana" }));
      expect(r).toEqual({ status: "needs_terms", profile: { email, name: "Ana" }, ticket: expect.any(String) });
      expect(await h.services.auth.getCurrentUser()).toBeNull();
      // caminho 1: repetir signInWithGoogle com o aceite
      const again = await h.services.auth.signInWithGoogle(googleCredential({ email, name: "Ana" }), { acceptedTerms: true });
      expect(again.status).toBe("signed_in");
      if (again.status === "signed_in") expect(again.user).toMatchObject({ email, role: "external", emailVerified: true, hasPassword: false });
      await h.services.auth.signOut();
      // conta existente: signed_in direto, sem duplicar
      const third = await h.services.auth.signInWithGoogle(googleCredential({ email, name: "Ana" }));
      expect(third.status === "signed_in" && third.user.id).toBe(again.status === "signed_in" && again.user.id);
    }
    // caminho 2: completeGoogleSignUp com o ticket (papel é ignorado fora do domínio)
    const h = createHarness();
    const r = await h.services.auth.signInWithGoogle(googleCredential({ email: "bia@gmail.com", name: "Bia" }));
    const ticket = r.status === "needs_terms" ? r.ticket : "";
    const err = await expectCode(h.services.auth.completeGoogleSignUp({ ticket, acceptedTerms: false }), "VALIDATION");
    expect(err.fieldErrors?.acceptedTerms).toBeTruthy();
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    const user = await h.services.auth.completeGoogleSignUp({ ticket, role: "teacher", acceptedTerms: true });
    expect(user).toMatchObject({ email: "bia@gmail.com", role: "external", emailVerified: true });
  });

  it("domínio institucional exige role e acceptedTerms em completeGoogleSignUp", async () => {
    const h = createHarness();
    const ticket = googleTicket(google);
    const noRole = await expectCode(h.services.auth.completeGoogleSignUp({ ticket, acceptedTerms: true }), "VALIDATION");
    expect(noRole.fieldErrors?.role).toBeTruthy();
    const both = await expectCode(h.services.auth.completeGoogleSignUp({ ticket, acceptedTerms: false }), "VALIDATION");
    expect(Object.keys(both.fieldErrors ?? {}).sort()).toEqual(["acceptedTerms", "role"]);
    expect(await h.services.auth.getCurrentUser()).toBeNull();
  });

  it("conta Google dentro do domínio nasce verificada e só aceita aluno/professor", async () => {
    const h = createHarness();
    const user = await h.services.auth.completeGoogleSignUp({ ticket: googleTicket(google), role: "student", acceptedTerms: true });
    expect(user.emailVerified).toBe(true);
    await h.services.auth.signOut();
    await expectCode(
      h.services.auth.completeGoogleSignUp({ ticket: googleTicket({ email: "bia@undb.edu.br", name: "Bia" }), role: "external" as never, acceptedTerms: true }),
      "VALIDATION",
    );
  });

  it("domínio configurável por createMockServices", async () => {
    const h = createHarness({ allowedGoogleDomains: ["demo.test"] });
    expect((await h.services.auth.signInWithGoogle(googleCredential({ email: "marina@demo.test", name: "Marina" }))).status).toBe("signed_in");
    const outside = await h.services.auth.signInWithGoogle(googleCredential(google));
    expect(outside.status).toBe("needs_terms");
  });

  it("completar para e-mail já existente: EMAIL_TAKEN", async () => {
    const h = createHarness({ allowedGoogleDomains: ["demo.test", "undb.edu.br"] });
    await expectCode(
      h.services.auth.completeGoogleSignUp({ ticket: googleTicket({ email: "marina@demo.test", name: "Marina" }), role: "student", acceptedTerms: true }),
      "EMAIL_TAKEN",
    );
    await h.services.auth.completeGoogleSignUp({ ticket: googleTicket(google), role: "student", acceptedTerms: true });
    await expectCode(h.services.auth.completeGoogleSignUp({ ticket: googleTicket(google), role: "teacher", acceptedTerms: true }), "EMAIL_TAKEN");
  });

  it("papel inválido (admin) é recusado", async () => {
    const h = createHarness();
    const err = await expectCode(h.services.auth.completeGoogleSignUp({ ticket: googleTicket(google), role: "admin" as never, acceptedTerms: true }), "VALIDATION");
    expect(err.fieldErrors?.role).toBeTruthy();
  });

  it("nome curto/ausente vira a parte local do e-mail; nome longo é truncado em 80", async () => {
    const h = createHarness();
    const a = await h.services.auth.completeGoogleSignUp({ ticket: googleTicket({ email: "bia@undb.edu.br", name: "" }), role: "student", acceptedTerms: true });
    expect(a.name).toBe("bia");
    const b = await h.services.auth.completeGoogleSignUp({ ticket: googleTicket({ email: "bob@undb.edu.br", name: "x".repeat(200) }), role: "student", acceptedTerms: true });
    expect(b.name).toHaveLength(80);
  });

  it("conta do Google não tem senha: entrar por senha dá INVALID_CREDENTIALS (mesma mensagem)", async () => {
    const h = createHarness();
    await h.services.auth.completeGoogleSignUp({ ticket: googleTicket(google), role: "student", acceptedTerms: true });
    await h.services.auth.signOut();
    for (const password of [PW, "", "undefined", "null", "12345678"]) {
      const err = await expectCode(
        h.services.auth.signIn({ email: google.email, password }),
        password === "" ? "VALIDATION" : "INVALID_CREDENTIALS",
      );
      if (password !== "") expect(err.message).toBe("E-mail ou senha incorretos.");
    }
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    const db = new MockStore({ storage: h.storage, now: () => TEST_NOW }).read();
    const cred = db.credentials.find((c) => c.provider === "google")!;
    expect(cred.hash).toBeUndefined();
    expect(cred.salt).toBeUndefined();
  });

  it("Google em conta de senha existente abre sessão (a senha continua valendo)", async () => {
    const h = createHarness();
    await h.services.auth.signUp({ name: "Ana Lima", email: google.email, password: PW, role: "student", acceptedTerms: true });
    await h.services.auth.signOut();
    expect((await h.services.auth.signInWithGoogle(googleCredential(google))).status).toBe("signed_in");
    await h.services.auth.signOut();
    expect(userOf(await h.services.auth.signIn({ email: google.email, password: PW })).email).toBe("ana.lima@alunos.undb.edu.br");
  });
});

describe("migração DB_VERSION (P29/P30)", () => {
  it("DB_VERSION é 5; v1/v2/v3 antigos são descartados e o seed novo traz credenciais", () => {
    expect(DB_VERSION).toBe(5);
    const storage = createMemoryStorage();
    const { credentials: _c, ...legacy } = buildSeed(TEST_NOW);
    void _c;
    storage.setItem("campuslost:proto:v1:db", JSON.stringify({ ...legacy, version: 1 }));
    storage.setItem("campuslost:proto:v2:db", JSON.stringify({ ...legacy, version: 2 }));
    const db = new MockStore({ storage, now: () => TEST_NOW }).read();
    expect(db.version).toBe(5);
    expect(db.tokens).toEqual([]);
    expect(db.credentials).toHaveLength(db.users.length);
    expect(storage.getItem("campuslost:proto:v1:db")).toBeNull();
    expect(storage.getItem("campuslost:proto:v2:db")).toBeNull();
  });

  it("banco v5 sem `credentials` (adulterado) é descartado e regenerado", () => {
    const storage = createMemoryStorage();
    const { credentials: _c, ...broken } = buildSeed(TEST_NOW);
    void _c;
    storage.setItem(DB_KEY, JSON.stringify(broken));
    expect(new MockStore({ storage, now: () => TEST_NOW }).read().credentials.length).toBeGreaterThan(0);
  });
});
