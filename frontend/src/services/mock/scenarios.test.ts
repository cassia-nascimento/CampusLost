/**
 * Cenários de aceite (SPEC §7) exercitados pelos serviços mockados.
 * Seed: item-03 (2 pendentes), item-04 (recusada, Disponível), item-05 (aceita, Marina),
 * item-07 (Marina e Beatriz pendentes), item-10/11 (Devolvidos).
 */
import { describe, expect, it, vi } from "vitest";
import { addDays, toLocalDateString } from "@/lib/rules/dates";
import { DEMO_PASSWORD } from "./seed";
import { DB_KEY, SESSION_KEY } from "./store";
import { createHarness, deliverItem, expectCode, fakeFile, validClaim, validItem, type Harness, signInAsRafael, userOf } from "./test-utils";

const CREATOR_MESSAGE = "Você registrou este item, então não pode reivindicá-lo. Se ele é seu, procure a administração.";

function signInAsLucas(h: Harness) {
  return h.services.auth.signIn({ email: "lucas@demo.test", password: DEMO_PASSWORD });
}

/** `student` = usuário institucional demo (Marina); `teacher` = Rafael (usuário institucional de apoio); `admin`. */
async function as(h: Harness, who: "student" | "teacher" | "admin") {
  if (who === "teacher") return signInAsRafael(h.services);
  return h.services.auth.signInAsDemo(who === "student" ? "user" : "admin");
}

describe("RF01 — autenticação simulada", () => {
  it("AC01.3: perfis de demonstração entram com um toque", async () => {
    const h = createHarness();
    const profiles = await h.services.auth.listDemoProfiles();
    expect(profiles.map((p) => p.key)).toEqual(["user", "admin"]);
    expect(profiles.map((p) => p.label)).toEqual(["Usuário", "Administração"]);
    expect(profiles.every((p) => p.user.email.endsWith("@demo.test"))).toBe(true);
    for (const p of profiles) {
      const user = await h.services.auth.signInAsDemo(p.key);
      expect(user.id).toBe(p.user.id);
      expect(user.role).toBe(p.key === "admin" ? "admin" : "user");
      expect(user.affiliation).toBe("institutional");
      expect((await h.services.auth.getCurrentUser())?.id).toBe(user.id);
    }
  });

  it("AC01.1: cadastro cria conta e sessão; e-mail repetido (qualquer caixa) dá erro", async () => {
    const h = createHarness();
    const user = await h.services.auth.signUp({ name: "Carla Dias", email: "Carla@Demo.test", password: "senha-segura-1", acceptedTerms: true });
    expect(user).toMatchObject({ name: "Carla Dias", email: "carla@demo.test" });
    expect((await h.services.auth.getCurrentUser())?.id).toBe(user.id);
    const err = await expectCode(
      h.services.auth.signUp({ name: "Outra Carla", email: " CARLA@demo.test ", password: "senha-segura-1", acceptedTerms: true }),
      "EMAIL_TAKEN",
    );
    expect(err.fieldErrors?.email).toBeTruthy();
    await expectCode(h.services.auth.signUp({ name: "Marina", email: "marina@demo.test", password: "senha-segura-1", acceptedTerms: true }), "EMAIL_TAKEN");
  });

  it("AC01.1: cadastro valida campos; um `role` enviado é ignorado e nunca cria admin", async () => {
    const h = createHarness();
    const err = await expectCode(
      h.services.auth.signUp({ name: "", email: "x", password: "", role: "admin", acceptedTerms: true } as never),
      "VALIDATION",
    );
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(["email", "name", "password"]);
  });

  it("AC01.2: login por e-mail + senha cria sessão; e-mail inexistente e senha errada dão o mesmo erro", async () => {
    const h = createHarness();
    const user = userOf(await h.services.auth.signIn({ email: " MARINA@demo.test ", password: DEMO_PASSWORD }));
    expect(user.id).toBe("user-marina");
    await h.services.auth.signOut();
    const noUser = await expectCode(
      h.services.auth.signIn({ email: "ninguem@demo.test", password: DEMO_PASSWORD }),
      "INVALID_CREDENTIALS",
    );
    const wrong = await expectCode(
      h.services.auth.signIn({ email: "marina@demo.test", password: "errada-errada" }),
      "INVALID_CREDENTIALS",
    );
    expect(noUser.message).toBe("E-mail ou senha incorretos.");
    expect(wrong.message).toBe(noUser.message);
    expect(wrong.fieldErrors).toEqual(noUser.fieldErrors);
    expect(await h.services.auth.getCurrentUser()).toBeNull();
  });

  it("AC01.4: sair encerra a sessão; operações protegidas pedem login", async () => {
    const h = createHarness();
    await as(h, "student");
    await h.services.auth.signOut();
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    expect((await h.services.items.list()).length).toBeGreaterThan(0); // visitante vê a lista (P26)
    await expectCode(h.services.items.create(validItem), "UNAUTHENTICATED");
    await expectCode(h.services.claims.listMine(), "UNAUTHENTICATED");
    await expectCode(h.services.claims.create("item-01", validClaim), "UNAUTHENTICATED");
  });
});

