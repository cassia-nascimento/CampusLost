/**
 * Código de retirada ponta a ponta no mock (SPEC RF05, AC05.5–05.11).
 * Seed: item-05 / claim-04 (Marina, aceita, Em reivindicação); item-07 / claim-06 e claim-07 (pendentes);
 * item-04 / claim-03 (recusada); item-10 e item-11 (já devolvidos).
 */
import { describe, expect, it } from "vitest";
import { RETURN_CODE_LOCK_MS, RETURN_CODE_VERIFY_TTL_MS, normalizeReturnCode } from "@/lib/rules";
import { DB_KEY } from "./store";
import { DEMO_PASSWORD, type Db } from "./seed";
import { createHarness, expectCode, signInAsRafael, type Harness } from "./test-utils";

const CODE_FORMAT = /^[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/;
const MINUTE = 60_000;

const asMarina = (h: Harness) => h.services.auth.signInAsDemo("user");
const asAdmin = (h: Harness) => h.services.auth.signInAsDemo("admin");
const asLucas = (h: Harness) => h.services.auth.signIn({ email: "lucas@demo.test", password: DEMO_PASSWORD });

/** Marina gera o código da reivindicação aceita do seed e a administração fica logada. */
async function issueForSeedClaim(h: Harness, claimId = "claim-04") {
  await asMarina(h);
  const issued = await h.services.claims.issueReturnCode(claimId);
  await asAdmin(h);
  return issued;
}

const dump = (h: Harness) => h.storage.getItem(DB_KEY)!;
const db = (h: Harness) => JSON.parse(dump(h)) as Db;

describe("gerar o código (AC05.5)", () => {
  it("o proprietário gera na própria conta: XXXX-XXXX e a data; o estado dele não traz o código nem campos de administração", async () => {
    const h = createHarness();
    await asMarina(h);
    expect(await h.services.claims.getReturnCodeStatus("claim-04")).toEqual({ issued: false, issuedAt: null });
    const issued = await h.services.claims.issueReturnCode("claim-04");
    expect(issued.code).toMatch(CODE_FORMAT);
    expect(issued.issuedAt).toBe(h.clock().toISOString());

    const status = await h.services.claims.getReturnCodeStatus("claim-04");
    expect(status).toEqual({ issued: true, issuedAt: issued.issuedAt });
    expect(Object.keys(status).sort()).toEqual(["issuedAt", "issued"].sort());
    expect(JSON.stringify(status)).not.toContain(normalizeReturnCode(issued.code));
  });

  it("só o dono: outro usuário, a administração e o visitante não geram nem consultam como dono", async () => {
    const h = createHarness();
    await signInAsRafael(h.services);
    await expectCode(h.services.claims.issueReturnCode("claim-04"), "FORBIDDEN");
    await expectCode(h.services.claims.getReturnCodeStatus("claim-04"), "FORBIDDEN");
    await asLucas(h); // reivindicação recusada no mesmo item
    await expectCode(h.services.claims.issueReturnCode("claim-04"), "FORBIDDEN");
    await expectCode(h.services.claims.getReturnCodeStatus("claim-04"), "FORBIDDEN");
    await asAdmin(h);
    await expectCode(h.services.claims.issueReturnCode("claim-04"), "FORBIDDEN"); // admin não é o dono
    await h.services.auth.signOut();
    await expectCode(h.services.claims.issueReturnCode("claim-04"), "UNAUTHENTICATED");
    await expectCode(h.services.claims.getReturnCodeStatus("claim-04"), "UNAUTHENTICATED");
    expect(db(h).returnCodes).toEqual([]); // nada foi criado
  });

  it("reivindicação inexistente: NOT_FOUND", async () => {
    const h = createHarness();
    await asMarina(h);
    await expectCode(h.services.claims.issueReturnCode("claim-nope"), "NOT_FOUND");
    await expectCode(h.services.claims.getReturnCodeStatus("claim-nope"), "NOT_FOUND");
  });

  it("antes da aprovação (pendente) e com reivindicação recusada: INVALID_TRANSITION com a mensagem do contrato", async () => {
    const h = createHarness();
    await asMarina(h);
    const message = "Só reivindicações aceitas, de itens aguardando devolução, têm código de retirada.";
    expect(await h.services.claims.issueReturnCode("claim-06").catch((e: Error) => e.message)).toBe(message); // pendente
    expect(await h.services.claims.issueReturnCode("claim-03").catch((e: Error) => e.message)).toBe(message); // recusada
    await expectCode(h.services.claims.issueReturnCode("claim-06"), "INVALID_TRANSITION");
    // aprovada: passa a poder gerar
    await asAdmin(h);
    await h.services.claims.accept("claim-06");
    await asMarina(h);
    expect((await h.services.claims.issueReturnCode("claim-06")).code).toMatch(CODE_FORMAT);
  });

  it("item já devolvido: não gera mais", async () => {
    const h = createHarness();
    await h.services.auth.signIn({ email: "rafael@demo.test", password: DEMO_PASSWORD });
    await expectCode(h.services.claims.issueReturnCode("claim-09"), "INVALID_TRANSITION"); // aceita, item devolvido
  });
});

describe("estado visto pela administração", () => {
  it("sem código: não gerado, 5 tentativas; com código: gerado, ainda não validado (e nunca o código)", async () => {
    const h = createHarness();
    await asAdmin(h);
    expect(await h.services.claims.getReturnCodeStatus("claim-04")).toEqual({
      issued: false,
      issuedAt: null,
      verified: false,
      verifiedAt: null,
      verifiedUntil: null,
      attemptsLeft: 5,
      lockedUntil: null,
    });
    const issued = await issueForSeedClaim(h);
    const status = await h.services.claims.getReturnCodeStatus("claim-04");
    expect(status).toMatchObject({ issued: true, issuedAt: issued.issuedAt, verified: false, attemptsLeft: 5, lockedUntil: null });
    expect(JSON.stringify(status)).not.toContain(normalizeReturnCode(issued.code));
  });
});

describe("validar o código (AC05.6/AC05.7)", () => {
  it("aceita o código certo e devolve o estado com verified: true e o prazo de 15 min", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    h.advance(2 * MINUTE);
    const status = await h.services.returns.verifyCode("claim-04", issued.code);
    expect(status).toMatchObject({ issued: true, verified: true, attemptsLeft: 5 });
    expect(status.verifiedAt).toBe(h.clock().toISOString());
    expect(status.verifiedUntil).toBe(new Date(h.clock().getTime() + RETURN_CODE_VERIFY_TTL_MS).toISOString());
    // validar não devolve nada
    expect((await h.services.items.get("item-05")).item.status).toBe("under_claim");
    expect(await h.services.returns.list().then((r) => r.some((x) => x.itemId === "item-05"))).toBe(false);
  });

  it.each([
    ["minúsculas", (c: string) => c.toLowerCase()],
    ["sem hífen", (c: string) => c.replace("-", "")],
    ["com espaços", (c: string) => ` ${c.slice(0, 4)} ${c.slice(5)} `],
    ["com hífen, espaço e minúsculas", (c: string) => `${c.slice(0, 4)} - ${c.slice(5)}`.toLowerCase()],
  ])("normaliza a entrada: %s", async (_name, transform) => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    expect((await h.services.returns.verifyCode("claim-04", transform(issued.code))).verified).toBe(true);
  });

  it("código incorreto: VALIDATION com fieldErrors.code e as tentativas restantes", async () => {
    const h = createHarness();
    await issueForSeedClaim(h);
    for (const left of [4, 3, 2, 1]) {
      const error = await expectCode(h.services.returns.verifyCode("claim-04", "2222-2222"), "VALIDATION");
      expect(error.fieldErrors?.code).toBe(left === 1 ? "Código incorreto. Restam 1 tentativa." : `Código incorreto. Restam ${left} tentativas.`);
      expect((await h.services.claims.getReturnCodeStatus("claim-04")).attemptsLeft).toBe(left);
    }
  });

  it("vazio ou em branco: 'Informe o código de retirada.' (não gasta tentativa)", async () => {
    const h = createHarness();
    await issueForSeedClaim(h);
    for (const blank of ["", "   ", "--"]) {
      const error = await expectCode(h.services.returns.verifyCode("claim-04", blank), "VALIDATION");
      expect(error.fieldErrors?.code).toBe("Informe o código de retirada.");
    }
    expect((await h.services.claims.getReturnCodeStatus("claim-04")).attemptsLeft).toBe(5);
  });

  it("formato inválido (tamanho errado) conta como tentativa incorreta", async () => {
    const h = createHarness();
    await issueForSeedClaim(h);
    const error = await expectCode(h.services.returns.verifyCode("claim-04", "ABC"), "VALIDATION");
    expect(error.fieldErrors?.code).toBe("Código incorreto. Restam 4 tentativas.");
  });

  it("a pessoa ainda não gerou o código: INVALID_TRANSITION com a mensagem do contrato", async () => {
    const h = createHarness();
    await asAdmin(h);
    const error = await expectCode(h.services.returns.verifyCode("claim-04", "K7M2-9QXB"), "INVALID_TRANSITION");
    expect(error.message).toBe("A pessoa ainda não gerou o código de retirada. Peça para ela gerar em Minhas reivindicações.");
  });

  it("só a administração valida; visitante não; pendente e inexistente também não", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    await asMarina(h); // nem o dono valida o próprio código
    await expectCode(h.services.returns.verifyCode("claim-04", issued.code), "FORBIDDEN");
    await signInAsRafael(h.services);
    await expectCode(h.services.returns.verifyCode("claim-04", issued.code), "FORBIDDEN");
    await h.services.auth.signOut();
    await expectCode(h.services.returns.verifyCode("claim-04", issued.code), "UNAUTHENTICATED");
    await asAdmin(h);
    await expectCode(h.services.returns.verifyCode("claim-06", issued.code), "INVALID_TRANSITION"); // pendente
    await expectCode(h.services.returns.verifyCode("claim-nope", issued.code), "NOT_FOUND");
  });
});

