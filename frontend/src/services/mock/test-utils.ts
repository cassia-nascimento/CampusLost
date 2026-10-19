import { ServiceError, type ServiceErrorCode } from "@/types/domain";
import type { Services } from "../contracts";
import { createMockServices } from "./index";
import { createMemoryStorage, type KeyValueStorage } from "./storage";
import type { MockServicesOptions } from "./context";

/** 19/10/2026 10:00 (hora local) — "hoje" fixo dos testes. */
export const TEST_NOW = new Date(2026, 9, 19, 10, 0, 0);

let idCounter = 0;

export interface Harness {
  services: Services;
  /** Banco (compartilhável entre "abas"). */
  storage: KeyValueStorage;
  /** Sessão desta "aba". */
  sessionStorage: KeyValueStorage;
  /** Avança o relógio simulado. */
  advance(ms: number): void;
  clock(): Date;
}

export function createHarness(options: MockServicesOptions & { start?: Date } = {}): Harness {
  let current = options.start ?? TEST_NOW;
  const storage = options.storage ?? createMemoryStorage();
  const sessionStorage = options.sessionStorage ?? createMemoryStorage();
  const services = createMockServices({
    latency: 0,
    storage,
    sessionStorage,
    now: () => current,
    // contador global: várias "abas" no mesmo teste nunca geram ids repetidos
    generateId: (prefix) => `${prefix}-t${++idCounter}`,
    photoProcessor: async (file) => `data:image/jpeg;base64,FAKE-${file.name}`,
    ...options,
  });
  return {
    services,
    storage,
    sessionStorage,
    advance: (ms) => void (current = new Date(current.getTime() + ms)),
    clock: () => current,
  };
}

/** Afirma que a promessa rejeita com `ServiceError` do código dado. */
export async function expectCode(promise: Promise<unknown>, code: ServiceErrorCode): Promise<ServiceError> {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    if (error.code !== code) throw new Error(`Esperava ${code}, recebeu ${error.code}: ${error.message}`);
    return error;
  }
  throw new Error(`Esperava rejeição ${code}, mas a promessa resolveu`);
}

export function fakeFile(name = "foto.jpg", type = "image/jpeg", size = 1000): File {
  return new File([new Uint8Array(size)], name, { type });
}

export const validItem = {
  title: "Garrafa azul",
  description: "Garrafa de plástico azul com tampa preta.",
  category: "Outros",
  foundLocation: "Cantina",
  foundDate: "2026-10-19",
  storedAt: "Portaria",
} as const;

export const validClaim = {
  proofDetails: "Tem um adesivo de estrela no fundo.",
  lostWhereWhen: "Cantina, hoje de manhã.",
} as const;
