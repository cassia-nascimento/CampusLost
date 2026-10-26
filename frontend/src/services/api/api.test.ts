import { describe, expect, it } from "vitest";
import { ServiceError, type ServiceErrorCode } from "@/types/domain";
import { LEGACY_TOKEN_STORAGE_KEY, SESSION_HINT_KEY } from "./http";
import { createApiServices } from "./index";
import { BASE, createFakeApi, createHarness, denied, rawClaim, rawItem, rawSession, rawUser } from "./test-utils";

async function failure(promise: Promise<unknown>): Promise<ServiceError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ServiceError) return error;
    throw error;
  }
  throw new Error("esperava rejeição");
}

describe("mapeamento (API.md §3)", () => {
  it("item: photoUrl relativo vira photoDataUrl absoluto; sem foto, o campo não existe", async () => {
    const { api, services } = createHarness();
    api.reply({ json: [rawItem, { ...rawItem, id: "item-04", photoUrl: null }] });
    const [withPhoto, withoutPhoto] = await services.items.list();
    expect(withPhoto.photoDataUrl).toBe(`${BASE}/uploads/seed/chaveiro.svg`);
    expect("photoUrl" in withPhoto).toBe(false);
    expect(withoutPhoto.photoDataUrl).toBeUndefined();
    expect(withPhoto).toMatchObject({ id: "item-03", storedAt: "Portaria", createdById: "user-lucas" });
  });

  it("visitante: item sem storedAt/createdById continua sem essas chaves", async () => {
    const { api, services } = createHarness();
    const { storedAt: _s, createdById: _c, ...guest } = rawItem;
    void _s;
    void _c;
    api.reply({ json: [guest] });
    const [item] = await services.items.list();
    expect("storedAt" in item).toBe(false);
    expect("createdById" in item).toBe(false);
  });

  it("photoUrl suspeito é descartado (esquema, outro host, //, ..)", async () => {
    const { api, services } = createHarness();
    const bad = ["javascript:alert(1)", "http://evil.test/uploads/" + "a".repeat(32) + ".png", "//evil.test/x.png", "/uploads/../x.png", "/outro/" + "a".repeat(32) + ".png", 42];
    api.reply({ json: bad.map((photoUrl, i) => ({ ...rawItem, id: `i${i}`, photoUrl })) });
    const items = await services.items.list();
    expect(items.every((i) => i.photoDataUrl === undefined)).toBe(true);
  });

  it("foto enviada: /uploads/<uuid>.png", async () => {
    const { api, services } = createHarness();
    const name = "0123456789abcdef0123456789abcdef";
    api.reply({ json: [{ ...rawItem, photoUrl: `/uploads/${name}.png` }] });
    expect((await services.items.list())[0].photoDataUrl).toBe(`${BASE}/uploads/${name}.png`);
  });

  it("detalhe: item, createdBy, myClaims, claims, returnRecord e viewer", async () => {
    const { api, services } = createHarness();
    const viewer = { claim: { allowed: true }, edit: denied, delete: denied, registerReturn: denied };
    api.reply({
      json: {
        item: rawItem,
        createdBy: { id: "user-lucas", name: "Lucas Prado", role: "student" },
        myClaims: [rawClaim],
        claims: [{ ...rawClaim, claimant: rawUser }],
        returnRecord: null,
        viewer,
      },
    });
    const detail = await services.items.get("item-03");
    expect(api.calls[0].url.pathname).toBe("/items/item-03");
    expect(detail.item.photoDataUrl).toBe(`${BASE}/uploads/seed/chaveiro.svg`);
    expect(detail.createdBy?.name).toBe("Lucas Prado");
    expect(detail.myClaims).toHaveLength(1);
    expect(detail.claims[0].claimant.email).toBe("marina@demo.test");
    expect(detail.returnRecord).toBeNull();
    expect(detail.viewer).toEqual(viewer);
  });

  it("detalhe de visitante: createdBy null", async () => {
    const { api, services } = createHarness();
    api.reply({ json: { item: rawItem, createdBy: null, myClaims: [], claims: [], returnRecord: null, viewer: {} } });
    expect((await services.items.get("item-03")).createdBy).toBeNull();
  });

  it("claim com reviewedAt ausente permanece sem a chave; ClaimView traz claimant e item", async () => {
    const { api, services } = createHarness();
    api.reply({ json: [{ ...rawClaim, claimant: rawUser, item: rawItem }] });
    const [view] = await services.claims.listMine();
    expect("reviewedAt" in view).toBe(false);
    expect(view.claimant.id).toBe("user-marina");
    expect(view.item.photoDataUrl).toBe(`${BASE}/uploads/seed/chaveiro.svg`);
  });

  it("decisão de reivindicação e devolução", async () => {
    const { api, services } = createHarness();
    const accepted = { ...rawClaim, status: "accepted", reviewedAt: "2026-10-22T15:00:00.000Z" };
    api.reply({ json: { claim: accepted, item: rawItem, autoRejectedIds: ["claim-02"] } });
    const result = await services.claims.accept("claim-01");
    expect(api.calls[0]).toMatchObject({ method: "POST" });
    expect(api.calls[0].url.pathname).toBe("/claims/claim-01/accept");
    expect(result.claim.reviewedAt).toBe("2026-10-22T15:00:00.000Z");
    expect(result.autoRejectedIds).toEqual(["claim-02"]);

    api.reply({
      status: 201,
      json: {
        id: "return-01",
        itemId: "item-03",
        claimId: "claim-01",
        returnedToId: "user-beatriz",
        registeredById: "user-admin",
        returnedAt: "2026-10-22T16:00:00.000Z",
        item: rawItem,
        returnedTo: rawUser,
        registeredBy: { id: "user-admin", name: "Admin", role: "admin" },
      },
    });
    const ret = await services.returns.register("item-03");
    expect(api.calls[1].url.pathname).toBe("/items/item-03/return");
    expect(ret.item.photoDataUrl).toContain("/uploads/seed/");
    expect(ret.registeredBy.name).toBe("Admin");
  });

  it("resposta com formato errado vira UNEXPECTED (sem vazar detalhes)", async () => {
    const { api, services } = createHarness();
    api.reply({ json: { nao: "uma lista" } });
    const error = await failure(services.items.list());
    expect(error.code).toBe("UNEXPECTED");
    expect(error.message).toBe("Algo deu errado. Tente novamente.");
  });
});

