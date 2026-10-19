/**
 * Cenários de aceite (SPEC §7) exercitados pelos serviços mockados.
 * Seed: item-03 (2 pendentes), item-04 (recusada, Disponível), item-05 (aceita, Marina),
 * item-07 (Marina e Beatriz pendentes), item-10/11 (Devolvidos).
 */
import { describe, expect, it } from "vitest";
import { addDays, toLocalDateString } from "@/lib/rules/dates";
import { createHarness, expectCode, fakeFile, validClaim, validItem, type Harness } from "./test-utils";

async function as(h: Harness, role: "student" | "teacher" | "admin") {
  return h.services.auth.signInAsDemo(role);
}

describe("RF01 — autenticação simulada", () => {
  it("AC01.3: três perfis de demonstração entram com um toque", async () => {
    const h = createHarness();
    const profiles = await h.services.auth.listDemoProfiles();
    expect(profiles.map((p) => p.role)).toEqual(["student", "teacher", "admin"]);
    expect(profiles.every((p) => p.user.email.endsWith("@demo.test"))).toBe(true);
    for (const p of profiles) {
      const user = await h.services.auth.signInAsDemo(p.role);
      expect(user.role).toBe(p.role);
      expect((await h.services.auth.getCurrentUser())?.id).toBe(user.id);
    }
  });

  it("AC01.1: cadastro cria conta e sessão; e-mail repetido (qualquer caixa) dá erro", async () => {
    const h = createHarness();
    const user = await h.services.auth.signUp({ name: "Carla Dias", email: "Carla@Demo.test", role: "teacher" });
    expect(user).toMatchObject({ name: "Carla Dias", email: "carla@demo.test", role: "teacher" });
    expect((await h.services.auth.getCurrentUser())?.id).toBe(user.id);
    const err = await expectCode(
      h.services.auth.signUp({ name: "Outra Carla", email: " CARLA@demo.test ", role: "student" }),
      "EMAIL_TAKEN",
    );
    expect(err.fieldErrors?.email).toBeTruthy();
    await expectCode(h.services.auth.signUp({ name: "Marina", email: "marina@demo.test", role: "student" }), "EMAIL_TAKEN");
  });

  it("AC01.1: cadastro valida campos e não aceita papel admin", async () => {
    const h = createHarness();
    const err = await expectCode(
      h.services.auth.signUp({ name: "", email: "x", role: "admin" as never }),
      "VALIDATION",
    );
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(["email", "name", "role"]);
  });

  it("AC01.2: login por e-mail cadastrado cria sessão; inexistente dá erro claro", async () => {
    const h = createHarness();
    const user = await h.services.auth.signIn({ email: " MARINA@demo.test " });
    expect(user.id).toBe("user-marina");
    await h.services.auth.signOut();
    const err = await expectCode(h.services.auth.signIn({ email: "ninguem@demo.test" }), "USER_NOT_FOUND");
    expect(err.message).toMatch(/Não encontramos/);
    expect(await h.services.auth.getCurrentUser()).toBeNull();
  });

  it("AC01.4: sair encerra a sessão; operações protegidas pedem login", async () => {
    const h = createHarness();
    await as(h, "student");
    await h.services.auth.signOut();
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    await expectCode(h.services.items.list(), "UNAUTHENTICATED"); // AC03.1
    await expectCode(h.services.items.get("item-01"), "UNAUTHENTICATED");
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
      h.services.items.create({ ...validItem, foundDate: tomorrow, title: "", storedAt: "", category: "Joias" as never }),
      "VALIDATION",
    );
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(["category", "foundDate", "storedAt", "title"]);
    expect((await h.services.items.list()).length).toBe(before);
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
    expect(asStudent.createdBy).toEqual({ id: "user-lucas", name: "Lucas Prado", role: "student" });
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
    await h.services.claims.create("item-01", validClaim);
    await as(h, "teacher");
    await h.services.claims.create("item-01", validClaim);
    await as(h, "admin");
    expect((await h.services.claims.listByItem("item-01")).map((c) => c.status)).toEqual(["pending", "pending"]);
    expect((await h.services.items.get("item-01")).item.status).toBe("under_claim");
  });

  it("AC04.1: duplicada, recusada, aceita-de-outro e papéis são bloqueados com o código certo", async () => {
    const h = createHarness();
    await as(h, "student"); // Marina: pendente no item-07, recusada no item-04, aceita no item-05
    await expectCode(h.services.claims.create("item-07", validClaim), "DUPLICATE_CLAIM");
    await expectCode(h.services.claims.create("item-05", validClaim), "DUPLICATE_CLAIM");
    await expectCode(h.services.claims.create("item-04", validClaim), "CLAIM_BLOCKED"); // AC04.7
    await expectCode(h.services.claims.create("item-10", validClaim), "ITEM_RETURNED");
    await as(h, "teacher");
    await expectCode(h.services.claims.create("item-05", validClaim), "CLAIM_BLOCKED"); // já há aceita
    await as(h, "admin");
    await expectCode(h.services.claims.create("item-01", validClaim), "FORBIDDEN");
  });

  it("P8: quem registrou o item pode reivindicá-lo", async () => {
    const h = createHarness();
    await as(h, "student");
    const mine = await h.services.items.create(validItem);
    await h.services.claims.create(mine.id, validClaim);
    expect((await h.services.items.get(mine.id)).item.status).toBe("under_claim");
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

  it("AC04.7/AC04.8: o usuário recusado vê 'Recusada' e não reenvia; Minhas reivindicações refletem a decisão", async () => {
    const h = createHarness();
    await as(h, "student");
    const seen: string[][] = [];
    const off = h.services.subscribe(() => {
      void h.services.claims
        .listMine()
        .then((list) => seen.push(list.map((c) => `${c.id}:${c.status}`)))
        .catch(() => undefined); // sessão de administração: sem "minhas reivindicações"
    });
    const before = await h.services.claims.listMine();
    expect(before.map((c) => [c.id, c.status]).sort()).toEqual([
      ["claim-03", "rejected"],
      ["claim-04", "accepted"],
      ["claim-06", "pending"],
    ]);
    expect(before.every((c) => c.item.title)).toBe(true);

    await as(h, "admin");
    await h.services.claims.reject("claim-06");
    await as(h, "student");
    const after = await h.services.claims.listMine();
    expect(after.find((c) => c.id === "claim-06")?.status).toBe("rejected");
    // item-07 ainda tem a pendente de Beatriz; Marina não pode reenviar
    await expectCode(h.services.claims.create("item-07", validClaim), "CLAIM_BLOCKED");
    off();
    expect(seen.length).toBeGreaterThan(0);
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
    const view = await h.services.returns.register("item-05"); // aceita: Marina
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
    const ret = await h.services.returns.register(item.id);
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
    await h.services.returns.register("item-07");
    await expectCode(h.services.claims.reject("claim-06"), "ITEM_RETURNED");
    const detail = await h.services.items.get("item-07");
    expect(detail.claims.filter((c) => c.status === "accepted")).toHaveLength(1);
    expect(detail.item.status).toBe("returned");
  });

  it("reivindicações simultâneas de dois usuários são serializadas (cada leitura vê a anterior)", async () => {
    const h = createHarness();
    await as(h, "student");
    await Promise.all([h.services.claims.create("item-01", validClaim), h.services.claims.create("item-01", validClaim)].map((p) => p.catch((e) => e)));
    await as(h, "admin");
    expect((await h.services.claims.listByItem("item-01")).filter((c) => c.claimantId === "user-marina")).toHaveLength(1);
  });
});
