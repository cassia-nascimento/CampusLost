import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockServices } from "./index";
import { createDelay } from "./latency";
import { fitWithin } from "./photo";
import { createDefaultStorage, createMemoryStorage, type KeyValueStorage } from "./storage";
import { DB_KEY, MockStore, SESSION_KEY } from "./store";
import { buildSeed, DB_VERSION } from "./seed";
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
    await svc.auth.signInAsDemo("user");
    expect((await svc.items.list()).length).toBeGreaterThan(5);
  });

  it("com window.localStorage disponível, usa-o; se bloqueado, cai para a memória", () => {
    const backing = new Map<string, string>();
    const fake = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    };
    const sessionBacking = new Map<string, string>();
    const fakeSession = {
      getItem: (k: string) => sessionBacking.get(k) ?? null,
      setItem: (k: string, v: string) => void sessionBacking.set(k, v),
      removeItem: (k: string) => void sessionBacking.delete(k),
    };
    vi.stubGlobal("window", { localStorage: fake, sessionStorage: fakeSession });
    try {
      createDefaultStorage().setItem("a", "1");
      expect(backing.get("a")).toBe("1");
      createDefaultStorage("session").setItem("s", "1");
      expect(sessionBacking.get("s")).toBe("1");
      expect(backing.has("s")).toBe(false);
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
    expect(DB_KEY).toBe(`campuslost:proto:v${DB_VERSION}:db`);
    expect(SESSION_KEY).toBe(`campuslost:proto:v${DB_VERSION}:session`);
    expect(DB_VERSION).toBeGreaterThanOrEqual(3); // v2: fotos do seed (P27); v3: senhas/Google (P29/P30)
    expect(JSON.parse(storage.getItem(DB_KEY)!).version).toBe(DB_VERSION);
  });

  it("seed antigo (v1, sem fotos) é descartado: o navegador recebe o seed novo com fotos", () => {
    const storage = createMemoryStorage();
    const oldDb = { ...buildSeed(TEST_NOW), version: 1 };
    oldDb.items = oldDb.items.map(({ photoDataUrl: _p, ...rest }) => (void _p, rest));
    storage.setItem("campuslost:proto:v1:db", JSON.stringify(oldDb));
    const db = new MockStore({ storage, now: () => TEST_NOW }).read();
    expect(db.version).toBe(DB_VERSION);
    expect(db.items.every((i) => i.photoDataUrl)).toBe(true);
    expect(storage.getItem("campuslost:proto:v1:db")).toBeNull();
    // mesmo dado antigo gravado sob a chave nova (versão interna divergente) também é descartado
    storage.setItem(DB_KEY, JSON.stringify(oldDb));
    expect(new MockStore({ storage, now: () => TEST_NOW }).read().items.every((i) => i.photoDataUrl)).toBe(true);
  });

  it("ao carregar, descarta photoDataUrl de formato inválido e mantém os válidos", () => {
    const storage = createMemoryStorage();
    const db = buildSeed(TEST_NOW);
    db.items[0].photoDataUrl = "javascript:alert(1)";
    db.items[1].photoDataUrl = "data:image/jpeg;base64,OK";
    storage.setItem(DB_KEY, JSON.stringify(db));
    const read = new MockStore({ storage, now: () => TEST_NOW }).read();
    expect("photoDataUrl" in read.items[0]).toBe(false);
    expect(read.items[1].photoDataUrl).toBe("data:image/jpeg;base64,OK");
    expect(read.items[2].photoDataUrl).toBe(db.items[2].photoDataUrl);
  });

  it("a sessão usa a chave da versão atual (sessão antiga não vaza para o banco novo)", () => {
    const sessionStorage = createMemoryStorage();
    sessionStorage.setItem("campuslost:proto:v1:session", "user-marina");
    const store = new MockStore({ storage: createMemoryStorage(), sessionStorage, now: () => TEST_NOW });
    expect(store.getSessionUserId()).toBeNull();
    store.setSessionUserId("user-rafael");
    expect(sessionStorage.getItem(SESSION_KEY)).toBe("user-rafael");
  });

  it("estado persiste entre instâncias que compartilham o armazenamento", async () => {
    const a = createHarness();
    await a.services.auth.signInAsDemo("user");
    const created = await a.services.items.create(validItem);
    // mesma aba recarregada: mesmo banco e mesma sessão (AC01.4)
    const reloaded = createHarness({ storage: a.storage, sessionStorage: a.sessionStorage });
    expect((await reloaded.services.auth.getCurrentUser())?.email).toBe("marina@demo.test");
    expect((await reloaded.services.items.get(created.id)).item.title).toBe(validItem.title);
    // outra aba: mesmo banco, sessão própria (I1/P21)
    const otherTab = createHarness({ storage: a.storage });
    expect(await otherTab.services.auth.getCurrentUser()).toBeNull();
    await otherTab.services.auth.signInAsDemo("admin");
    expect((await a.services.auth.getCurrentUser())?.id).toBe("user-marina");
    expect((await otherTab.services.items.get(created.id)).item.title).toBe(validItem.title);
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
    await h.services.auth.signInAsDemo("user");
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
    await h.services.auth.signInAsDemo("user");
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
    await h.services.auth.signInAsDemo("user");
    const created = await h.services.items.create(validItem);
    await h.services.demo.reset();
    expect((await h.services.auth.getCurrentUser())?.id).toBe("user-marina");
    await expectCode(h.services.items.get(created.id), "NOT_FOUND");
  });

  it("reiniciar a demonstração encerra a sessão de usuário que não está no seed", async () => {
    const h = createHarness();
    await h.services.auth.signUp({ name: "Nova Pessoa", email: "nova@demo.test", password: "senha-segura-1", acceptedTerms: true });
    expect(await h.services.auth.getCurrentUser()).not.toBeNull();
    await h.services.demo.reset();
    expect(await h.services.auth.getCurrentUser()).toBeNull();
    expect(h.sessionStorage.getItem(SESSION_KEY)).toBeNull();
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
  });

  it("limite mínimo da faixa padrão (random = 0) é 300 ms e o máximo (random → 1) é 600 ms", async () => {
    vi.useFakeTimers();
    let min = false;
    void createDelay(undefined, () => 0)().then(() => (min = true));
    await vi.advanceTimersByTimeAsync(299);
    expect(min).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(min).toBe(true);

    let max = false;
    void createDelay(undefined, () => 1)().then(() => (max = true));
    await vi.advanceTimersByTimeAsync(599);
    expect(max).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(max).toBe(true);
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
    await h.services.auth.signInAsDemo("user");
    await expectCode(h.services.items.list(), "UNEXPECTED");
    expect(await h.services.items.get("item-01")).toBeTruthy();
  });

  it("erros inesperados viram ServiceError UNEXPECTED", async () => {
    const h = createHarness({ photoProcessor: async () => { throw new Error("boom"); } });
    await h.services.auth.signInAsDemo("user");
    await expectCode(h.services.items.create({ ...validItem, photo: fakeFile() }), "UNEXPECTED");
  });
});