describe("filtros e rotas", () => {
  it("items.list envia só filtros preenchidos na query", async () => {
    const { api, services } = createHarness();
    api.reply({ json: [] }, { json: [] });
    await services.items.list({ category: "Chaves", location: "Bloco A", from: "2026-10-01", to: "2026-10-20", status: "available", sort: "found" });
    expect(Object.fromEntries(api.calls[0].url.searchParams)).toEqual({
      category: "Chaves",
      location: "Bloco A",
      from: "2026-10-01",
      to: "2026-10-20",
      status: "available",
      sort: "found",
    });
    await services.items.list({ category: undefined, location: "" });
    expect(api.calls[1].url.search).toBe("");
  });

  it("returns.list envia o período; ids são codificados no caminho", async () => {
    const { api, services } = createHarness();
    api.reply({ json: [] }, { json: [] });
    await services.returns.list({ from: "2026-10-01", to: "2026-10-31" });
    expect(api.calls[0].url.pathname + api.calls[0].url.search).toBe("/returns?from=2026-10-01&to=2026-10-31");
    await services.claims.listByItem("a/b");
    expect(api.calls[1].url.pathname).toBe("/items/a%2Fb/claims");
  });

  it("claims.create envia JSON e devolve a Claim", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 201, json: rawClaim });
    const claim = await services.claims.create("item-03", { proofDetails: "x".repeat(10), lostWhereWhen: "Bloco A, ontem" });
    expect(api.calls[0].headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(api.calls[0].body))).toEqual({ proofDetails: "x".repeat(10), lostWhereWhen: "Bloco A, ontem" });
    expect(claim.id).toBe("claim-01");
  });

  it("items.delete aceita 204", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 204 });
    await expect(services.items.delete("item-03")).resolves.toBeUndefined();
    expect(api.calls[0]).toMatchObject({ method: "DELETE" });
  });
});