describe("bloqueio por tentativas (AC05.8)", () => {
  async function exhaust(h: Harness) {
    for (let n = 0; n < 4; n++) await expectCode(h.services.returns.verifyCode("claim-04", "2222-2222"), "VALIDATION");
    return expectCode(h.services.returns.verifyCode("claim-04", "2222-2222"), "RATE_LIMITED"); // 5ª
  }

  it("5 erros bloqueiam por 15 min, mesmo o código certo é recusado, e libera depois do prazo", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    const locked = await exhaust(h);
    expect(locked.message).toBe("Muitas tentativas incorretas. Aguarde 15 minutos para tentar de novo.");

    const status = await h.services.claims.getReturnCodeStatus("claim-04");
    expect(status).toMatchObject({ attemptsLeft: 0, verified: false });
    expect(status.lockedUntil).toBe(new Date(h.clock().getTime() + RETURN_CODE_LOCK_MS).toISOString());

    h.advance(5 * MINUTE);
    const still = await expectCode(h.services.returns.verifyCode("claim-04", issued.code), "RATE_LIMITED");
    expect(still.message).toBe("Muitas tentativas incorretas. Aguarde 10 minutos para tentar de novo.");
    expect((await h.services.claims.getReturnCodeStatus("claim-04")).verified).toBe(false);

    h.advance(10 * MINUTE); // completa os 15 minutos
    expect((await h.services.claims.getReturnCodeStatus("claim-04")).lockedUntil).toBeNull();
    expect((await h.services.claims.getReturnCodeStatus("claim-04")).attemptsLeft).toBe(5);
    expect((await h.services.returns.verifyCode("claim-04", issued.code)).verified).toBe(true);
  });

  it("gerar um novo código NÃO destrava", async () => {
    const h = createHarness();
    await issueForSeedClaim(h);
    await exhaust(h);
    await asMarina(h);
    const second = await h.services.claims.issueReturnCode("claim-04");
    await asAdmin(h);
    await expectCode(h.services.returns.verifyCode("claim-04", second.code), "RATE_LIMITED");
    h.advance(RETURN_CODE_LOCK_MS);
    expect((await h.services.returns.verifyCode("claim-04", second.code)).verified).toBe(true);
  });

  it("o bloqueio é por reivindicação (outra não é afetada)", async () => {
    const h = createHarness();
    await asAdmin(h);
    await h.services.claims.accept("claim-06");
    await asMarina(h);
    await h.services.claims.issueReturnCode("claim-04");
    const other = await h.services.claims.issueReturnCode("claim-06");
    await asAdmin(h);
    await exhaust(h);
    expect((await h.services.returns.verifyCode("claim-06", other.code)).verified).toBe(true);
  });

  it("uma conferência certa zera os erros anteriores", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    for (let n = 0; n < 3; n++) await expectCode(h.services.returns.verifyCode("claim-04", "2222-2222"), "VALIDATION");
    await h.services.returns.verifyCode("claim-04", issued.code);
    expect((await h.services.claims.getReturnCodeStatus("claim-04")).attemptsLeft).toBe(5);
  });
});