describe("foto", () => {
  it("acima do teto de tamanho, mesmo após reduzir a qualidade, lança PHOTO_INVALID (S3)", async () => {
    const qualities: number[] = [];
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ fillRect: () => undefined, drawImage: () => undefined, fillStyle: "" }),
        toDataURL: (_type: string, quality: number) => {
          qualities.push(quality);
          return "data:image/jpeg;base64," + "A".repeat(500_000);
        },
      }),
    });
    vi.stubGlobal("createImageBitmap", async () => ({ width: 4000, height: 3000, close: () => undefined }));
    try {
      const h = createHarness({ photoProcessor: undefined });
      await h.services.auth.signInAsDemo("user");
      const error = await expectCode(h.services.items.create({ ...validItem, photo: fakeFile() }), "PHOTO_INVALID");
      expect(error.message).toMatch(/grande demais/);
      expect(qualities).toEqual([0.8, 0.6, 0.45]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("foto dentro do teto é aceita e redimensionada", async () => {
    let size = { w: 0, h: 0 };
    vi.stubGlobal("document", {
      createElement: () => {
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ({ fillRect: () => undefined, drawImage: () => undefined, fillStyle: "" }),
          toDataURL: () => {
            size = { w: canvas.width, h: canvas.height };
            return "data:image/jpeg;base64,OK";
          },
        };
        return canvas;
      },
    });
    vi.stubGlobal("createImageBitmap", async () => ({ width: 4000, height: 2000, close: () => undefined }));
    try {
      const h = createHarness({ photoProcessor: undefined });
      await h.services.auth.signInAsDemo("user");
      const item = await h.services.items.create({ ...validItem, photo: fakeFile() });
      expect(item.photoDataUrl).toBe("data:image/jpeg;base64,OK");
      expect(size).toEqual({ w: 640, h: 320 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fitWithin reduz mantendo proporção e nunca amplia", () => {
    expect(fitWithin(1280, 640)).toEqual({ width: 640, height: 320 });
    expect(fitWithin(640, 1280)).toEqual({ width: 320, height: 640 });
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(5000, 1)).toEqual({ width: 640, height: 1 });
  });

  it("processador padrão rejeita formato inválido e ambiente sem DOM com PHOTO_INVALID", async () => {
    const h = createHarness({ photoProcessor: undefined });
    await h.services.auth.signInAsDemo("user");
    await expectCode(h.services.items.create({ ...validItem, photo: fakeFile("a.gif", "image/gif") }), "PHOTO_INVALID");
    await expectCode(h.services.items.create({ ...validItem, photo: fakeFile("a.jpg", "image/jpeg", 6 * 1024 * 1024) }), "PHOTO_INVALID");
    await expectCode(h.services.items.create({ ...validItem, photo: fakeFile() }), "PHOTO_INVALID"); // node: sem canvas
  });
});

describe("store: persistência declarada (demo.persistence)", () => {
  function fakeStorage() {
    const backing = new Map<string, string>();
    return {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    };
  }

  afterEach(() => vi.unstubAllGlobals());

  it("memória (sem navegador) é volátil; armazenamento que não informa é tratado como durável", () => {
    expect(createMemoryStorage().isDurable?.()).toBe(false);
    expect(createDefaultStorage().isDurable?.()).toBe(false); // node: sem window
    expect(createHarness().services.demo.persistence()).toBe("volatile");
    const unknown = createHarness({ storage: fakeStorage() });
    expect(unknown.services.demo.persistence()).toBe("durable");
  });

  it("com localStorage disponível é durável", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage(), sessionStorage: fakeStorage() });
    const svc = createMockServices({ latency: 0 });
    expect(svc.demo.persistence()).toBe("durable");
  });

  it("com localStorage bloqueado é volátil, mas o app segue funcionando em memória", async () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new DOMException("blocked", "SecurityError");
      },
      sessionStorage: fakeStorage(),
    });
    const svc = createMockServices({ latency: 0 });
    expect(svc.demo.persistence()).toBe("volatile");
    await svc.auth.signInAsDemo("user");
    expect((await svc.items.list()).length).toBeGreaterThan(5);
  });

  it("a mensagem de cota cheia não manda reduzir a foto (todas já são redimensionadas)", async () => {
    const memory = createMemoryStorage();
    const storage: KeyValueStorage = {
      getItem: (k) => memory.getItem(k),
      removeItem: (k) => memory.removeItem(k),
      setItem: (k, v) => {
        if (k === DB_KEY && v.includes("Chaveiro de cota")) throw new DOMException("quota", "QuotaExceededError");
        memory.setItem(k, v);
      },
    };
    const h = createHarness({ storage });
    await h.services.auth.signInAsDemo("user");
    const error = await expectCode(h.services.items.create({ ...validItem, title: "Chaveiro de cota" }), "STORAGE_FULL");
    expect(error.message).not.toMatch(/foto menor/i);
    expect(error.message).toMatch(/Reiniciar demonstração/);
    expect(error.message).toMatch(/sem ela/);
  });
});