describe("foto em multipart", () => {
  const fields = {
    title: "Agenda vermelha",
    description: "Agenda vermelha com elástico e capa dura.",
    category: "Outros",
    foundLocation: "Biblioteca",
    foundDate: "2026-10-21",
    storedAt: "Portaria",
  } as const;

  it("create: campos + arquivo, sem Content-Type manual", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 201, json: { ...rawItem, photoUrl: "/uploads/" + "ab".repeat(16) + ".png" } });
    const file = new File([new Uint8Array(20)], "agenda.png", { type: "image/png" });
    const item = await services.items.create({ ...fields, photo: file });
    const call = api.calls[0];
    expect(call.method).toBe("POST");
    expect(call.headers["Content-Type"]).toBeUndefined();
    const form = call.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("title")).toBe("Agenda vermelha");
    expect(form.get("foundDate")).toBe("2026-10-21");
    expect((form.get("photo") as File).name).toBe("agenda.png");
    expect(form.has("removePhoto")).toBe(false);
    expect(item.photoDataUrl).toBe(`${BASE}/uploads/${"ab".repeat(16)}.png`);
  });

  it("create sem foto não envia a parte photo", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 201, json: rawItem });
    await services.items.create({ ...fields });
    expect((api.calls[0].body as FormData).has("photo")).toBe(false);
  });

  it("update: undefined mantém, File troca, null remove", async () => {
    const { api, services } = createHarness();
    api.reply({ json: rawItem }, { json: rawItem }, { json: rawItem });
    await services.items.update("item-03", { ...fields });
    await services.items.update("item-03", { ...fields, photo: new File([new Uint8Array(5)], "b.jpg", { type: "image/jpeg" }) });
    await services.items.update("item-03", { ...fields, photo: null });
    const [keep, replace, remove] = api.calls.map((c) => c.body as FormData);
    expect(api.calls[0]).toMatchObject({ method: "PUT" });
    expect(keep.has("photo") || keep.has("removePhoto")).toBe(false);
    expect((replace.get("photo") as File).name).toBe("b.jpg");
    expect(remove.get("removePhoto")).toBe("true");
  });

  it("arquivo de formato/tamanho inválido: PHOTO_INVALID sem chamar a rede", async () => {
    const { api, services } = createHarness();
    const error = await failure(services.items.create({ ...fields, photo: new File([new Uint8Array(5)], "x.gif", { type: "image/gif" }) }));
    expect(error.code).toBe("PHOTO_INVALID");
    expect(api.calls).toHaveLength(0);
  });
});

