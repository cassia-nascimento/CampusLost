import { afterEach, describe, expect, it, vi } from "vitest";
import { createDelay } from "./latency";
import { fitWithin } from "./photo";
import { createDefaultStorage, createMemoryStorage, type KeyValueStorage } from "./storage";
import { DB_KEY, MockStore, SESSION_KEY } from "./store";
import { createHarness, expectCode, fakeFile, validItem, TEST_NOW } from "./test-utils";

describe("store: persistência", () => {
  it("funciona sem window (ambiente node) com fallback em memória", async () => {
    expect(typeof window).toBe("undefined");
    const storage = createDefaultStorage();
    storage.setItem("k", "v");
    expect(storage.getItem("k")).toBe("v");
    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();

    const { createMockServices } = await import("./index");
    const svc = createMockServices({ latency: 0 }); // storage padrão
    await svc.auth.signInAsDemo("student");
    expect((await svc.items.list()).length).toBeGreaterThan(5);
  });

  it("com window.localStorage disponível, usa-o; se bloqueado, cai para a memória", () => {
    const backing = new Map<string, string>();
    const fake = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    };
    vi.stubGlobal("window", { localStorage: fake });
    try {
      createDefaultStorage().setItem("a", "1");
      expect(backing.get("a")).toBe("1");
    } finally {
      vi.unstubAllGlobals();
    }
    const blocked = {
      get localStorage(): Storage {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    vi.stubGlobal("window", blocked);
    try {
      const storage = createDefaultStorage();
      storage.setItem("b", "2");
      expect(storage.getItem("b")).toBe("2");
      expect(backing.has("b")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("usa a chave versionada e grava o seed na primeira leitura", () => {
    const storage = createMemoryStorage();
    new MockStore({ storage, now: () => TEST_NOW }).read();
    expect(DB_KEY).toMatch(/v1/);
    expect(JSON.parse(storage.getItem(DB_KEY)!).version).toBe(1);
  });

  it("estado persiste entre instâncias que compartilham o armazenamento", async () => {
    const a = createHarness();
    await a.services.auth.signInAsDemo("student");
    const created = await a.services.items.create(validItem);
    const b = createHarness({ storage: a.storage });
    expect((await b.services.auth.getCurrentUser())?.email).toBe("marina@demo.test"); // sessão persiste (AC01.4)
    expect((await b.services.items.get(created.id)).item.title).toBe(validItem.title);
  });

  it("dados de outra versão ou corrompidos são descartados e o seed volta", () => {
    for (const raw of ["{não é json", JSON.stringify({ version: 0, users: [], items: [], claims: [], returns: [] }), JSON.stringify({ foo: 1 })]) {
      const storage = createMemoryStorage();
      storage.setItem(DB_KEY, raw);
      const db = new MockStore({ storage, now: () => TEST_NOW }).read();
      expect(db.items.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("falha de cota vira ServiceError STORAGE_FULL e não altera os dados", async () => {
    const memory = createMemoryStorage();
    let full = false;
    const storage: KeyValueStorage = {
      getItem: (k) => memory.getItem(k),
      removeItem: (k) => memory.removeItem(k),
      setItem: (k, v) => {
        if (full) throw new DOMException("quota", "QuotaExceededError");
        memory.setItem(k, v);
      },
    };
    const h = createHarness({ storage });
    await h.services.auth.signInAsDemo("student");
    const before = (await h.services.items.list()).length;
    full = true;
    await expectCode(h.services.items.create(validItem), "STORAGE_FULL");
    full = false;
    expect((await h.services.items.list()).length).toBe(before);
  });

  it("notifica assinantes a cada mudança e para depois de cancelar", async () => {
    const h = createHarness();
    const listener = vi.fn();
    const off = h.services.subscribe(listener);
    await h.services.auth.signInAsDemo("student");
    const afterLogin = listener.mock.calls.length;
    expect(afterLogin).toBeGreaterThan(0);
    await h.services.items.create(validItem);
    expect(listener.mock.calls.length).toBeGreaterThan(afterLogin);
    off();
    const total = listener.mock.calls.length;
    await h.services.items.create(validItem);
    expect(listener.mock.calls.length).toBe(total);
  });

  it("reiniciar a demonstração restaura o seed e preserva sessão de usuário do seed", async () => {
    const h = createHarness();
    await h.services.auth.signInAsDemo("student");
    const created = await h.services.items.create(validItem);
    await h.services.demo.reset();
    expect((await h.services.auth.getCurrentUser())?.id).toBe("user-marina");
    await expectCode(h.services.items.get(created.id), "NOT_FOUND");
  });

  it("reiniciar a demonstração encerra a sessão de usuário que não está no seed", async () => {
    const h = createHarness();
    await h.services.auth.signUp({ name: "Nova Pessoa", email: "nova@demo.test", role: "student" });
    expect(await h.services.auth.getCurrentUser()).not.toBeNull();
    await h.services.demo.reset();
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    expect(h.storage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe("latência e falhas simuladas", () => {
  afterEach(() => vi.useRealTimers());

  it("latência zero não usa timers", async () => {
    vi.useFakeTimers();
    await createDelay(0)();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("usa a faixa 300–600 ms por padrão", async () => {
    vi.useFakeTimers();
    let done = false;
    void createDelay(undefined, () => 0.5)().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(449);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    expect(createDelay({ min: 300, max: 600 }, () => 0)).toBeTypeOf("function");
  });

  it("serviços respeitam a latência configurada", async () => {
    vi.useFakeTimers();
    const h = createHarness({ latency: { min: 300, max: 300 } });
    let done = false;
    void h.services.auth.signInAsDemo("admin").then(() => (done = true));
    await vi.advanceTimersByTimeAsync(299);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it("falha injetada em uma operação específica", async () => {
    const { ServiceError } = await import("@/types/domain");
    const h = createHarness({
      failureInjector: (op) => (op === "items.list" ? new ServiceError("UNEXPECTED", "Falha simulada.") : null),
    });
    await h.services.auth.signInAsDemo("student");
    await expectCode(h.services.items.list(), "UNEXPECTED");
    expect(await h.services.items.get("item-01")).toBeTruthy();
  });

  it("erros inesperados viram ServiceError UNEXPECTED", async () => {
    const h = createHarness({ photoProcessor: async () => { throw new Error("boom"); } });
    await h.services.auth.signInAsDemo("student");
    await expectCode(h.services.items.create({ ...validItem, photo: fakeFile() }), "UNEXPECTED");
  });
});

describe("foto", () => {
  it("fitWithin reduz mantendo proporção e nunca amplia", () => {
    expect(fitWithin(1280, 640)).toEqual({ width: 640, height: 320 });
    expect(fitWithin(640, 1280)).toEqual({ width: 320, height: 640 });
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(5000, 1)).toEqual({ width: 640, height: 1 });
  });

  it("processador padrão rejeita formato inválido e ambiente sem DOM com PHOTO_INVALID", async () => {
    const h = createHarness({ photoProcessor: undefined });
    await h.services.auth.signInAsDemo("student");
    await expectCode(h.services.items.create({ ...validItem, photo: fakeFile("a.gif", "image/gif") }), "PHOTO_INVALID");
    await expectCode(h.services.items.create({ ...validItem, photo: fakeFile("a.jpg", "image/jpeg", 6 * 1024 * 1024) }), "PHOTO_INVALID");
    await expectCode(h.services.items.create({ ...validItem, photo: fakeFile() }), "PHOTO_INVALID"); // node: sem canvas
  });
});
