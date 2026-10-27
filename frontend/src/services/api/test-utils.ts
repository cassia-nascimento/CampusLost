import { createMemoryStorage } from "../mock/storage";
import { createApiServices } from "./index";
import type { Services } from "../contracts";

export const BASE = "http://api.test";

export interface Call {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: BodyInit | null | undefined;
  signal?: AbortSignal | null;
}

export type Reply = { status?: number; json?: unknown; text?: string; headers?: Record<string, string> } | Error;

export function createFakeApi() {
  const calls: Call[] = [];
  const queue: Reply[] = [];
  const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? "GET",
      url: new URL(String(input)),
      headers: { ...(init?.headers as Record<string, string>) },
      body: init?.body,
      signal: init?.signal,
    });
    const reply = queue.shift();
    if (!reply) throw new Error(`fetch sem resposta enfileirada: ${init?.method} ${String(input)}`);
    if (reply instanceof Error) throw reply;
    const status = reply.status ?? 200;
    const text = reply.text ?? (reply.json === undefined ? "" : JSON.stringify(reply.json));
    return new Response(status === 204 ? null : text, { status, headers: reply.headers });
  }) as typeof fetch;
  return {
    calls,
    reply: (...replies: Reply[]) => void queue.push(...replies),
    fetch: fetchFake,
  };
}

export function createHarness(overrides: Partial<Parameters<typeof createApiServices>[0]> = {}) {
  const api = createFakeApi();
  const storage = createMemoryStorage();
  const legacyStorage = createMemoryStorage();
  const services: Services = createApiServices({
    baseUrl: BASE,
    fetch: api.fetch,
    storage,
    legacyStorage,
    polling: { pollMs: 1000, minGapMs: 100, isVisible: () => true },
    ...overrides,
  });
  return { api, storage, legacyStorage, services };
}

export const rawUser = { id: "user-marina", name: "Marina Alves", email: "marina@demo.test", role: "user", affiliation: "institutional", emailVerified: true } as const;
export const rawSession = { token: "tok-1", tokenType: "bearer", expiresAt: "2026-10-22T23:00:00.000Z", user: rawUser };

export const rawItem = {
  id: "item-03",
  title: "Chaveiro com três chaves",
  description: "Chaveiro de borracha vermelho com três chaves.",
  category: "Chaves",
  foundLocation: "Bloco A",
  foundDate: "2026-10-20",
  storedAt: "Portaria",
  photoUrl: "/uploads/seed/chaveiro.webp",
  status: "under_claim",
  createdById: "user-lucas",
  createdAt: "2026-10-20T13:00:00.000Z",
};

export const rawClaim = {
  id: "claim-01",
  itemId: "item-03",
  claimantId: "user-beatriz",
  proofDetails: "Uma das chaves é de um cadeado de armário.",
  lostWhereWhen: "Perdi no Bloco A, ontem à tarde.",
  status: "pending",
  createdAt: "2026-10-21T19:00:00.000Z",
};

export const denied = { allowed: false, code: "FORBIDDEN", message: "Somente a administração pode editar itens." };