describe("contas: verificação, senha, exportação, exclusão (REST)", () => {
  it("verifyEmail, resendVerification, forgotPassword e resetPassword chamam as rotas combinadas", async () => {
    const { api, services } = createHarness();
    api.reply({ json: { verified: true } });
    expect(await services.auth.verifyEmail("tok")).toBeUndefined();
    expect(api.calls[0]).toMatchObject({ method: "POST" });
    expect(api.calls[0].url.pathname).toBe("/auth/verify-email");
    expect(JSON.parse(String(api.calls[0].body))).toEqual({ token: "tok" });
    expect(api.calls[0].headers.Authorization).toBeUndefined();

    api.reply({ status: 202, json: { status: "accepted", message: "ok" } });
    expect(await services.auth.resendVerification()).toEqual({});
    expect(api.calls[1].url.pathname).toBe("/auth/resend-verification");

    api.reply({ status: 202, json: { status: "accepted", message: "ok" } });
    expect(await services.auth.forgotPassword("a@b.co")).toEqual({});
    expect(api.calls[2].url.pathname).toBe("/auth/forgot-password");
    expect(JSON.parse(String(api.calls[2].body))).toEqual({ email: "a@b.co" });

    api.reply({ json: { status: "ok", message: "Senha redefinida." } });
    await services.auth.resetPassword("tok2", "uma senha longa 1");
    expect(api.calls[3].url.pathname).toBe("/auth/reset-password");
    expect(JSON.parse(String(api.calls[3].body))).toEqual({ token: "tok2", password: "uma senha longa 1" });
  });

  it("exportMyData (GET /me/export) e deleteMyAccount (DELETE /me, descarta o token)", async () => {
    const { api, storage, services } = createHarness();
    api.reply({ json: rawSession });
    await services.auth.signIn({ email: "marina@demo.test", password: "demonstracao123" });
    api.reply({
      json: {
        format: "campuslost-export-v1",
        exportedAt: "2026-10-25T10:00:00.000Z",
        account: { id: "user-marina", name: "Marina Alves", email: "marina@demo.test", role: "student", provider: "password" },
        itemsRegistered: [rawItem],
        claims: [{ ...rawClaim, itemTitle: "Chaveiro" }],
        returns: [],
        sessions: [],
      },
    });
    const data = await services.auth.exportMyData();
    expect(api.calls[1]).toMatchObject({ method: "GET" });
    expect(api.calls[1].url.pathname).toBe("/me/export");
    expect(data.account.provider).toBe("password");
    expect(data.itemsRegistered[0].photoDataUrl).toBe(`${BASE}/uploads/seed/chaveiro.svg`);
    expect(data.claims).toHaveLength(1);

    api.reply({ status: 204 });
    await services.auth.deleteMyAccount({ password: "demonstracao123" });
    expect(api.calls[2]).toMatchObject({ method: "DELETE" });
    expect(api.calls[2].url.pathname).toBe("/me");
    expect(JSON.parse(String(api.calls[2].body))).toEqual({ password: "demonstracao123" });
    expect(storage.getItem(SESSION_HINT_KEY)).toBeNull();
  });

  it("códigos novos do servidor viram ServiceError tipado; INVALID_TOKEN vira TOKEN_INVALID", async () => {
    const { api, services } = createHarness();
    const cases: [string, number, string][] = [
      ["EMAIL_NOT_VERIFIED", 403, "EMAIL_NOT_VERIFIED"],
      ["INVALID_TOKEN", 400, "TOKEN_INVALID"],
      ["CSRF_FAILED", 403, "CSRF_FAILED"],
      ["CAPTCHA_FAILED", 400, "CAPTCHA_FAILED"],
      ["RATE_LIMITED", 429, "RATE_LIMITED"],
    ];
    for (const [code, status, expected] of cases) {
      api.reply({ status, json: { code, message: "x" } });
      expect((await failure(services.auth.verifyEmail("t"))).code).toBe(expected);
    }
  });

  it("mutações enviam X-Requested-With: CampusLost; leituras não precisam", async () => {
    const { api, services } = createHarness();
    api.reply({ json: { verified: true } }, { status: 204 }, { json: [] });
    await services.auth.verifyEmail("tok");
    await services.auth.deleteMyAccount({ password: "demonstracao123" });
    await services.items.list();
    expect(api.calls[0].headers["X-Requested-With"]).toBe("CampusLost");
    expect(api.calls[1].headers["X-Requested-With"]).toBe("CampusLost");
    expect(api.calls[2].headers["X-Requested-With"]).toBeUndefined();
  });

  it("signUp envia acceptTerms (nome da API) e turnstileToken; Google: needs_terms e acceptTerms", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 201, json: rawSession });
    await services.auth.signUp({ name: "Marina Alves", email: "m@demo.test", password: "uma senha longa 1", role: "external", acceptedTerms: true, turnstileToken: "cf" });
    expect(JSON.parse(String(api.calls[0].body))).toEqual({
      name: "Marina Alves", email: "m@demo.test", password: "uma senha longa 1", role: "external", acceptTerms: true, turnstileToken: "cf",
    });
    const profile = { email: "ana@gmail.com", name: "Ana" };
    api.reply({ json: { status: "needs_terms", profile, profileToken: "pt-1" } });
    expect(await services.auth.signInWithGoogle("idt")).toEqual({ status: "needs_terms", profile, ticket: "pt-1" });
    expect(JSON.parse(String(api.calls[1].body))).toEqual({ credential: "idt" });
    api.reply({ json: { status: "signed_in", ...rawSession } });
    await services.auth.signInWithGoogle("idt", { acceptedTerms: true });
    expect(JSON.parse(String(api.calls[2].body))).toEqual({ credential: "idt", acceptTerms: true });
    api.reply({ status: 201, json: rawSession });
    await services.auth.completeGoogleSignUp({ ticket: "pt-1", acceptedTerms: true });
    expect(JSON.parse(String(api.calls[3].body))).toEqual({ profileToken: "pt-1", acceptTerms: true });
    api.reply({ status: 204 });
    await services.auth.deleteMyAccount({ credential: "idt2" });
    expect(JSON.parse(String(api.calls[4].body))).toEqual({ credential: "idt2" });
  });
});

const rawClaimView = () => ({ ...rawClaim, claimant: rawUser, item: rawItem });
const unauthenticated = { status: 401, json: { code: "UNAUTHENTICATED", message: "Sua sessão expirou. Entre novamente." } } as const;

