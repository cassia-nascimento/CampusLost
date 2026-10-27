import { ServiceError, type ServiceErrorCode } from "@/types/domain";
import { createDefaultStorage, type KeyValueStorage } from "../mock/storage";

/**
 * Chave do token de versões antigas (Bearer em `sessionStorage`). O cliente NÃO guarda mais token algum: a sessão
 * é cookie HttpOnly. A chave só existe para ser APAGADA na subida.
 */
export const LEGACY_TOKEN_STORAGE_KEY = "campuslost.api.token.v1";

/**
 * Dica NÃO sensível ("este navegador tem sessão"), em `localStorage`. Evita pedir `/auth/me` (e `/auth/refresh`)
 * a cada visitante anônimo. Quem decide se a sessão vale é sempre o cookie, no servidor.
 */
export const SESSION_HINT_KEY = "campuslost.api.session-hint.v1";

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
  /** Base da API, sem barra final. Em produção, o prefixo same-origin `/backend` (cookies HttpOnly, sem CORS). */
  baseUrl: string;
  /** Injetável nos testes. Padrão: `fetch` global (chamado sem `this` indevido). */
  fetch?: typeof fetch;
  /** Onde fica a dica de sessão (sem token). Padrão: `localStorage` (com fallback em memória). */
  storage?: KeyValueStorage;
  /** Onde apagar o token legado de versões antigas. Padrão: `sessionStorage`. */
  legacyStorage?: KeyValueStorage;
  /** Tempo máximo de uma requisição comum. */
  timeoutMs?: number;
  /** Tempo máximo de um envio com arquivo (multipart). */
  uploadTimeoutMs?: number;
  /** Chamado quando a sessão acabou (401 e o refresh falhou). A API usa para avisar a UI. */
  onSessionExpired?: () => void;
}

export interface RequestOptions {
  query?: Record<string, string | undefined>;
  json?: unknown;
  form?: FormData;
  /**
   * Mantém a mensagem do servidor num 429. Padrão: o 429 vira a mensagem genérica com o `Retry-After` (login, 2FA).
   * A conferência do código de retirada informa o tempo exato no texto do servidor.
   */
  keepRateLimitMessage?: boolean;
  /** `false`: chamada pública de sessão (login, cadastro, Google, demo, refresh): em 401 NÃO tenta renovar. Padrão `true`. */
  auth?: boolean;
}

export interface HttpClient {
  readonly baseUrl: string;
  /** `T` é o formato que o chamador espera; nada é validado em tempo de execução além do JSON. */
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  /** Este navegador tem (ou teve) sessão? Dica local; o servidor decide. */
  hasSession(): boolean;
  /** Marca que há sessão (depois de login/cadastro/2FA/convite). */
  markSession(): void;
  /** Esquece a sessão local (logout, exclusão de conta, sessão expirada). Não chama o servidor. */
  clearSession(): void;
  /** Troca o cookie de refresh por um novo par (POST /auth/refresh). Chamadas simultâneas compartilham UMA requisição. */
  refresh(): Promise<boolean>;
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

function buildError(response: Response, body: unknown, keepRateLimitMessage = false): ServiceError {
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
  const serverMessage = typeof record.message === "string" && record.message.trim() !== "";
  if (code === "RATE_LIMITED" && !(keepRateLimitMessage && serverMessage)) message = rateLimitMessage(retryAfterSeconds(response));
  const fieldErrors = parseFieldErrors(record.fieldErrors);
  return new ServiceError(code, message, fieldErrors ? { fieldErrors } : undefined);
}

export function createHttpClient(options: HttpOptions): HttpClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const storage = options.storage ?? createDefaultStorage("local");
  const timeoutMs = options.timeoutMs ?? 15_000;
  const uploadTimeoutMs = options.uploadTimeoutMs ?? 60_000;

  // Limpeza única na subida: o token antigo (Bearer em sessionStorage) não deve sobrar no navegador.
  for (const area of [options.legacyStorage ?? createDefaultStorage("session"), storage]) {
    try {
      area.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    } catch {
      // ignorado
    }
  }

  const hasSession = () => {
    try {
      return storage.getItem(SESSION_HINT_KEY) === "1";
    } catch {
      return false;
    }
  };
  const markSession = () => {
    try {
      storage.setItem(SESSION_HINT_KEY, "1");
    } catch {
      // sem onde guardar: a dica dura até recarregar a página
    }
  };
  const clearSession = () => {
    try {
      storage.removeItem(SESSION_HINT_KEY);
    } catch {
      // ignorado
    }
  };

  const doFetch = (input: string, init: RequestInit) =>
    (options.fetch ?? ((i: RequestInfo | URL, n?: RequestInit) => fetch(i, n)))(input, init);

  function buildUrl(path: string, query?: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== "") params.set(key, value);
    }
    const qs = params.toString();
    return `${baseUrl}${path}${qs ? `?${qs}` : ""}`;
  }

  /** Uma tentativa de HTTP (sem renovação). Lança `ServiceError`. */
  async function send<T>(method: HttpMethod, path: string, opts: RequestOptions): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    // Anti-CSRF: o backend exige este cabeçalho em mutações autenticadas por cookie (inclusive refresh e logout).
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
      response = await doFetch(buildUrl(path, opts.query), {
        method,
        headers,
        body,
        signal: controller.signal,
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch (cause) {
      throw new ServiceError("NETWORK", NETWORK_MESSAGE, { cause });
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return undefined as T;
    const parsed = await readBody(response);
    if (!response.ok) throw buildError(response, parsed, opts.keepRateLimitMessage);
    if (parsed === undefined) {
      throw new ServiceError("UNEXPECTED", UNEXPECTED_MESSAGE, { cause: new Error("resposta sem JSON") });
    }
    return parsed as T;
  }

  let refreshing: Promise<boolean> | null = null;
  function refresh(): Promise<boolean> {
    // Duas chamadas que levam 401 juntas compartilham a MESMA renovação (o refresh é de uso único: a segunda
    // requisição seria lida como reuso/roubo e derrubaria a sessão).
    refreshing ??= send("POST", "/auth/refresh", { auth: false })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  async function request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    try {
      return await send<T>(method, path, opts);
    } catch (error) {
      const expired = error instanceof ServiceError && error.code === "UNAUTHENTICATED" && opts.auth !== false;
      if (!expired) throw error;
      // Cookie de acesso vencido: UMA tentativa de renovar e repetir a chamada original.
      if (await refresh()) {
        try {
          return await send<T>(method, path, opts);
        } catch (retryError) {
          if (!(retryError instanceof ServiceError && retryError.code === "UNAUTHENTICATED")) throw retryError;
        }
      }
      // Sessão encerrada de verdade: esquece a dica e avisa a UI (só se havia sessão, para não gerar laço de releituras).
      if (hasSession()) {
        clearSession();
        options.onSessionExpired?.();
      }
      throw error;
    }
  }

  return { baseUrl, request, hasSession, markSession, clearSession, refresh };
}