describe("confirmar a entrega (AC05.9)", () => {
  it("sem validar: INVALID_TRANSITION e o item continua Em reivindicação", async () => {
    const h = createHarness();
    await asAdmin(h);
    const error = await expectCode(h.services.returns.register("item-05"), "INVALID_TRANSITION"); // nem gerado
    expect(error.message).toBe("Valide o código de retirada antes de confirmar a entrega.");
    await issueForSeedClaim(h);
    await expectCode(h.services.returns.register("item-05"), "INVALID_TRANSITION"); // gerado, não validado
    expect((await h.services.items.get("item-05")).item.status).toBe("under_claim");
  });

  it("por quem não é administração: FORBIDDEN, mesmo com o código validado", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    await h.services.returns.verifyCode("claim-04", issued.code);
    await asMarina(h);
    await expectCode(h.services.returns.register("item-05"), "FORBIDDEN");
    await h.services.auth.signOut();
    await expectCode(h.services.returns.register("item-05"), "UNAUTHENTICATED");
    await asAdmin(h);
    expect((await h.services.items.get("item-05")).item.status).toBe("under_claim");
  });

  it("depois de validar: devolve, registra quem e quando validou, tira o item da busca e de 'aguardando'", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    h.advance(MINUTE);
    const verified = await h.services.returns.verifyCode("claim-04", issued.code);
    h.advance(3 * MINUTE);
    const view = await h.services.returns.register("item-05");
    expect(view).toMatchObject({
      itemId: "item-05",
      claimId: "claim-04",
      returnedToId: "user-marina",
      registeredById: "user-admin",
      returnedAt: h.clock().toISOString(),
      codeVerifiedAt: verified.verifiedAt,
    });
    expect(view.item.status).toBe("returned");
    expect((await h.services.items.list()).map((i) => i.id)).not.toContain("item-05");
    const list = await h.services.returns.list();
    expect(list[0]).toMatchObject({ itemId: "item-05", codeVerifiedAt: verified.verifiedAt });
    // devoluções antigas (do seed) não têm código
    expect(list.filter((r) => r.itemId !== "item-05").every((r) => r.codeVerifiedAt === null)).toBe(true);
    // sai de "Aguardando devolução" (reivindicação aceita + item Em reivindicação): o item agora é Devolvido
    expect((await h.services.items.get("item-05")).item.status).toBe("returned");
    expect((await h.services.claims.listByItem("item-05")).filter((c) => c.status === "accepted" && c.item.status === "under_claim")).toEqual([]);
  });

  it("uso único e sem devolução duplicada: a segunda chamada é ITEM_RETURNED e há uma só devolução", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    await h.services.returns.verifyCode("claim-04", issued.code);
    const before = (await h.services.returns.list()).length;
    await h.services.returns.register("item-05");
    await expectCode(h.services.returns.register("item-05"), "ITEM_RETURNED");
    expect(await h.services.returns.list()).toHaveLength(before + 1);
    expect(db(h).returnCodes[0].usedAt).not.toBeNull();
    await expectCode(h.services.returns.verifyCode("claim-04", issued.code), "ITEM_RETURNED");
  });

  it("duas chamadas simultâneas: uma devolução e a outra falha", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    await h.services.returns.verifyCode("claim-04", issued.code);
    const before = (await h.services.returns.list()).length;
    const results = await Promise.allSettled([h.services.returns.register("item-05"), h.services.returns.register("item-05")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await h.services.returns.list()).toHaveLength(before + 1);
  });

  it("a conferência vale 15 minutos: depois, 'expirou'; validar de novo libera", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    await h.services.returns.verifyCode("claim-04", issued.code);
    h.advance(RETURN_CODE_VERIFY_TTL_MS);
    const error = await expectCode(h.services.returns.register("item-05"), "INVALID_TRANSITION");
    expect(error.message).toBe("A conferência do código expirou. Valide o código novamente.");
    const status = await h.services.claims.getReturnCodeStatus("claim-04");
    expect(status).toMatchObject({ verified: false });
    expect(status.verifiedAt).not.toBeNull(); // continua registrado, mas não vale mais
    await h.services.returns.verifyCode("claim-04", issued.code);
    expect((await h.services.returns.register("item-05")).item.status).toBe("returned");
  });

  it("um instante antes de vencer ainda vale", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    await h.services.returns.verifyCode("claim-04", issued.code);
    h.advance(RETURN_CODE_VERIFY_TTL_MS - 1);
    expect((await h.services.returns.register("item-05")).item.status).toBe("returned");
  });
});

