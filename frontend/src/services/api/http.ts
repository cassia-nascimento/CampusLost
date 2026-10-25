import { ServiceError, type ServiceErrorCode } from "@/types/domain";
import { createDefaultStorage, type KeyValueStorage } from "../mock/storage";

/** Chave versionada do token de sessão. `sessionStorage`: uma sessão por aba, como a P21 (sobrevive a recarregar). */
export const TOKEN_STORAGE_KEY = "campuslost.api.token.v1";

export const NETWORK_MESSAGE = "Não foi possível falar com o servidor. Tente de novo em instantes.";
const UNEXPECTED_MESSAGE = "Algo deu errado. Tente novamente.";
const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Entre novamente.";

const KNOWN_CODES: ReadonlySet<string> = new Set<ServiceErrorCode>([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "INVALID_TRANSITION",
  "DUPLICATE_CLAIM",
  "CLAIM_BLOCKED",
  "ITEM_RETURNED",
  "EMAIL_TAKEN",
  "EMAIL_NOT_VERIFIED",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "CSRF_FAILED",
  "CAPTCHA_FAILED",
  "INVALID_CREDENTIALS",
  "FORBIDDEN_DOMAIN",
  "PHOTO_INVALID",
  "ACCOUNT_DISABLED",
  "TWO_FACTOR_REQUIRED",
  "STORAGE_FULL",
  "RATE_LIMITED",
  "NETWORK",
  "CONFLICT",
  "UNEXPECTED",
]);

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpOptions {
  /** Endereço da API, sem barra final. */
  baseUrl: string;
  /** Injetável nos testes. Padrão: `fetch` global (chamado sem `this` indevido). */
  fetch?: typeof fetch;
  /** Onde fica o token. Padrão: `sessionStorage` (com fallback em memória). */
  storage?: KeyValueStorage;
  /** Tempo máximo de uma requisição comum. */
  timeoutMs?: number;
  /** Tempo máximo de um envio com arquivo (multipart). */
  uploadTimeoutMs?: number;
  /** Chamado quando o servidor recusa o token (sessão expirada). A API usa para avisar a UI. */
  onSessionExpired?: () => void;
}

export interface RequestOptions {
  query?: Record<string, string | undefined>;
  json?: unknown;
  form?: FormData;
  /** `false`: não envia o token (login, cadastro, Google, demo). Padrão `true`. */
  auth?: boolean;
}

export interface HttpClient {
  readonly baseUrl: string;
  /** `T` é o formato que o chamador espera; nada é validado em tempo de execução além do JSON. */
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
}

function statusToCode(status: number): ServiceErrorCode {
  switch (status) {
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 413:
    case 422:
      return "VALIDATION";
    case 429:
      return "RATE_LIMITED";
    default:
      return "UNEXPECTED";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFieldErrors(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(value)) {
    if (typeof message === "string") out[key] = message;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Segundos do `Retry-After` (só o formato numérico; data HTTP é ignorada). */
function retryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get("Retry-After");
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const seconds = Number(raw);
  return seconds > 0 ? seconds : null;
}

export function rateLimitMessage(seconds: number | null): string {
  if (seconds === null) return "Muitas tentativas. Aguarde um instante e tente de novo.";
  const wait = seconds >= 90 ? `${Math.ceil(seconds / 60)} minutos` : seconds === 1 ? "1 segundo" : `${seconds} segundos`;
  return `Muitas tentativas. Tente de novo em ${wait}.`;
}

async function readBody(response: Response): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return undefined;
  }
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function buildError(response: Response, body: unknown): ServiceError {
  const record = isRecord(body) ? body : {};
  const declared = typeof record.code === "string" && KNOWN_CODES.has(record.code) ? (record.code as ServiceErrorCode) : null;
  // A API chama de INVALID_TOKEN (link inválido OU expirado); a UI trata um código só: TOKEN_INVALID.
  const code: ServiceErrorCode = declared === "INVALID_TOKEN" ? "TOKEN_INVALID" : (declared ?? statusToCode(response.status));
  let message =
    typeof record.message === "string" && record.message.trim() !== ""
      ? record.message
      : code === "UNAUTHENTICATED"
        ? SESSION_EXPIRED_MESSAGE
        : UNEXPECTED_MESSAGE;
  if (code === "RATE_LIMITED") message = rateLimitMessage(retryAfterSeconds(response));
  const fieldErrors = parseFieldErrors(record.fieldErrors);
  return new ServiceError(code, message, fieldErrors ? { fieldErrors } : undefined);
}

export function createHttpClient(options: HttpOptions): HttpClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const storage = options.storage ?? createDefaultStorage("session");
  const timeoutMs = options.timeoutMs ?? 15_000;
  const uploadTimeoutMs = options.uploadTimeoutMs ?? 60_000;

  const getToken = () => {
    try {
      return storage.getItem(TOKEN_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  };
  const setToken = (token: string) => {
    try {
      storage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // sem onde guardar: a sessão dura até recarregar a página
    }
  };
  const clearToken = () => {
    try {
      storage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignorado
    }
  };

  async function request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined && value !== "") url.searchParams.set(key, value);
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    const token = opts.auth === false ? null : getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    // Anti-CSRF: o backend exige este cabeçalho em mutações (obrigatório quando a auth é por cookie; inofensivo com Bearer).
    if (method !== "GET") headers["X-Requested-With"] = "CampusLost";
    let body: BodyInit | undefined;
    if (opts.form) {
      body = opts.form; // o navegador define o Content-Type com o boundary
    } else if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.json);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.form ? uploadTimeoutMs : timeoutMs);
    let response: Response;
    try {
      const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
      response = await doFetch(url.toString(), { method, headers, body, signal: controller.signal, cache: "no-store" });
    } catch (cause) {
      throw new ServiceError("NETWORK", NETWORK_MESSAGE, { cause });
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return undefined as T;
    const parsed = await readBody(response);
    if (!response.ok) {
      const error = buildError(response, parsed);
      // Token enviado e recusado: a sessão acabou. Descarta e avisa (login com senha errada é INVALID_CREDENTIALS, não entra aqui).
      if (token && response.status === 401 && error.code === "UNAUTHENTICATED") {
        clearToken();
        options.onSessionExpired?.();
      }
      throw error;
    }
    if (parsed === undefined) {
      throw new ServiceError("UNEXPECTED", UNEXPECTED_MESSAGE, { cause: new Error("resposta sem JSON") });
    }
    return parsed as T;
  }

  return { baseUrl, request, getToken, setToken, clearToken };
}
