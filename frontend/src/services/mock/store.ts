import { ServiceError } from "@/types/domain";
import { buildSeed, DB_VERSION, type Db } from "./seed";
import { createDefaultStorage, type KeyValueStorage } from "./storage";

/** Chaves versionadas: mudar o formato exige subir `DB_VERSION` (dados antigos são descartados). */
export const DB_KEY = `campuslost:proto:v${DB_VERSION}:db`;
export const SESSION_KEY = `campuslost:proto:v${DB_VERSION}:session`;

export interface StoreOptions {
  storage?: KeyValueStorage;
  now?: () => Date;
}

function isDb(value: unknown): value is Db {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === DB_VERSION &&
    Array.isArray(v.users) &&
    Array.isArray(v.items) &&
    Array.isArray(v.claims) &&
    Array.isArray(v.returns)
  );
}

/**
 * Persistência do mock. Cada leitura reflete o armazenamento atual (outras abas
 * incluídas) e cada escrita é uma transação síncrona: lê → altera → grava.
 * Se a gravação falhar (cota), nada é alterado e o erro vira `ServiceError`.
 */
export class MockStore {
  private readonly storage: KeyValueStorage;
  private readonly now: () => Date;
  private readonly listeners = new Set<() => void>();
  private storageListenerAttached = false;

  constructor(options: StoreOptions = {}) {
    this.storage = options.storage ?? createDefaultStorage();
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
        if (isDb(parsed)) return parsed;
      } catch {
        /* JSON corrompido: recai no seed */
      }
    }
    const seeded = buildSeed(this.now());
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
      return this.storage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }

  setSessionUserId(id: string | null): void {
    try {
      if (id === null) this.storage.removeItem(SESSION_KEY);
      else this.storage.setItem(SESSION_KEY, id);
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

  /** Alterações feitas por outra aba chegam pelo evento `storage`. */
  private attachStorageListener(): void {
    if (this.storageListenerAttached || typeof window === "undefined") return;
    this.storageListenerAttached = true;
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === DB_KEY || event.key === SESSION_KEY) this.emit();
    });
  }
}

function storageError(cause: unknown): ServiceError {
  return new ServiceError(
    "STORAGE_FULL",
    "Não foi possível salvar: o armazenamento do navegador está cheio ou indisponível. Tente uma foto menor ou use \"Reiniciar demonstração\".",
    { cause },
  );
}