describe("sessão por cookie HttpOnly", () => {
  it("nenhuma chamada leva Authorization e todas usam credentials same-origin; token do corpo é ignorado", async () => {
    const credentials: (RequestCredentials | undefined)[] = [];
    const inner = createFakeApi();
    const h = createHarness({
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        credentials.push(init?.credentials);
        return inner.fetch(input, init);
      }) as typeof fetch,
    });
    inner.reply({ json: { ...rawSession, token: "tok-secreto" } }, { json: [] });
    await h.services.auth.signIn({ email: "marina@demo.test", password: "demonstracao123" });
    await h.services.items.list();
    expect(credentials).toEqual(["same-origin", "same-origin"]);
    for (const call of inner.calls) expect(call.headers.Authorization).toBeUndefined();
    const keep = JSON.stringify([h.storage.getItem(SESSION_HINT_KEY), h.storage.getItem(LEGACY_TOKEN_STORAGE_KEY), h.legacyStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)]);
    expect(keep).not.toContain("tok-secreto");
  });

  it("login funciona mesmo que o corpo não traga token (só cookies); marca a dica de sessão", async () => {
    const { api, storage, services } = createHarness();
    api.reply({ json: { user: rawUser } });
    expect(await services.auth.signIn({ email: "marina@demo.test", password: "demonstracao123" })).toEqual({ status: "signed_in", user: rawUser });
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
    expect(api.calls[0].headers["X-Requested-With"]).toBe("CampusLost");
  });

  it("apaga o token legado (sessionStorage da versão Bearer) na subida", () => {
    const h = createHarness();
    h.legacyStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, "antigo");
    h.storage.setItem(LEGACY_TOKEN_STORAGE_KEY, "antigo");
    createApiServices({ baseUrl: BASE, fetch: h.api.fetch, storage: h.storage, legacyStorage: h.legacyStorage });
    expect(h.legacyStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)).toBeNull();
    expect(h.storage.getItem(LEGACY_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("base relativa (/backend): a URL final é /backend/... e fotos viram /backend/uploads/...", async () => {
    const urls: string[] = [];
    const h = createHarness({
      baseUrl: "/backend/",
      fetch: (async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return new Response(JSON.stringify([rawItem]), { status: 200 });
      }) as typeof fetch,
    });
    const [item] = await h.services.items.list();
    expect(urls[0]).toBe("/backend/items");
    expect(item.photoDataUrl).toBe("/backend/uploads/seed/chaveiro.svg");
  });

  it("signUp, demo e Google marcam a sessão", async () => {
    const { api, storage, services } = createHarness();
    api.reply({ status: 201, json: rawSession });
    await services.auth.signUp({ name: "Marina Alves", email: "marina@demo.test", password: "demonstracao123", role: "student", acceptedTerms: true });
    expect(api.calls[0].url.pathname).toBe("/auth/signup");
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
    storage.removeItem(SESSION_HINT_KEY);
    api.reply({ json: rawSession });
    await services.auth.signInAsDemo("admin");
    expect(api.calls[1].url.pathname).toBe("/demo/login/admin");
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
    storage.removeItem(SESSION_HINT_KEY);
    api.reply({ json: { status: "signed_in", ...rawSession } });
    const result = await services.auth.signInWithGoogle("id-token");
    expect(JSON.parse(String(api.calls[2].body))).toEqual({ credential: "id-token" });
    expect(result).toEqual({ status: "signed_in", user: rawUser });
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
  });

  it("Google conta nova: needs_role não marca sessão; completar usa o ticket e marca", async () => {
    const { api, storage, services } = createHarness();
    api.reply({ json: { status: "needs_role", profile: { email: "ana@undb.edu.br", name: "Ana" }, profileToken: "ptok" } });
    const result = await services.auth.signInWithGoogle("id-token");
    expect(result).toEqual({ status: "needs_role", profile: { email: "ana@undb.edu.br", name: "Ana" }, ticket: "ptok" });
    expect(storage.getItem(SESSION_HINT_KEY)).toBeNull();
    api.reply({ status: 201, json: rawSession });
    await services.auth.completeGoogleSignUp({ ticket: "ptok", role: "teacher", acceptedTerms: true });
    expect(JSON.parse(String(api.calls[1].body))).toEqual({ profileToken: "ptok", role: "teacher", acceptTerms: true });
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
  });

  it("getCurrentUser: sem dica de sessão = null sem rede; com dica = /auth/me", async () => {
    const { api, storage, services } = createHarness();
    expect(await services.auth.getCurrentUser()).toBeNull();
    expect(api.calls).toHaveLength(0);
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply({ json: rawUser });
    expect(await services.auth.getCurrentUser()).toEqual(rawUser);
    expect(api.calls[0].url.pathname).toBe("/auth/me");
  });

  it("getCurrentUser: 401 -> um refresh -> /auth/me de novo -> usuário", async () => {
    const { api, storage, services } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply(unauthenticated, { json: rawSession }, { json: rawUser });
    expect(await services.auth.getCurrentUser()).toEqual(rawUser);
    expect(api.calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual(["GET /auth/me", "POST /auth/refresh", "GET /auth/me"]);
    expect(api.calls[1].headers["X-Requested-With"]).toBe("CampusLost");
    expect(api.calls[1].headers.Authorization).toBeUndefined();
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
  });

  it("getCurrentUser: refresh falha = null, dica apagada e ouvintes avisados uma vez", async () => {
    const { api, storage, services } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    let notified = 0;
    services.subscribe(() => notified++);
    api.reply(unauthenticated, unauthenticated);
    expect(await services.auth.getCurrentUser()).toBeNull();
    expect(api.calls).toHaveLength(2);
    expect(storage.getItem(SESSION_HINT_KEY)).toBeNull();
    expect(notified).toBe(1);
    // sem dica: nenhuma nova requisição (sem laço de releituras)
    expect(await services.auth.getCurrentUser()).toBeNull();
    expect(api.calls).toHaveLength(2);
  });

  it("getCurrentUser: erro de rede propaga e não apaga a sessão", async () => {
    const { api, storage, services } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply(new TypeError("fetch failed"));
    expect((await failure(services.auth.getCurrentUser())).code).toBe("NETWORK");
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
  });
});