describe("código ↔ reivindicação ↔ item (AC05.10)", () => {
  it("o código de outra reivindicação não vale; cada um vale na sua", async () => {
    const h = createHarness();
    await asAdmin(h);
    await h.services.claims.accept("claim-06"); // item-07, também de Marina
    await asMarina(h);
    const a = await h.services.claims.issueReturnCode("claim-04");
    const b = await h.services.claims.issueReturnCode("claim-06");
    expect(a.code).not.toBe(b.code);
    await asAdmin(h);
    await expectCode(h.services.returns.verifyCode("claim-04", b.code), "VALIDATION");
    await expectCode(h.services.returns.verifyCode("claim-06", a.code), "VALIDATION");
    await h.services.returns.verifyCode("claim-06", b.code);
    // validar o item-07 não libera o item-05
    await expectCode(h.services.returns.register("item-05"), "INVALID_TRANSITION");
    expect((await h.services.returns.register("item-07")).claimId).toBe("claim-06");
  });

  it("mesmo código em duas reivindicações gera hashes diferentes (amarrado à reivindicação)", async () => {
    const fixed = (length: number) => new Uint8Array(length).fill(7);
    const h = createHarness({ randomBytes: fixed });
    await asAdmin(h);
    await h.services.claims.accept("claim-06");
    await asMarina(h);
    const a = await h.services.claims.issueReturnCode("claim-04");
    const b = await h.services.claims.issueReturnCode("claim-06");
    expect(a.code).toBe(b.code);
    const [x, y] = db(h).returnCodes;
    expect(x.codeHash).not.toBe(y.codeHash);
  });

  it("gerar de novo invalida o anterior e zera a conferência", async () => {
    const h = createHarness();
    const first = await issueForSeedClaim(h);
    await h.services.returns.verifyCode("claim-04", first.code);
    await asMarina(h);
    h.advance(MINUTE);
    const second = await h.services.claims.issueReturnCode("claim-04");
    expect(second.code).not.toBe(first.code);
    expect((await h.services.claims.getReturnCodeStatus("claim-04")).issuedAt).toBe(second.issuedAt);
    await asAdmin(h);
    expect(await h.services.claims.getReturnCodeStatus("claim-04")).toMatchObject({ verified: false, verifiedAt: null });
    await expectCode(h.services.returns.register("item-05"), "INVALID_TRANSITION"); // conferência zerada
    const error = await expectCode(h.services.returns.verifyCode("claim-04", first.code), "VALIDATION");
    expect(error.fieldErrors?.code).toBe("Código incorreto. Restam 4 tentativas.");
    expect((await h.services.returns.verifyCode("claim-04", second.code)).verified).toBe(true);
    expect((await h.services.returns.register("item-05")).item.status).toBe("returned");
  });

  it("excluir o item remove o código", async () => {
    const h = createHarness();
    await asAdmin(h);
    await h.services.claims.accept("claim-06");
    await asMarina(h);
    await h.services.claims.issueReturnCode("claim-06");
    await asAdmin(h);
    expect(db(h).returnCodes.some((r) => r.itemId === "item-07")).toBe(true);
    await h.services.items.delete("item-07");
    expect(db(h).returnCodes.some((r) => r.itemId === "item-07")).toBe(false);
  });
});

