import { ServiceError, type ServiceErrorCode } from "@/types/domain";
import type { Services } from "../contracts";
import { createMockServices } from "./index";
import { createMemoryStorage, type KeyValueStorage } from "./storage";
import type { MockServicesOptions } from "./context";
import type { GoogleProfile, GoogleSignInResult, SignInResult } from "../contracts";
import type { User } from "@/types/domain";
import { encodeGoogleTicket } from "./google";
import { DEMO_PASSWORD } from "./seed";
import type { ReturnView } from "../contracts";

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
    // nos testes o "ID token" é o próprio perfil em JSON (ver `googleCredential`)
    verifyGoogleCredential: async (credential) => JSON.parse(credential) as GoogleProfile,
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

/** Usuário de um resultado `signed_in` (falha o teste se pediu 2FA ou outro passo). */
export function userOf(result: SignInResult | GoogleSignInResult): User {
  if (result.status !== "signed_in") throw new Error(`Esperava signed_in, recebeu ${result.status}`);
  return result.user;
}

/** Entra como Rafael Lima (usuário institucional de apoio do seed) pela senha de demonstração. */
export async function signInAsRafael(services: Services): Promise<User> {
  return userOf(await services.auth.signIn({ email: "rafael@demo.test", password: "demonstracao123" }));
}

/** "ID token" falso aceito pelo verificador do harness. */
export const googleCredential = (profile: GoogleProfile): string => JSON.stringify(profile);
/** Ticket de `needs_terms` para um perfil (equivale a obter `needs_terms` e guardar o ticket). */
export const googleTicket = (profile: GoogleProfile): string => encodeGoogleTicket(profile);

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
  categoryOther: "Garrafa térmica",
  foundLocation: "Cantina",
  foundDate: "2026-10-19",
  storedAt: "Portaria",
} as const;

export const validClaim = {
  proofDetails: "Tem um adesivo de estrela no fundo.",
  lostWhereWhen: "Cantina, hoje de manhã.",
} as const;

/**
 * Fluxo completo de entrega com código de retirada: o proprietário (autor da reivindicação aceita) gera o código,
 * a administração o valida e confirma a entrega. Exige uma sessão de administração para começar e termina nela.
 * Só serve para contas demonstrativas do seed (senha de demonstração).
 */
export async function deliverItem(h: Harness, itemId: string): Promise<ReturnView> {
  const { services } = h;
  const accepted = (await services.claims.listByItem(itemId)).find((c) => c.status === "accepted");
  if (!accepted) throw new Error(`O item ${itemId} não tem reivindicação aceita`);
  userOf(await services.auth.signIn({ email: accepted.claimant.email, password: DEMO_PASSWORD }));
  const issued = await services.claims.issueReturnCode(accepted.id);
  await services.auth.signInAsDemo("admin");
  await services.returns.verifyCode(accepted.id, issued.code);
  return services.returns.register(itemId);
}