describe("renovação automática da sessão (refresh)", () => {
  it("401 numa chamada autenticada: renova UMA vez e repete a original", async () => {
    const { api, storage, services } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply(unauthenticated, { json: rawSession }, { json: [rawClaimView()] });
    const mine = await services.claims.listMine();
    expect(mine).toHaveLength(1);
    expect(api.calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual(["GET /claims/mine", "POST /auth/refresh", "GET /claims/mine"]);
  });

  it("mutação repetida mantém corpo e cabeçalho anti-CSRF", async () => {
    const { api, services } = createHarness();
    api.reply(unauthenticated, { json: rawSession }, { json: { claim: rawClaim, item: rawItem, autoRejectedIds: [] } });
    await services.claims.accept("claim-01");
    expect(api.calls[0].url.pathname).toBe("/claims/claim-01/accept");
    expect(api.calls[2].method).toBe("POST");
    expect(api.calls[2].headers["X-Requested-With"]).toBe("CampusLost");
    expect(api.calls[2].url.pathname).toBe(api.calls[0].url.pathname);
  });

  it("várias chamadas que levam 401 ao mesmo tempo compartilham UM refresh", async () => {
    const { api, services } = createHarness();
    // 3 chamadas 401 em paralelo -> 1 refresh -> 3 repetições
    api.reply(unauthenticated, unauthenticated, unauthenticated, { json: rawSession }, { json: [] }, { json: [] }, { json: [] });
    const results = await Promise.all([services.claims.listMine(), services.claims.listPending(), services.returns.list()]);
    expect(results).toEqual([[], [], []]);
    expect(api.calls.filter((c) => c.url.pathname === "/auth/refresh")).toHaveLength(1);
    expect(api.calls).toHaveLength(7);
  });

  it("refresh falha: o erro 401 original chega, a sessão local é encerrada e a UI é avisada; sem segundo refresh", async () => {
    const { api, storage, services } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    let notified = 0;
    services.subscribe(() => notified++);
    api.reply(unauthenticated, unauthenticated);
    const error = await failure(services.claims.listMine());
    expect(error.code).toBe("UNAUTHENTICATED");
    expect(api.calls.map((c) => c.url.pathname)).toEqual(["/claims/mine", "/auth/refresh"]);
    expect(storage.getItem(SESSION_HINT_KEY)).toBeNull();
    expect(notified).toBe(1);
  });

  it("refresh ok mas a repetição ainda dá 401: encerra a sessão (sem laço)", async () => {
    const { api, storage, services } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply(unauthenticated, { json: rawSession }, unauthenticated);
    expect((await failure(services.claims.listMine())).code).toBe("UNAUTHENTICATED");
    expect(api.calls).toHaveLength(3);
    expect(storage.getItem(SESSION_HINT_KEY)).toBeNull();
  });

  it("refresh com erro de rede também encerra com o 401 original (não trava)", async () => {
    const { api, services } = createHarness();
    api.reply(unauthenticated, new TypeError("fetch failed"));
    expect((await failure(services.claims.listMine())).code).toBe("UNAUTHENTICATED");
  });

  it("chamadas públicas de sessão (login, verify 2FA, aceitar convite) e outros erros NÃO disparam refresh", async () => {
    const { api, services } = createHarness();
    api.reply(
      { status: 401, json: { code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos." } },
      unauthenticated,
      { status: 400, json: { code: "INVALID_TOKEN", message: "x" } },
      { status: 403, json: { code: "TWO_FACTOR_REQUIRED", message: "x" } },
    );
    await failure(services.auth.signIn({ email: "marina@demo.test", password: "errada123" }));
    await failure(services.auth.verifyTwoFactor({ challengeToken: "c", code: "123456" }));
    await failure(services.auth.acceptInvite({ token: "t".repeat(40), name: "Nova Admin", password: "senha-longa-123" }));
    await failure(services.claims.listPending());
    expect(api.calls.some((c) => c.url.pathname === "/auth/refresh")).toBe(false);
  });

  it("senha errada (401 INVALID_CREDENTIALS) não mexe na sessão", async () => {
    const { api, storage, services } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply({ status: 401, json: { code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos." } });
    const error = await failure(services.auth.signIn({ email: "marina@demo.test", password: "errada123" }));
    expect(error).toMatchObject({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos." });
    expect(storage.getItem(SESSION_HINT_KEY)).toBe("1");
  });
});

describe("signOut (POST /auth/logout)", () => {
  it("revoga no servidor com X-Requested-With, limpa o estado local e não avisa ouvintes", async () => {
    const { api, storage, services } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    let notified = 0;
    services.subscribe(() => notified++);
    api.reply({ status: 204 });
    await services.auth.signOut();
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0].method).toBe("POST");
    expect(api.calls[0].url.pathname).toBe("/auth/logout");
    expect(api.calls[0].headers["X-Requested-With"]).toBe("CampusLost");
    expect(storage.getItem(SESSION_HINT_KEY)).toBeNull();
    expect(notified).toBe(0);
    expect(await services.auth.getCurrentUser()).toBeNull();
  });

  it("falha de rede ou 401 no logout não impede sair: estado local limpo e sem refresh", async () => {
    const { api, storage, services } = createHarness();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply(new TypeError("fetch failed"));
    await services.auth.signOut();
    expect(storage.getItem(SESSION_HINT_KEY)).toBeNull();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply({ status: 500, text: "erro" });
    await services.auth.signOut();
    expect(storage.getItem(SESSION_HINT_KEY)).toBeNull();
    storage.setItem(SESSION_HINT_KEY, "1");
    api.reply(unauthenticated);
    await services.auth.signOut();
    expect(api.calls.every((c) => c.url.pathname === "/auth/logout")).toBe(true);
  });
});

describe("erros", () => {
  const cases: [number, unknown, ServiceErrorCode, string][] = [
    [400, { code: "VALIDATION", message: "Corpo inválido." }, "VALIDATION", "Corpo inválido."],
    [403, { code: "FORBIDDEN", message: "Somente a administração pode editar itens." }, "FORBIDDEN", "Somente a administração pode editar itens."],
    [404, { code: "NOT_FOUND", message: "Item não encontrado." }, "NOT_FOUND", "Item não encontrado."],
    [409, { code: "DUPLICATE_CLAIM", message: "Você já tem uma reivindicação em andamento para este item." }, "DUPLICATE_CLAIM", "Você já tem uma reivindicação em andamento para este item."],
    [409, { code: "ITEM_RETURNED", message: "Este item já foi devolvido." }, "ITEM_RETURNED", "Este item já foi devolvido."],
    [422, { code: "PHOTO_INVALID", message: "Formato não aceito. Use JPG, PNG ou WebP." }, "PHOTO_INVALID", "Formato não aceito. Use JPG, PNG ou WebP."],
    [500, { code: "UNEXPECTED", message: "Algo deu errado. Tente novamente." }, "UNEXPECTED", "Algo deu errado. Tente novamente."],
  ];
  it.each(cases)("HTTP %i com corpo JSON vira ServiceError(%s)", async (status, json, code, message) => {
    const { api, services } = createHarness();
    api.reply({ status, json });
    const error = await failure(services.items.get("item-03"));
    expect(error).toMatchObject({ code, message });
  });

  it("422 VALIDATION traz fieldErrors; EMAIL_TAKEN traz fieldErrors.email", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 422, json: { code: "VALIDATION", message: "Confira os campos destacados.", fieldErrors: { title: "Use pelo menos 3 caracteres.", x: 1 } } });
    const validation = await failure(services.claims.create("item-03", { proofDetails: "", lostWhereWhen: "" }));
    expect(validation.fieldErrors).toEqual({ title: "Use pelo menos 3 caracteres." });
    api.reply({ status: 409, json: { code: "EMAIL_TAKEN", message: "Este e-mail já está cadastrado.", fieldErrors: { email: "Este e-mail já está cadastrado." } } });
    const taken = await failure(services.auth.signUp({ name: "Marina", email: "marina@demo.test", password: "demonstracao123", role: "student", acceptedTerms: true }));
    expect(taken).toMatchObject({ code: "EMAIL_TAKEN", fieldErrors: { email: "Este e-mail já está cadastrado." } });
  });

  it("429 RATE_LIMITED usa o Retry-After na mensagem", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 429, json: { code: "RATE_LIMITED", message: "x" }, headers: { "Retry-After": "42" } });
    const error = await failure(services.auth.signIn({ email: "marina@demo.test", password: "demonstracao123" }));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.message).toBe("Muitas tentativas. Tente de novo em 42 segundos.");
    api.reply({ status: 429, json: { code: "RATE_LIMITED", message: "x" } });
    expect((await failure(services.auth.signIn({ email: "marina@demo.test", password: "demonstracao123" }))).message).toBe(
      "Muitas tentativas. Aguarde um instante e tente de novo.",
    );
    api.reply({ status: 429, json: { code: "RATE_LIMITED", message: "x" }, headers: { "Retry-After": "120" } });
    expect((await failure(services.auth.signIn({ email: "marina@demo.test", password: "demonstracao123" }))).message).toBe(
      "Muitas tentativas. Tente de novo em 2 minutos.",
    );
  });

  it("corpo que não é JSON cai no código do status; código desconhecido também", async () => {
    const { api, services } = createHarness();
    api.reply({ status: 502, text: "<html>Bad gateway</html>" });
    expect(await failure(services.items.list())).toMatchObject({ code: "UNEXPECTED", message: "Algo deu errado. Tente novamente." });
    api.reply({ status: 404, json: { code: "WAT", message: "" } });
    expect((await failure(services.items.get("x"))).code).toBe("NOT_FOUND");
  });

  it("erro de rede e timeout viram NETWORK com mensagem pt-BR", async () => {
    const { api, services } = createHarness();
    api.reply(new TypeError("fetch failed"));
    expect(await failure(services.items.list())).toMatchObject({
      code: "NETWORK",
      message: "Não foi possível falar com o servidor. Tente de novo em instantes.",
    });
    api.reply(Object.assign(new Error("aborted"), { name: "AbortError" }));
    expect((await failure(services.items.list())).code).toBe("NETWORK");
  });

  it("timeout aborta a requisição pendente", async () => {
    // fetch que nunca responde, mas respeita o sinal
    const hanging = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as typeof fetch;
    const { services } = createHarness({ timeoutMs: 20, fetch: hanging });
    expect((await failure(services.items.list())).code).toBe("NETWORK");
  });
});