describe("sigilo e auditoria (AC05.11)", () => {
  it("o código em texto puro não aparece no banco, na auditoria nem nos estados; só o hash", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    const plain = normalizeReturnCode(issued.code);
    const statuses = [await h.services.claims.getReturnCodeStatus("claim-04")];
    await expectCode(h.services.returns.verifyCode("claim-04", "2222-2222"), "VALIDATION");
    statuses.push(await h.services.returns.verifyCode("claim-04", issued.code));
    statuses.push(await h.services.claims.getReturnCodeStatus("claim-04"));
    await asMarina(h);
    statuses.push(await h.services.claims.getReturnCodeStatus("claim-04"));
    await asAdmin(h);
    const returned = await h.services.returns.register("item-05");
    const audit = await h.services.admin.listAuditLog({ pageSize: 100 });

    for (const text of [dump(h), JSON.stringify(db(h)), JSON.stringify(db(h).audit), JSON.stringify(audit), JSON.stringify(statuses), JSON.stringify(returned)]) {
      expect(text).not.toContain(plain);
      expect(text).not.toContain(issued.code);
      expect(text.toLowerCase()).not.toContain(plain.toLowerCase());
    }
    const [record] = db(h).returnCodes;
    expect(record.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(record).sort()).toEqual(
      ["claimId", "codeHash", "failedAttempts", "id", "issuedAt", "itemId", "lockedUntil", "usedAt", "verifiedAt", "verifiedById"].sort(),
    );
  });

  it("auditoria: gerar, validar, falhar, bloquear e devolver (com codeVerified), sempre sem o código", async () => {
    const h = createHarness();
    const issued = await issueForSeedClaim(h);
    for (let n = 0; n < 4; n++) await expectCode(h.services.returns.verifyCode("claim-04", "2222-2222"), "VALIDATION");
    await expectCode(h.services.returns.verifyCode("claim-04", "2222-2222"), "RATE_LIMITED");
    h.advance(RETURN_CODE_LOCK_MS);
    await h.services.returns.verifyCode("claim-04", issued.code);
    await h.services.returns.register("item-05");

    const audit = await h.services.admin.listAuditLog({ pageSize: 100 });
    const count = (action: string) => audit.items.filter((e) => e.action === action).length;
    expect(count("return_code.issue")).toBe(1);
    expect(count("return_code.failure")).toBe(5);
    expect(count("return_code.locked")).toBe(1);
    expect(count("return_code.verify")).toBe(1);
    const register = audit.items.find((e) => e.action === "return.register" && e.targetId === "item-05")!;
    expect(register.metadata).toMatchObject({ claimId: "claim-04", codeVerified: true });
    const issue = audit.items.find((e) => e.action === "return_code.issue")!;
    expect(issue).toMatchObject({ actorName: "Marina Alves", targetType: "claim", targetId: "claim-04" });
  });
});

describe("estado do mock e relógio", () => {
  it("reiniciar a demonstração apaga os códigos", async () => {
    const h = createHarness();
    await issueForSeedClaim(h);
    expect(db(h).returnCodes).toHaveLength(1);
    await h.services.demo.reset();
    expect(db(h).returnCodes).toEqual([]);
  });
});
