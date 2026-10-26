"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { isSubmitBlocked, loadTurnstile, readSiteKey } from "@/components/auth/turnstile";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";

const SITE_KEY = readSiteKey(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export interface UseTurnstile {
  /** Token atual (indefinido sem chave configurada ou antes de o desafio ser resolvido). */
  token: string | undefined;
  /** Descarta o token e reinicia o desafio (chamar após erro de servidor ou envio). */
  reset(): void;
  /** Elemento a renderizar no formulário; nulo sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. */
  widget: ReactNode;
  /** Widget ativo e sem token: o botão de envio deve ficar desabilitado. */
  blocked: boolean;
}

/** Cloudflare Turnstile para formulários de conta. Sem chave configurada, não faz nada. */
export function useTurnstile(enabled = true): UseTurnstile {
  const siteKey = enabled ? SITE_KEY : undefined;
  const [token, setToken] = useState<string>();
  const widgetId = useRef<string | null>(null);

  const reset = useCallback(() => {
    setToken(undefined);
    const id = widgetId.current;
    if (id) void loadTurnstile().then((api) => api.reset(id)).catch(() => undefined);
  }, []);
  const invalidate = useCallback(() => setToken(undefined), []);
  const onWidgetId = useCallback((id: string | null) => {
    widgetId.current = id;
  }, []);

  const widget = useMemo(
    () =>
      siteKey ? <TurnstileWidget siteKey={siteKey} onToken={setToken} onInvalidate={invalidate} onWidgetId={onWidgetId} /> : null,
    [siteKey, invalidate, onWidgetId],
  );

  return { token: siteKey ? token : undefined, reset, widget, blocked: isSubmitBlocked(siteKey, token) };
}
