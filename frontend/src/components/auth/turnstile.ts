/** Lógica pura e carregamento do script do Cloudflare Turnstile (sem dependências novas). */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Chave pública do site; vazia/ausente = sem captcha (modo atual). */
export function readSiteKey(raw: string | undefined): string | undefined {
  const key = raw?.trim();
  return key ? key : undefined;
}

/** O envio fica bloqueado enquanto o widget está ativo e ainda não entregou um token. */
export function isSubmitBlocked(siteKey: string | undefined, token: string | undefined): boolean {
  return Boolean(siteKey) && !token;
}

export interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "light" | "dark" | "auto";
      size: "normal" | "flexible" | "compact";
      language: string;
      callback(token: string): void;
      "expired-callback"(): void;
      "error-callback"(): void;
      "timeout-callback"?(): void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

/** Carrega o script uma única vez; em falha, limpa o cache para permitir nova tentativa. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("sem navegador"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile ausente")));
    script.onerror = () => {
      script.remove();
      reject(new Error("falha ao carregar"));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}
