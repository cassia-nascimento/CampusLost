import { ServiceError, type PublicUser, type User } from "@/types/domain";
import { checkCapability, assertAllowed, type Capability } from "@/lib/rules";
import { toFieldErrors } from "@/lib/validation/common";
import type { z } from "zod";
import { createDelay, type LatencyOption } from "./latency";
import { processPhotoInBrowser, type PhotoProcessor } from "./photo";
import type { Db } from "./seed";
import { MockStore } from "./store";
import type { KeyValueStorage } from "./storage";

export interface MockServicesOptions {
  /** Banco. Padrão: `localStorage` com fallback em memória. Testes passam um armazenamento em memória. */
  storage?: KeyValueStorage;
  /** Sessão (por aba). Padrão: `sessionStorage` com fallback em memória. */
  sessionStorage?: KeyValueStorage;
  /** Relógio injetável (seed e datas dos registros). */
  now?: () => Date;
  /** Milissegundos fixos ou `{ min, max }`. Padrão 300–600 ms; use `0` nos testes. */
  latency?: LatencyOption;
  random?: () => number;
  /** Gerador de ids. Padrão: prefixo + trecho aleatório. */
  generateId?: (prefix: string) => string;
  /** Padrão: redimensiona no navegador (canvas). Testes injetam um falso. */
  photoProcessor?: PhotoProcessor;
  /**
   * Falha simulável, pensada apenas para testes: chamado a cada operação
   * (ex.: `"items.list"`); se devolver um erro, a operação o lança.
   */
  failureInjector?: (operation: string) => ServiceError | null | undefined;
}

export interface MockContext {
  store: MockStore;
  now(): Date;
  newId(prefix: string): string;
  photo: PhotoProcessor;
  /**
   * Captura o usuário da sessão NO INSTANTE DA CHAMADA (antes da latência), aplica latência e
   * falha injetada, passa o usuário capturado a `fn` e converte erros inesperados em `ServiceError`.
   * Quem muda dados deve revalidar o usuário na transação com `requireUser`.
   */
  run<T>(
    operation: string,
    fn: (actor: User | null) => T | Promise<T>,
    opts?: { instant?: boolean },
  ): Promise<T>;
}

function defaultGenerateId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${random}`;
}

export function createContext(options: MockServicesOptions = {}): MockContext {
  const now = options.now ?? (() => new Date());
  const store = new MockStore({ storage: options.storage, sessionStorage: options.sessionStorage, now });
  const delay = createDelay(options.latency, options.random);
  const generateId = options.generateId ?? defaultGenerateId;

  return {
    store,
    now,
    newId: generateId,
    photo: options.photoProcessor ?? processPhotoInBrowser,
    async run(operation, fn, opts) {
      try {
        const actor = currentUser(store.getSessionUserId(), store.read());
        if (!opts?.instant) await delay();
        const injected = options.failureInjector?.(operation);
        if (injected) throw injected;
        return await fn(actor);
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        throw new ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.", {
          cause: error,
        });
      }
    },
  };
}

/* ---------- Helpers de leitura/validação compartilhados ---------- */

export function currentUser(sessionUserId: string | null, db: Db): User | null {
  return (sessionUserId && db.users.find((u) => u.id === sessionUserId)) || null;
}

/**
 * Exige sessão (`actor` capturado antes da latência) e REVALIDA contra o banco atual que o
 * usuário ainda existe (ex.: a demonstração foi reiniciada no meio da operação).
 * Devolve o usuário atualizado. Não verifica papel.
 */
export function requireSession(db: Db, actor: User | null): User {
  if (actor == null) {
    throw new ServiceError("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  }
  const fresh = db.users.find((u) => u.id === actor.id);
  if (!fresh) throw new ServiceError("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.");
  return fresh;
}

/** `requireSession` + exige a capacidade (papel) indicada. */
export function requireUser(db: Db, actor: User | null, capability: Capability): User {
  const user = requireSession(db, actor);
  assertAllowed(checkCapability(user, capability));
  return user;
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, role: user.role };
}

export function findUser(db: Db, id: string): User {
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new ServiceError("UNEXPECTED", "Dados inconsistentes: usuário não encontrado.");
  return user;
}

export function findItem(db: Db, id: string) {
  const item = db.items.find((i) => i.id === id);
  if (!item) throw new ServiceError("NOT_FOUND", "Item não encontrado.");
  return item;
}

/** Valida com zod e lança `VALIDATION` (com `fieldErrors`) em caso de erro. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ServiceError("VALIDATION", "Confira os campos destacados.", {
      fieldErrors: toFieldErrors(result.error),
    });
  }
  return result.data;
}