describe("RF02 — registrar item", () => {
  it("AC02.1/AC02.3: qualquer perfil registra; item nasce Disponível e vai ao topo da busca", async () => {
    for (const role of ["student", "teacher", "admin"] as const) {
      const h = createHarness();
      const user = await as(h, role);
      h.advance(60_000);
      const item = await h.services.items.create({ ...validItem, title: `Item de ${role}` });
      expect(item).toMatchObject({ status: "available", createdById: user.id, title: `Item de ${role}` });
      expect(item.photoDataUrl).toBeUndefined();
      expect((await h.services.items.list())[0].id).toBe(item.id);
    }
  });

  it("AC02.1: exige campos, data não futura (relógio injetado) e listas válidas", async () => {
    const h = createHarness();
    await as(h, "student");
    const before = (await h.services.items.list()).length;
    const tomorrow = toLocalDateString(addDays(h.clock(), 1));
    const err = await expectCode(
      h.services.items.create({ ...validItem, foundDate: tomorrow, title: "", foundLocation: "  ", category: "Joias" as never }),
      "VALIDATION",
    );
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(["category", "foundDate", "foundLocation", "title"]);
    expect((await h.services.items.list()).length).toBe(before);
  });

  it("AC02.1: local livre; storedAt obrigatório; Outros exige categoryOther; outra categoria o zera", async () => {
    const h = createHarness();
    await as(h, "student");
    const place = "Bloco C, segundo andar, próximo ao laboratório 04";
    const created = await h.services.items.create({ ...validItem, foundLocation: ` ${place} ` });
    expect(created.foundLocation).toBe(place);
    expect(created.categoryOther).toBe("Garrafa térmica");
    const err = await expectCode(h.services.items.create({ ...validItem, categoryOther: "" }), "VALIDATION");
    expect(err.fieldErrors).toEqual({ categoryOther: "Especifique a categoria." });
    const noStored = await expectCode(h.services.items.create({ ...validItem, storedAt: "   " }), "VALIDATION");
    expect(noStored.fieldErrors).toEqual({ storedAt: "Informe onde o item está guardado." });
    const other = await h.services.items.create({ ...validItem, category: "Roupas" });
    expect(other.categoryOther).toBeNull();
    await h.services.auth.signOut();
    await as(h, "admin");
    // o item guardado fica completo; categoryOther descartado
    expect((await h.services.items.get(created.id)).item.storedAt).toBe("Portaria");
    expect((await h.services.items.get(other.id)).item).toMatchObject({ storedAt: "Portaria", categoryOther: null });
  });

  it("AC02.2: foto opcional é processada e guardada; formato inválido é rejeitado", async () => {
    const h = createHarness();
    await as(h, "student");
    const item = await h.services.items.create({ ...validItem, photo: fakeFile("capa.jpg") });
    expect(item.photoDataUrl).toBe("data:image/jpeg;base64,FAKE-capa.jpg");
    expect((await h.services.items.get(item.id)).item.photoDataUrl).toBe(item.photoDataUrl);

    const strict = createHarness({ photoProcessor: undefined });
    await as(strict, "student");
    await expectCode(strict.services.items.create({ ...validItem, photo: fakeFile("x.gif", "image/gif") }), "PHOTO_INVALID");
  });
});

describe("RF03 — busca", () => {
  it("AC03.2/AC03.4: sem devolvidos, com Em reivindicação, mais recentes primeiro", async () => {
    const h = createHarness();
    await as(h, "student");
    const list = await h.services.items.list();
    expect(list.map((i) => i.status)).not.toContain("returned");
    expect(list.some((i) => i.status === "under_claim")).toBe(true);
    const created = list.map((i) => i.createdAt);
    expect(created).toEqual([...created].sort().reverse());
    expect(list.map((i) => i.id)).not.toContain("item-10");
    expect(list.map((i) => i.id)).not.toContain("item-11");
  });

  it("AC03.3/AC03.5: filtros combinam; vazio quando nada casa; limpar volta ao total", async () => {
    const h = createHarness();
    await as(h, "teacher");
    const all = await h.services.items.list();
    const eletronicos = await h.services.items.list({ category: "Eletrônicos" });
    expect(eletronicos.length).toBeGreaterThan(0);
    expect(eletronicos.every((i) => i.category === "Eletrônicos")).toBe(true);
    const biblioteca = await h.services.items.list({ category: "Eletrônicos", location: "Biblioteca" });
    expect(biblioteca.every((i) => i.foundLocation === "Biblioteca")).toBe(true);
    // texto livre: "contém", sem caixa e sem acentos
    const parcial = await h.services.items.list({ category: "Eletrônicos", location: "  BIBLIOTÊ " });
    expect(parcial.map((i) => i.id)).toEqual(biblioteca.map((i) => i.id));
    expect((await h.services.items.list({ location: "lioteca" })).length).toBeGreaterThan(0);
    await expectCode(h.services.items.list({ location: "x".repeat(121) }), "VALIDATION");
    expect(biblioteca.length).toBeLessThan(eletronicos.length);
    const today = toLocalDateString(h.clock());
    expect((await h.services.items.list({ from: today, to: today })).every((i) => i.foundDate === today)).toBe(true);
    expect(await h.services.items.list({ category: "Documentos", location: "Cantina" })).toEqual([]);
    expect(await h.services.items.list({ category: "", location: "" })).toEqual(all);
    await expectCode(h.services.items.list({ from: "2026-10-19", to: "2026-10-01" }), "VALIDATION");
  });

  it("detalhe: usuário comum não vê reivindicações de outros; administração vê todas", async () => {
    const h = createHarness();
    await as(h, "student");
    const asStudent = await h.services.items.get("item-07");
    expect(asStudent.claims).toEqual([]);
    expect(asStudent.myClaims).toHaveLength(1);
    expect(asStudent.createdBy).toEqual({ id: "user-lucas", name: "Lucas Prado", role: "user" });
    await as(h, "admin");
    const asAdmin = await h.services.items.get("item-07");
    expect(asAdmin.claims.map((c) => c.claimant.name)).toEqual(["Marina Alves", "Beatriz Nunes"]);
    expect(asAdmin.claims[0].claimant.email).toBe("marina@demo.test");
    await expectCode(h.services.items.get("nao-existe"), "NOT_FOUND");
  });
});