describe("demonstração", () => {
  it("listDemoProfiles devolve perfis; 404/403 (demo desligado) devolvem lista vazia sem erro", async () => {
    const { api, services } = createHarness();
    api.reply({ json: [{ role: "student", label: "Entrar como aluno", user: rawUser }] });
    expect(await services.auth.listDemoProfiles()).toEqual([{ role: "student", label: "Entrar como aluno", user: rawUser }]);
    api.reply({ status: 404, json: { code: "NOT_FOUND", message: "Não encontrado." } });
    expect(await services.auth.listDemoProfiles()).toEqual([]);
    api.reply({ status: 403, json: { code: "FORBIDDEN", message: "Não permitido." } });
    expect(await services.auth.listDemoProfiles()).toEqual([]);
    api.reply(new TypeError("fetch failed"));
    expect((await failure(services.auth.listDemoProfiles())).code).toBe("NETWORK");
  });

  it("reset chama /demo/reset e avisa os ouvintes; 404 vira mensagem amigável", async () => {
    const { api, services } = createHarness();
    let notified = 0;
    services.subscribe(() => notified++);
    api.reply({ status: 204 });
    await services.demo.reset();
    expect(api.calls[0]).toMatchObject({ method: "POST" });
    expect(api.calls[0].url.pathname).toBe("/demo/reset");
    expect(notified).toBe(1);
    api.reply({ status: 404, json: { code: "NOT_FOUND", message: "Não encontrado." } });
    expect(await failure(services.demo.reset())).toMatchObject({
      code: "NOT_FOUND",
      message: "A demonstração não está disponível neste servidor.",
    });
    expect(services.demo.persistence()).toBe("durable");
  });
});
