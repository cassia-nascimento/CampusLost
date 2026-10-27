import { ServiceError } from "@/types/domain";
import { isStoredPhotoSrc } from "@/lib/validation";
import { buildSeed, DB_VERSION, type Db } from "./seed";
import { createDefaultStorage, type KeyValueStorage } from "./storage";

const KEY_PREFIX = "campuslost:proto";

/** Chaves versionadas: mudar o formato exige subir `DB_VERSION` (dados antigos são descartados). */
export const DB_KEY = `${KEY_PREFIX}:v${DB_VERSION}:db`;
export const SESSION_KEY = `${KEY_PREFIX}:v${DB_VERSION}:session`;

/** Chaves de versões anteriores do banco (não confundir com a atual). */
function legacyDbKeys(): string[] {
  return Array.from({ length: DB_VERSION - 1 }, (_, i) => `${KEY_PREFIX}:v${i + 1}:db`);
}

export interface StoreOptions {
  /** Banco (padrão: `localStorage`, compartilhado entre abas). */
  storage?: KeyValueStorage;
  /** Sessão (padrão: `sessionStorage`: cada aba tem a sua e ela sobrevive a recarregar). */
  sessionStorage?: KeyValueStorage;
  now?: () => Date;
}

/** Descarta `photoDataUrl` de formato inválido (banco adulterado/corrompido); o item segue sem foto. */
function sanitizePhotos(db: Db): Db {
  if (db.items.every((i) => i.photoDataUrl === undefined || isStoredPhotoSrc(i.photoDataUrl))) return db;
  return {
    ...db,
    items: db.items.map((i) => {
      if (i.photoDataUrl === undefined || isStoredPhotoSrc(i.photoDataUrl)) return i;
      const { photoDataUrl: _dropped, ...rest } = i;
      void _dropped;
      return rest;
    }),
  };
}

function isDb(value: unknown): value is Db {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === DB_VERSION &&
    Array.isArray(v.users) &&
    Array.isArray(v.credentials) &&
    Array.isArray(v.tokens) &&
    Array.isArray(v.items) &&
    Array.isArray(v.claims) &&
    Array.isArray(v.returns) &&
    Array.isArray(v.returnCodes) &&
    Array.isArray(v.accounts) &&
    Array.isArray(v.twoFactor) &&
    Array.isArray(v.invites) &&
    Array.isArray(v.audit)
  );
}

/**
 * Persistência do mock. Cada leitura reflete o armazenamento atual (outras abas
 * incluídas) e cada escrita é uma "transação" síncrona: lê → altera → grava.
 * Se a gravação falhar (cota), nada é alterado e o erro vira `ServiceError`.
 *
 * LIMITAÇÃO CONHECIDA: não há trava entre abas. "Transação" aqui significa apenas
 * (a) serializada dentro da aba, porque o corpo é síncrono, e (b) revalidada contra o
 * estado lido no instante da escrita. Duas abas gravando no mesmo instante podem
 * sobrescrever uma à outra (a última vence). Aceitável para um protótipo de uma pessoa
 * só; uma API real resolve com transações no servidor (e `CONFLICT`).
 *
 * Banco em `localStorage` (compartilhado), sessão em `sessionStorage` (por aba).
 */
export class MockStore {
  private readonly storage: KeyValueStorage;
  private readonly sessionStorage: KeyValueStorage;
  private readonly now: () => Date;
  private readonly listeners = new Set<() => void>();
  private storageListenerAttached = false;

  constructor(options: StoreOptions = {}) {
    this.storage = options.storage ?? createDefaultStorage("local");
    this.sessionStorage = options.sessionStorage ?? createDefaultStorage("session");
    this.now = options.now ?? (() => new Date());
  }

  /** Estado atual (cópia nova a cada chamada; alterar o retorno não persiste nada). */
  read(): Db {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(DB_KEY);
    } catch {
      raw = null;
    }
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isDb(parsed)) return sanitizePhotos(parsed);
      } catch {
        /* JSON corrompido: recai no seed */
      }
    }
    const seeded = buildSeed(this.now());
    // Descarta bancos de versões antigas (liberam espaço); a sessão antiga fica órfã e inofensiva.
    for (const key of legacyDbKeys()) {
      try {
        this.storage.removeItem(key);
      } catch {
        /* ignora */
      }
    }
    try {
      this.storage.setItem(DB_KEY, JSON.stringify(seeded));
    } catch {
      /* sem persistência: a primeira escrita relatará STORAGE_FULL */
    }
    return seeded;
  }

  /** Executa `fn` sobre uma cópia; grava e notifica só se `fn` terminar sem lançar. */
  transaction<T>(fn: (db: Db) => T): T {
    const db = this.read();
    const result = fn(db);
    this.write(db);
    this.emit();
    return result;
  }

  /** `volatile` quando o banco não tem onde ficar além da memória (os dados somem ao recarregar). */
  persistence(): "durable" | "volatile" {
    return this.storage.isDurable?.() === false ? "volatile" : "durable";
  }

  /** Restaura o seed. Mantém a sessão apenas se o usuário existir no seed. */
  reset(): void {
    const seeded = buildSeed(this.now());
    this.write(seeded);
    const sessionId = this.getSessionUserId();
    if (sessionId && !seeded.users.some((u) => u.id === sessionId)) {
      this.setSessionUserId(null);
    }
    this.emit();
  }

  getSessionUserId(): string | null {
    try {
      return this.sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }

  setSessionUserId(id: string | null): void {
    try {
      if (id === null) this.sessionStorage.removeItem(SESSION_KEY);
      else this.sessionStorage.setItem(SESSION_KEY, id);
    } catch (cause) {
      throw storageError(cause);
    }
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    this.attachStorageListener();
    return () => void this.listeners.delete(listener);
  }

  private write(db: Db): void {
    try {
      this.storage.setItem(DB_KEY, JSON.stringify(db));
    } catch (cause) {
      throw storageError(cause);
    }
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  /**
   * Alterações no banco feitas por outra aba chegam pelo evento `storage`.
   * A sessão é por aba (`sessionStorage`), então a de outra aba não interessa e é ignorada.
   */
  private attachStorageListener(): void {
    if (this.storageListenerAttached || typeof window === "undefined") return;
    this.storageListenerAttached = true;
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === DB_KEY) this.emit();
    });
  }
}

function storageError(cause: unknown): ServiceError {
  return new ServiceError(
    "STORAGE_FULL",
    "Não foi possível salvar: o armazenamento do navegador está cheio ou indisponível. Se o envio tiver foto, tente sem ela; ou use \"Reiniciar demonstração\" no menu da conta para liberar espaço (isso apaga os dados criados aqui).",
    { cause },
  );
}