describe("RF04 — reivindicação", () => {
  it("AC04.2: reivindicar item Disponível o coloca Em reivindicação", async () => {
    const h = createHarness();
    await as(h, "student");
    const claim = await h.services.claims.create("item-01", validClaim);
    expect(claim).toMatchObject({ itemId: "item-01", claimantId: "user-marina", status: "pending" });
    expect((await h.services.items.get("item-01")).item.status).toBe("under_claim");
    expect((await h.services.items.list({ status: "under_claim" })).map((i) => i.id)).toContain("item-01");
  });

  it("AC04.3: usuários diferentes reivindicam o mesmo item", async () => {
    const h = createHarness();
    await as(h, "student");
    await h.services.claims.create("item-02", validClaim);
    await as(h, "teacher");
    await h.services.claims.create("item-02", validClaim);
    await as(h, "admin");
    expect((await h.services.claims.listByItem("item-02")).map((c) => c.status)).toEqual(["pending", "pending"]);
    expect((await h.services.items.get("item-02")).item.status).toBe("under_claim");
  });

  it("AC04.1: duplicada, recusada, aceita-de-outro e papéis são bloqueados com o código certo", async () => {
    const h = createHarness();
    await as(h, "student"); // Marina: pendente no item-07, recusada no item-04, aceita no item-05
    await expectCode(h.services.claims.create("item-07", validClaim), "DUPLICATE_CLAIM");
    await expectCode(h.services.claims.create("item-05", validClaim), "DUPLICATE_CLAIM");
    await expectCode(h.services.claims.create("item-04", validClaim), "CLAIM_BLOCKED"); // AC04.7
    await expectCode(h.services.claims.create("item-10", validClaim), "ITEM_RETURNED");
    await h.services.auth.signIn({ email: "externo@demo.test", password: DEMO_PASSWORD });
    await expectCode(h.services.claims.create("item-05", validClaim), "CLAIM_BLOCKED"); // já há aceita (item de Rafael)
    await as(h, "admin");
    await expectCode(h.services.claims.create("item-01", validClaim), "FORBIDDEN");
  });

  it("P46: quem registrou o item não pode reivindicá-lo (nada é gravado)", async () => {
    const h = createHarness();
    await as(h, "student");
    const mine = await h.services.items.create(validItem);
    const d = await h.services.items.get(mine.id);
    expect(d.viewer.claim).toEqual({ allowed: false, code: "FORBIDDEN", message: CREATOR_MESSAGE });
    const err = await expectCode(h.services.claims.create(mine.id, validClaim), "FORBIDDEN");
    expect(err.message).toBe(CREATOR_MESSAGE);
    expect((await h.services.items.get(mine.id)).item.status).toBe("available");
    await as(h, "admin");
    expect(await h.services.claims.listByItem(mine.id)).toEqual([]);
  });

  it("P46 ponta a ponta: A cadastra e é recusada; B reivindica; cadastrar não confere posse", async () => {
    const h = createHarness();
    await as(h, "student"); // A = Marina
    const mine = await h.services.items.create(validItem);
    await expectCode(h.services.claims.create(mine.id, validClaim), "FORBIDDEN");
    await as(h, "teacher"); // B = Rafael
    expect((await h.services.items.get(mine.id)).viewer.claim).toEqual({ allowed: true });
    const claim = await h.services.claims.create(mine.id, validClaim);
    expect(claim.claimantId).toBe("user-rafael");
    expect((await h.services.items.get(mine.id)).item.status).toBe("under_claim");
    await as(h, "student"); // A segue bloqueada e sem reivindicação própria
    const d = await h.services.items.get(mine.id);
    expect(d.viewer.claim).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(d.myClaims).toEqual([]);
    await as(h, "admin");
    await h.services.claims.accept(claim.id);
    const accepted = (await h.services.claims.listByItem(mine.id)).filter((c) => c.status === "accepted");
    expect(accepted.map((c) => c.claimantId)).toEqual(["user-rafael"]); // proprietário confirmado = solicitante aceito
  });

  it("P46: a regra é por item; quem cadastrou outros itens reivindica o de outra pessoa", async () => {
    const h = createHarness();
    await as(h, "student");
    await h.services.items.create(validItem);
    expect((await h.services.items.get("item-01")).viewer.claim).toEqual({ allowed: true }); // item-01: Rafael
    await h.services.claims.create("item-01", validClaim);
  });

  it("P46: item com reivindicações de terceiros — cadastrante vê o bloqueio e nada é alterado", async () => {
    const h = createHarness();
    await signInAsLucas(h); // registrou item-03 (claim-01 Beatriz e claim-02 Rafael pendentes)
    expect((await h.services.items.get("item-03")).viewer.claim).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    await expectCode(h.services.claims.create("item-03", validClaim), "FORBIDDEN");
    await as(h, "admin");
    expect((await h.services.claims.listByItem("item-03")).map((c) => c.id)).toEqual(["claim-01", "claim-02"]);
    expect((await h.services.items.get("item-03")).item.status).toBe("under_claim");
  });

  it("P46: administração que cadastrou o item continua sem reivindicar e não vira proprietária", async () => {
    const h = createHarness();
    await as(h, "admin");
    const mine = await h.services.items.create(validItem);
    const d = await h.services.items.get(mine.id);
    expect(d.viewer.claim).toEqual({
      allowed: false,
      code: "FORBIDDEN",
      message: "A administração analisa reivindicações, mas não reivindica itens.",
    });
    await expectCode(h.services.claims.create(mine.id, validClaim), "FORBIDDEN");
    expect(await h.services.claims.listByItem(mine.id)).toEqual([]);
  });

  it("P46: visitante continua UNAUTHENTICATED", async () => {
    const h = createHarness();
    await expectCode(h.services.claims.create("item-01", validClaim), "UNAUTHENTICATED");
  });

  it("P7: as duas perguntas são obrigatórias", async () => {
    const h = createHarness();
    await as(h, "student");
    const err = await expectCode(h.services.claims.create("item-01", { proofDetails: "", lostWhereWhen: "" }), "VALIDATION");
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(["lostWhereWhen", "proofDetails"]);
    expect((await h.services.items.get("item-01")).item.status).toBe("available");
  });

  it("AC04.4: administração vê as pendentes (mais antigas primeiro); usuário comum não", async () => {
    const h = createHarness();
    await as(h, "admin");
    const pending = await h.services.claims.listPending();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((c) => c.status === "pending" && c.claimant.email && c.item.id)).toBe(true);
    const times = pending.map((c) => c.createdAt);
    expect(times).toEqual([...times].sort());
    await as(h, "student");
    await expectCode(h.services.claims.listPending(), "FORBIDDEN");
    await expectCode(h.services.claims.accept("claim-01"), "FORBIDDEN");
    await expectCode(h.services.claims.reject("claim-01"), "FORBIDDEN");
    await expectCode(h.services.claims.listByItem("item-03"), "FORBIDDEN");
  });

  it("AC04.5: aceitar recusa as demais e mantém o item Em reivindicação", async () => {
    const h = createHarness();
    await as(h, "admin");
    h.advance(1000);
    const res = await h.services.claims.accept("claim-01"); // item-03: claim-01 (Beatriz) e claim-02 (Rafael)
    expect(res.claim.status).toBe("accepted");
    expect(res.claim.reviewedAt).toBe(h.clock().toISOString());
    expect(res.autoRejectedIds).toEqual(["claim-02"]);
    expect(res.item.status).toBe("under_claim");
    const claims = await h.services.claims.listByItem("item-03");
    expect(claims.map((c) => [c.id, c.status])).toEqual([["claim-01", "accepted"], ["claim-02", "rejected"]]);
    expect((await h.services.items.get("item-03")).item.status).toBe("under_claim");
    // a reivindicação recusada automaticamente não pode ser analisada de novo
    await expectCode(h.services.claims.accept("claim-02"), "INVALID_TRANSITION");
  });

  it("AC04.6: recusar a última ativa devolve o item a Disponível; recusar uma entre várias, não", async () => {
    const h = createHarness();
    await as(h, "admin");
    const first = await h.services.claims.reject("claim-06"); // item-07 ainda tem claim-07 pendente
    expect(first.item.status).toBe("under_claim");
    const last = await h.services.claims.reject("claim-07");
    expect(last.item.status).toBe("available");
    expect((await h.services.items.get("item-07")).item.status).toBe("available");
    await expectCode(h.services.claims.reject("claim-07"), "INVALID_TRANSITION");
    await expectCode(h.services.claims.reject("claim-inexistente"), "NOT_FOUND");
  });

  it("AC04.7/AC04.8: o usuário recusado vê 'Recusada' e não reenvia; Minhas reivindicações refletem a decisão tomada em outra aba", async () => {
    // Simula o evento `storage` do navegador (só ele avisa uma aba do que outra gravou).
    const handlers: Array<(event: { key: string | null }) => void> = [];
    vi.stubGlobal("window", { addEventListener: (_type: string, fn: (event: { key: string | null }) => void) => void handlers.push(fn) });
    try {
      const studentTab = createHarness();
      const adminTab = createHarness({ storage: studentTab.storage }); // mesmo banco, sessão própria
      await as(studentTab, "student");
      await as(adminTab, "admin");

      const seen: string[] = [];
      const inflight: Promise<unknown>[] = [];
      const off = studentTab.services.subscribe(() => {
        inflight.push(
          studentTab.services.claims.listMine().then((list) => {
            seen.push(...list.map((c) => `${c.id}:${c.status}`));
          }),
        );
      });

      const before = await studentTab.services.claims.listMine();
      expect(before.map((c) => [c.id, c.status]).sort()).toEqual([
        ["claim-03", "rejected"],
        ["claim-04", "accepted"],
        ["claim-06", "pending"],
      ]);
      expect(before.every((c) => c.item.title)).toBe(true);

      await adminTab.services.claims.reject("claim-06");
      handlers.forEach((fn) => fn({ key: DB_KEY })); // o navegador avisa a aba da aluna
      await Promise.all(inflight);
      expect(seen).toContain("claim-06:rejected");

      // a sessão é por aba: um evento da chave de sessão não deve disparar nada
      const count = inflight.length;
      handlers.forEach((fn) => fn({ key: SESSION_KEY }));
      expect(inflight.length).toBe(count);

      // item-07 ainda tem a pendente de Beatriz; Marina não pode reenviar
      await expectCode(studentTab.services.claims.create("item-07", validClaim), "CLAIM_BLOCKED");
      off();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("claims.get: administração ou o próprio autor; outros não", async () => {
    const h = createHarness();
    await as(h, "student");
    expect((await h.services.claims.get("claim-04")).item.id).toBe("item-05");
    await expectCode(h.services.claims.get("claim-01"), "FORBIDDEN");
    await expectCode(h.services.claims.get("zzz"), "NOT_FOUND");
    await as(h, "admin");
    expect((await h.services.claims.get("claim-01")).claimant.name).toBe("Beatriz Nunes");
  });

  it("administração e visitante não têm 'Minhas reivindicações'", async () => {
    const h = createHarness();
    await as(h, "admin");
    await expectCode(h.services.claims.listMine(), "FORBIDDEN");
  });
});

describe("RF05 — devolução", () => {
  it("AC05.1/AC05.2: só com reivindicação aceita; item vira Devolvido, some da busca e aparece na listagem", async () => {
    const h = createHarness();
    await as(h, "admin");
    await expectCode(h.services.returns.register("item-03"), "INVALID_TRANSITION"); // só pendentes
    await expectCode(h.services.returns.register("item-01"), "INVALID_TRANSITION"); // Disponível

    h.advance(5000);
    const view = await deliverItem(h, "item-05"); // aceita: Marina (gera o código, a administração valida e confirma)
    expect(view).toMatchObject({
      itemId: "item-05",
      claimId: "claim-04",
      returnedToId: "user-marina",
      registeredById: "user-admin",
      returnedAt: h.clock().toISOString(),
    });
    expect(view.item.status).toBe("returned");
    expect(view.returnedTo.name).toBe("Marina Alves");
    expect(view.registeredBy.name).toBe("Administração Demo");

    expect((await h.services.items.list()).map((i) => i.id)).not.toContain("item-05");
    const returns = await h.services.returns.list();
    expect(returns[0].itemId).toBe("item-05"); // mais recente primeiro
    expect(returns).toHaveLength(3);
    const detail = await h.services.items.get("item-05"); // detalhe segue acessível, somente leitura
    expect(detail.item.status).toBe("returned");
    expect(detail.returnRecord?.id).toBe(view.id);
    await expectCode(h.services.returns.register("item-05"), "ITEM_RETURNED");
  });

  it("fluxo completo: registrar → reivindicar → aceitar → devolver → listar", async () => {
    const h = createHarness();
    await as(h, "teacher");
    const item = await h.services.items.create(validItem);
    await as(h, "student");
    const claim = await h.services.claims.create(item.id, validClaim);
    await as(h, "admin");
    await h.services.claims.accept(claim.id);
    const ret = await deliverItem(h, item.id);
    expect(ret.returnedTo.id).toBe("user-marina");
    expect((await h.services.returns.list()).map((r) => r.itemId)).toContain(item.id);
    await as(h, "student");
    expect((await h.services.claims.listMine()).find((c) => c.id === claim.id)).toMatchObject({ status: "accepted", item: { status: "returned" } });
  });

  it("AC05.1: usuário comum não registra nem lista devoluções", async () => {
    const h = createHarness();
    for (const role of ["student", "teacher"] as const) {
      await as(h, role);
      await expectCode(h.services.returns.register("item-05"), "FORBIDDEN");
      await expectCode(h.services.returns.list(), "FORBIDDEN");
    }
    await h.services.auth.signOut();
    await expectCode(h.services.returns.list(), "UNAUTHENTICATED");
  });

  it("AC05.3: listagem filtra por período (data da devolução) e valida o intervalo", async () => {
    const h = createHarness();
    await as(h, "admin");
    const all = await h.services.returns.list();
    expect(all.map((r) => r.id)).toEqual(["return-01", "return-02"]);
    const today = toLocalDateString(h.clock());
    expect(await h.services.returns.list({ from: today })).toEqual([]);
    const since = toLocalDateString(addDays(h.clock(), -6));
    expect((await h.services.returns.list({ from: since })).map((r) => r.id)).toEqual(["return-01"]);
    expect(await h.services.returns.list({ from: "", to: "" })).toEqual(all);
    await expectCode(h.services.returns.list({ from: "2026-10-19", to: "2026-10-01" }), "VALIDATION");
  });
});

describe("AC06.1 — editar e excluir", () => {
  it("só administração edita; status e autoria permanecem", async () => {
    const h = createHarness();
    await as(h, "student");
    await expectCode(h.services.items.update("item-01", validItem), "FORBIDDEN");
    await expectCode(h.services.items.delete("item-01"), "FORBIDDEN");
    await as(h, "teacher");
    await expectCode(h.services.items.update("item-01", validItem), "FORBIDDEN");

    await as(h, "admin");
    const updated = await h.services.items.update("item-03", { ...validItem, title: "Chaveiro (editado)" });
    expect(updated).toMatchObject({ id: "item-03", title: "Chaveiro (editado)", status: "under_claim", createdById: "user-lucas" });
    await expectCode(h.services.items.update("zzz", validItem), "NOT_FOUND");
    await expectCode(h.services.items.update("item-01", { ...validItem, title: "" }), "VALIDATION");
  });

  it("foto na edição: undefined mantém, File substitui, null remove", async () => {
    const h = createHarness();
    await as(h, "admin");
    const withPhoto = await h.services.items.update("item-01", { ...validItem, photo: fakeFile("a.jpg") });
    expect(withPhoto.photoDataUrl).toContain("FAKE-a.jpg");
    expect((await h.services.items.update("item-01", validItem)).photoDataUrl).toContain("FAKE-a.jpg");
    expect((await h.services.items.update("item-01", { ...validItem, photo: fakeFile("b.jpg") })).photoDataUrl).toContain("FAKE-b.jpg");
    expect((await h.services.items.update("item-01", { ...validItem, photo: null })).photoDataUrl).toBeUndefined();
  });

  it("foto ilustrativa do seed (/seed/*.svg|webp) é mantida ao editar sem trocar a foto (P27)", async () => {
    const h = createHarness();
    await as(h, "admin");
    const before = (await h.services.items.get("item-01")).item.photoDataUrl;
    expect(before).toBe("/seed/fones-de-ouvido.webp");
    expect((await h.services.items.update("item-01", { ...validItem, title: "Fones novos" })).photoDataUrl).toBe(before);
    expect((await h.services.items.get("item-01")).item.photoDataUrl).toBe(before);
    expect((await h.services.items.update("item-01", { ...validItem, photo: null })).photoDataUrl).toBeUndefined();
  });

  it("item Devolvido não é editável nem excluível", async () => {
    const h = createHarness();
    await as(h, "admin");
    await expectCode(h.services.items.update("item-10", validItem), "ITEM_RETURNED");
    await expectCode(h.services.items.delete("item-10"), "ITEM_RETURNED");
    expect((await h.services.items.get("item-10")).item.status).toBe("returned");
  });

  it("excluir remove o item e suas reivindicações", async () => {
    const h = createHarness();
    await as(h, "admin");
    await h.services.items.delete("item-03");
    await expectCode(h.services.items.get("item-03"), "NOT_FOUND");
    expect((await h.services.claims.listPending()).some((c) => c.itemId === "item-03")).toBe(false);
    await as(h, "teacher");
    expect((await h.services.claims.listMine()).some((c) => c.itemId === "item-03")).toBe(false);
    await expectCode(h.services.items.delete("item-03"), "NOT_FOUND");
  });
});

describe("invariantes da máquina de estados após sequências de operações", () => {
  it("nenhum caminho leva Devolvido de volta, nem produz duas aceitas no mesmo item", async () => {
    const h = createHarness();
    await as(h, "admin");
    await h.services.claims.accept("claim-06");
    await expectCode(h.services.claims.accept("claim-07"), "INVALID_TRANSITION"); // recusada automaticamente
    await deliverItem(h, "item-07");
    await expectCode(h.services.claims.reject("claim-06"), "ITEM_RETURNED");
    const detail = await h.services.items.get("item-07");
    expect(detail.claims.filter((c) => c.status === "accepted")).toHaveLength(1);
    expect(detail.item.status).toBe("returned");
  });

  it("corrida real: dois accept simultâneos no mesmo item → um sucesso, o outro INVALID_TRANSITION, uma única aceita", async () => {
    const h = createHarness();
    await as(h, "admin");
    const results = await Promise.allSettled([
      h.services.claims.accept("claim-06"),
      h.services.claims.accept("claim-07"),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: "INVALID_TRANSITION" });
    const claims = await h.services.claims.listByItem("item-07");
    expect(claims.filter((c) => c.status === "accepted")).toHaveLength(1);
    expect(claims.filter((c) => c.status === "pending")).toHaveLength(0);
  });

  it("duas reivindicações simultâneas de usuários diferentes em item Disponível → Em reivindicação com duas pendentes", async () => {
    const studentTab = createHarness();
    const teacherTab = createHarness({ storage: studentTab.storage });
    await as(studentTab, "student");
    await as(teacherTab, "teacher");
    const results = await Promise.all([
      studentTab.services.claims.create("item-02", validClaim),
      teacherTab.services.claims.create("item-02", validClaim),
    ]);
    expect(new Set(results.map((c) => c.claimantId))).toEqual(new Set(["user-marina", "user-rafael"]));
    const adminTab = createHarness({ storage: studentTab.storage });
    await as(adminTab, "admin");
    const detail = await adminTab.services.items.get("item-02");
    expect(detail.item.status).toBe("under_claim");
    expect(detail.claims.map((c) => c.status)).toEqual(["pending", "pending"]);
  });

  it("duas reivindicações simultâneas do MESMO usuário → uma criada e a outra DUPLICATE_CLAIM", async () => {
    const h = createHarness();
    await as(h, "student");
    const results = await Promise.allSettled([
      h.services.claims.create("item-01", validClaim),
      h.services.claims.create("item-01", validClaim),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: "DUPLICATE_CLAIM" });
    await as(h, "admin");
    expect((await h.services.claims.listByItem("item-01")).filter((c) => c.claimantId === "user-marina")).toHaveLength(1);
  });
});

describe("ItemDetail.viewer (B1)", () => {
  it("terceiro no item com reivindicação aceita de outra pessoa: claim bloqueado com CLAIM_BLOCKED, sem vazar reivindicações alheias", async () => {
    const h = createHarness();
    await h.services.auth.signIn({ email: "externo@demo.test", password: DEMO_PASSWORD }); // Camila (item-05 é de Rafael)
    const d = await h.services.items.get("item-05"); // aceita: Marina
    expect(d.viewer.claim).toMatchObject({ allowed: false, code: "CLAIM_BLOCKED" });
    expect(d.viewer.claim.allowed === false && d.viewer.claim.message).toMatch(/aceita/);
    expect(d.viewer.edit).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(d.viewer.delete).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(d.viewer.registerReturn).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(d.claims).toEqual([]);
    expect(d.myClaims).toEqual([]);
    expect(JSON.stringify(d)).not.toContain("claim-04");
  });

  it("aluna com reivindicação aceita própria vê a mensagem específica; recusada → CLAIM_BLOCKED; item livre → permitido", async () => {
    const h = createHarness();
    await as(h, "student"); // Marina
    const own = (await h.services.items.get("item-05")).viewer.claim;
    expect(own).toMatchObject({ allowed: false, code: "DUPLICATE_CLAIM", message: "Sua reivindicação foi aceita. Procure a administração para retirar o item." });
    expect((await h.services.items.get("item-07")).viewer.claim).toMatchObject({ allowed: false, code: "DUPLICATE_CLAIM" });
    expect((await h.services.items.get("item-04")).viewer.claim).toMatchObject({ allowed: false, code: "CLAIM_BLOCKED" });
    expect((await h.services.items.get("item-01")).viewer.claim).toEqual({ allowed: true });
    expect((await h.services.items.get("item-10")).viewer.claim).toMatchObject({ allowed: false, code: "ITEM_RETURNED" });
  });

  it("administração: registerReturn coerente com reivindicação aceita; edit/delete bloqueados em Devolvido; claim negado", async () => {
    const h = createHarness();
    await as(h, "admin");
    const accepted = (await h.services.items.get("item-05")).viewer;
    expect(accepted.registerReturn).toEqual({ allowed: true });
    expect(accepted.edit).toEqual({ allowed: true });
    expect(accepted.delete).toEqual({ allowed: true });
    expect(accepted.claim).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect((await h.services.items.get("item-03")).viewer.registerReturn).toMatchObject({ allowed: false, code: "INVALID_TRANSITION" });
    expect((await h.services.items.get("item-01")).viewer.registerReturn).toMatchObject({ allowed: false, code: "INVALID_TRANSITION" });
    const returned = await h.services.items.get("item-10");
    expect(returned.viewer.edit).toMatchObject({ allowed: false, code: "ITEM_RETURNED" });
    expect(returned.viewer.delete).toMatchObject({ allowed: false, code: "ITEM_RETURNED" });
    expect(returned.viewer.registerReturn).toMatchObject({ allowed: false, code: "ITEM_RETURNED" });
    expect(returned.returnRecord?.id).toBe("return-01");
  });

  it("viewer acompanha a mudança de estado (aceitar → registerReturn permitido)", async () => {
    const h = createHarness();
    await as(h, "admin");
    expect((await h.services.items.get("item-03")).viewer.registerReturn.allowed).toBe(false);
    await h.services.claims.accept("claim-01");
    expect((await h.services.items.get("item-03")).viewer.registerReturn.allowed).toBe(true);
  });

  it("usuário comum nunca recebe returnRecord", async () => {
    const h = createHarness();
    await as(h, "student");
    expect((await h.services.items.get("item-10")).returnRecord).toBeNull();
  });
});

describe("usuário capturado antes da latência (I2)", () => {
  /** Mesma "aba" (banco e sessão compartilhados), uma rápida e uma com latência. */
  function pair() {
    const fast = createHarness({ latency: 0 });
    const slow = createHarness({ storage: fast.storage, sessionStorage: fast.sessionStorage, latency: 100 });
    return { fast, slow };
  }

  it("a operação usa o usuário da chamada, mesmo que a sessão mude durante a latência", async () => {
    vi.useFakeTimers();
    try {
      const { fast, slow } = pair();
      await as(fast, "student");
      const pending = slow.services.items.list(); // captura Marina agora
      await fast.services.auth.signOut();
      await vi.advanceTimersByTimeAsync(100);
      expect((await pending).length).toBeGreaterThan(0);
      // e uma chamada nova, já sem sessão, falha
      const after = expectCode(slow.services.claims.listMine(), "UNAUTHENTICATED");
      await vi.advanceTimersByTimeAsync(100);
      await after;
    } finally {
      vi.useRealTimers();
    }
  });

  it("revalida na transação: se o usuário deixou de existir (reinício da demo), UNAUTHENTICATED e nada é gravado", async () => {
    vi.useFakeTimers();
    try {
      const { fast, slow } = pair();
      await fast.services.auth.signUp({ name: "Carla Dias", email: "carla@demo.test", password: "senha-segura-1", acceptedTerms: true });

      const attempt = expectCode(slow.services.items.create(validItem), "UNAUTHENTICATED"); // captura Carla
      await fast.services.demo.reset(); // Carla não existe no seed
      await vi.advanceTimersByTimeAsync(100);
      const error = await attempt;
      expect(error.message).toMatch(/sessão expirou/);

      await fast.services.auth.signInAsDemo("admin");
      expect((await fast.services.items.list()).some((i) => i.title === validItem.title)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("P26 — visitante (sem sessão) vê lista e detalhe", () => {
  it("lista sem login: sem devolvidos, sem storedAt, mesmos filtros e ordenação do logado", async () => {
    const h = createHarness();
    const guest = await h.services.items.list();
    expect(guest.length).toBe(9);
    expect(guest.some((i) => i.status === "returned")).toBe(false);
    expect(guest.every((i) => !("storedAt" in i))).toBe(true);
    expect(guest.every((i) => i.photoDataUrl)).toBe(true);
    expect(guest.every((i) => !("createdById" in i) && !("createdBy" in i))).toBe(true);
    const guestItem03 = guest.find((i) => i.id === "item-03");
    expect(guestItem03).toBeDefined();
    expect(JSON.stringify(guestItem03)).not.toMatch(/Lucas|user-lucas|createdBy/);
    expect(JSON.stringify(guest)).not.toMatch(/user-lucas|Lucas Prado/);
    const filters = { category: "Eletrônicos" as const, sort: "found" as const };
    const guestFiltered = await h.services.items.list(filters);
    await as(h, "student");
    const member = await h.services.items.list(filters);
    expect(guestFiltered.map((i) => i.id)).toEqual(member.map((i) => i.id));
    // usuário comum também não recebe o local de guarda (privado), salvo no item com reivindicação aceita (item-05)
    expect(member.filter((i) => "storedAt" in i).every((i) => i.id === "item-05")).toBe(true);
    await h.services.auth.signOut();
    await as(h, "admin");
    expect((await h.services.items.list(filters)).every((i) => i.storedAt)).toBe(true);
    await h.services.auth.signOut();
    await expectCode(h.services.items.list({ from: "2026-10-19", to: "2026-10-01" }), "VALIDATION");
  });

  it("detalhe sem login: sem storedAt, sem dados de reivindicação, viewer negado com UNAUTHENTICATED", async () => {
    const h = createHarness();
    const detail = await h.services.items.get("item-03"); // tem 2 reivindicações pendentes
    expect(detail.item.title).toBe("Chaveiro com três chaves");
    expect("storedAt" in detail.item).toBe(false);
    expect("createdById" in detail.item).toBe(false);
    expect(detail.createdBy).toBeNull();
    expect(JSON.stringify(detail)).not.toMatch(/Lucas|user-lucas/);
    expect(JSON.stringify(detail)).not.toMatch(/Portaria"|beatriz|rafael@|proofDetails|lostWhereWhen|esmalte/);
    expect(detail.myClaims).toEqual([]);
    expect(detail.claims).toEqual([]);
    expect(detail.returnRecord).toBeNull();
    for (const key of ["claim", "edit", "delete", "registerReturn"] as const) {
      expect(detail.viewer[key]).toMatchObject({ allowed: false, code: "UNAUTHENTICATED" });
    }
    expect(detail.viewer.claim).toMatchObject({ message: "Entre para reivindicar este item." });
    // logado continua vendo storedAt
    await as(h, "admin");
    const adminDetail = await h.services.items.get("item-03");
    expect(adminDetail.item.storedAt).toBe("Portaria");
    expect(adminDetail.item.createdById).toBe("user-lucas");
    expect(adminDetail.createdBy).toEqual({ id: "user-lucas", name: "Lucas Prado", role: "user" });
    expect((await h.services.items.list()).find((i) => i.id === "item-03")?.createdById).toBe("user-lucas");
  });

  it("devolvido ou inexistente: mesmo NOT_FOUND para o visitante; logado ainda vê o devolvido", async () => {
    const h = createHarness();
    const missing = await expectCode(h.services.items.get("item-999"), "NOT_FOUND");
    const returned = await expectCode(h.services.items.get("item-10"), "NOT_FOUND");
    expect(returned.message).toBe(missing.message);
    await as(h, "student");
    expect((await h.services.items.get("item-10")).item.status).toBe("returned");
  });

  it("visitante não reivindica, registra, edita, exclui, aprova nem registra devolução", async () => {
    const h = createHarness();
    await expectCode(h.services.claims.create("item-01", validClaim), "UNAUTHENTICATED");
    await expectCode(h.services.items.create(validItem), "UNAUTHENTICATED");
    await expectCode(h.services.items.update("item-01", validItem), "UNAUTHENTICATED");
    await expectCode(h.services.items.delete("item-01"), "UNAUTHENTICATED");
    await expectCode(h.services.claims.listMine(), "UNAUTHENTICATED");
    await expectCode(h.services.claims.listPending(), "UNAUTHENTICATED");
    await expectCode(h.services.claims.accept("claim-01"), "UNAUTHENTICATED");
    await expectCode(h.services.returns.register("item-05"), "UNAUTHENTICATED");
    await expectCode(h.services.returns.list(), "UNAUTHENTICATED");
    // nada foi alterado
    expect((await h.services.items.list()).find((i) => i.id === "item-01")?.status).toBe("available");
  });
});

describe("privacidade de storedAt imposta no serviço (administração e reivindicante aceito)", () => {
  const hasStored = (item: object) => "storedAt" in item;

  it("visitante e usuário comum não recebem storedAt em list/get (exceto o item com reivindicação aceita); administração recebe", async () => {
    const h = createHarness();
    expect((await h.services.items.list()).some(hasStored)).toBe(false);
    expect(hasStored((await h.services.items.get("item-03")).item)).toBe(false);
    await as(h, "student");
    expect((await h.services.items.list()).filter(hasStored).map((i) => i.id)).toEqual(["item-05"]);
    expect(hasStored((await h.services.items.get("item-03")).item)).toBe(false);
    await h.services.auth.signOut();
    await as(h, "admin");
    expect((await h.services.items.list()).every((i) => i.storedAt)).toBe(true);
    expect((await h.services.items.get("item-03")).item.storedAt).toBe("Portaria");
  });

  it("criador (usuário comum): create devolve sem storedAt, get também, mas o store guarda", async () => {
    const h = createHarness();
    await as(h, "teacher");
    const created = await h.services.items.create({ ...validItem, storedAt: "Armário do 2º andar" });
    expect(hasStored(created)).toBe(false);
    expect(hasStored((await h.services.items.get(created.id)).item)).toBe(false);
    const mine = (await h.services.auth.exportMyData()).itemsRegistered;
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some(hasStored)).toBe(false);
    expect(JSON.stringify(await h.services.items.list())).not.toContain("Armário do 2º andar");
    // o item guardado continua completo
    expect(JSON.stringify(h.storage.getItem(DB_KEY))).toContain("Armário do 2º andar");
    await h.services.auth.signOut();
    await as(h, "admin");
    expect((await h.services.items.get(created.id)).item.storedAt).toBe("Armário do 2º andar");
  });

  it("administração: create, update e exportMyData devolvem storedAt; update por admin não vaza para o criador", async () => {
    const h = createHarness();
    await as(h, "admin");
    const created = await h.services.items.create({ ...validItem, storedAt: "Sala 12" });
    expect(created.storedAt).toBe("Sala 12");
    const updated = await h.services.items.update(created.id, { ...validItem, storedAt: "Sala 13" });
    expect(updated.storedAt).toBe("Sala 13");
    expect((await h.services.auth.exportMyData()).itemsRegistered.every((i) => i.storedAt)).toBe(true);
    await h.services.auth.signOut();
    await as(h, "student");
    expect(hasStored((await h.services.items.get(created.id)).item)).toBe(false);
  });

  it("reivindicante com reivindicação ACEITA (item aguardando devolução) vê storedAt só nesse item", async () => {
    const h = createHarness();
    await as(h, "student"); // Marina: aceita no item-05 (under_claim), pendente no item-07, recusada no item-04
    const mine = await h.services.claims.listMine();
    const accepted = mine.find((c) => c.itemId === "item-05" && c.status === "accepted");
    expect(accepted?.item.storedAt).toBe("Portaria");
    expect(mine.filter((c) => c.id !== accepted!.id).some((c) => hasStored(c.item))).toBe(false);
    expect((await h.services.claims.get(accepted!.id)).item.storedAt).toBe("Portaria");
    const detail = await h.services.items.get("item-05");
    expect(detail.myClaims[0].status).toBe("accepted");
    expect(detail.item.storedAt).toBe("Portaria");
    expect(hasStored((await h.services.items.get("item-07")).item)).toBe(false); // pendente
    expect(hasStored((await h.services.items.get("item-04")).item)).toBe(false); // recusada
    expect(hasStored((await h.services.items.get("item-03")).item)).toBe(false); // aceito de OUTRO item
  });

  const LOCAL = "Armário secreto do 3º andar";

  it("ponta a ponta: A registra, B reivindica (não vê), admin aceita (B vê), devolução (B não vê); terceiro e criador nunca; admin sempre", async () => {
    const h = createHarness();
    await as(h, "teacher"); // A = Rafael registra
    const created = await h.services.items.create({ ...validItem, storedAt: LOCAL });
    const itemId = created.id;
    const sees = async (id = itemId) => (await h.services.items.get(id)).item.storedAt === LOCAL;
    const inList = async () => (await h.services.items.list()).find((i) => i.id === itemId)?.storedAt === LOCAL;
    expect(await sees()).toBe(false);
    await h.services.auth.signOut();

    await as(h, "student"); // B = Marina reivindica
    const claim = await h.services.claims.create(itemId, validClaim);
    expect(await sees()).toBe(false);
    expect(await inList()).toBe(false);
    expect(hasStored((await h.services.claims.listMine()).find((c) => c.id === claim.id)!.item)).toBe(false);
    await h.services.auth.signOut();

    await as(h, "admin");
    expect(await sees()).toBe(true);
    await h.services.claims.accept(claim.id);
    await h.services.auth.signOut();

    await as(h, "student"); // B passa a ver
    expect(await sees()).toBe(true);
    expect(await inList()).toBe(true);
    expect((await h.services.claims.listMine()).find((c) => c.id === claim.id)!.item.storedAt).toBe(LOCAL);
    expect((await h.services.claims.get(claim.id)).item.storedAt).toBe(LOCAL);
    await h.services.auth.signOut();

    await as(h, "teacher"); // criador continua sem ver
    expect(await sees()).toBe(false);
    expect(await inList()).toBe(false);
    await h.services.auth.signOut();

    const third = await h.services.auth.signUp({ name: "Terceira Pessoa", email: "terceira@demo.test", password: "senha-segura-1", acceptedTerms: true });
    expect(third.role).toBe("user"); // terceiro usuário nunca vê
    expect(await sees()).toBe(false);
    expect(await inList()).toBe(false);
    await h.services.auth.signOut();

    await as(h, "admin");
    await deliverItem(h, itemId);
    expect(await sees()).toBe(true); // admin sempre vê
    await h.services.auth.signOut();

    await as(h, "student"); // devolvido: B deixa de ver
    expect(await sees()).toBe(false);
    expect(hasStored((await h.services.claims.listMine()).find((c) => c.id === claim.id)!.item)).toBe(false);
  });

  it("reivindicação recusada: o reivindicante não vê (nem antes nem depois)", async () => {
    const h = createHarness();
    await as(h, "teacher");
    const created = await h.services.items.create({ ...validItem, storedAt: LOCAL });
    await h.services.auth.signOut();
    await as(h, "student");
    const claim = await h.services.claims.create(created.id, validClaim);
    await h.services.auth.signOut();
    await as(h, "admin");
    await h.services.claims.reject(claim.id);
    await h.services.auth.signOut();
    await as(h, "student");
    expect(hasStored((await h.services.items.get(created.id)).item)).toBe(false);
    expect(hasStored((await h.services.claims.listMine()).find((c) => c.id === claim.id)!.item)).toBe(false);
  });

  it("nenhuma saída serializada para quem não está autorizado contém o local de guarda", async () => {
    const h = createHarness();
    await as(h, "teacher");
    const created = await h.services.items.create({ ...validItem, storedAt: LOCAL });
    await h.services.auth.signOut();
    await as(h, "student");
    const claim = await h.services.claims.create(created.id, validClaim); // pendente
    const outputs = JSON.stringify([
      await h.services.items.list(),
      await h.services.items.get(created.id),
      await h.services.claims.listMine(),
      await h.services.claims.get(claim.id),
      await h.services.auth.exportMyData(),
    ]);
    expect(outputs).not.toContain(LOCAL);
    await h.services.auth.signOut();
    // criador e visitante
    expect(JSON.stringify(await h.services.items.list())).not.toContain(LOCAL);
    expect(JSON.stringify(await h.services.items.get(created.id))).not.toContain(LOCAL);
    await as(h, "teacher");
    expect(JSON.stringify([await h.services.items.list(), await h.services.items.get(created.id), await h.services.auth.exportMyData()])).not.toContain(LOCAL);
  });

  it("administração vê storedAt nas reivindicações, decisões e devoluções", async () => {
    const h = createHarness();
    await as(h, "admin");
    expect((await h.services.claims.listPending()).every((c) => c.item.storedAt)).toBe(true);
    expect((await h.services.claims.listByItem("item-05")).every((c) => c.item.storedAt)).toBe(true);
    const decision = await h.services.claims.accept("claim-06");
    expect(decision.item.storedAt).toBe("Portaria");
    const returned = await deliverItem(h, "item-05");
    expect(returned.item.storedAt).toBe("Portaria");
    expect((await h.services.returns.list()).every((r) => r.item.storedAt)).toBe(true);
  });
});
