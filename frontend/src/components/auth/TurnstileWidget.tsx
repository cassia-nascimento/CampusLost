"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { loadTurnstile } from "./turnstile";

interface TurnstileWidgetProps {
  siteKey: string;
  onToken(token: string): void;
  /** Token expirou ou o desafio falhou: o formulário deve descartar o token. */
  onInvalidate(): void;
  /** Recebe o id do widget (ou null ao desmontar) para o hook poder chamar `reset`. */
  onWidgetId(id: string | null): void;
}

/** Verificação de segurança (Cloudflare Turnstile). Renderização explícita; tema claro; cabe em 360 px. */
export function TurnstileWidget({ siteKey, onToken, onInvalidate, onWidgetId }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onToken, onInvalidate, onWidgetId });
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callbacks.current = { onToken, onInvalidate, onWidgetId };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let widgetId: string | null = null;
    let api: Awaited<ReturnType<typeof loadTurnstile>> | null = null;
    const fail = () => {
      setFailed(true);
      callbacks.current.onInvalidate();
    };
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        api = turnstile;
        widgetId = turnstile.render(container, {
          sitekey: siteKey,
          theme: "light",
          size: container.clientWidth < 300 ? "compact" : "flexible",
          language: "pt-br",
          callback: (token) => {
            setFailed(false);
            callbacks.current.onToken(token);
          },
          "expired-callback": () => callbacks.current.onInvalidate(),
          "error-callback": fail,
          "timeout-callback": () => callbacks.current.onInvalidate(),
        });
        callbacks.current.onWidgetId(widgetId);
      })
      .catch(() => {
        if (!cancelled) fail();
      });
    return () => {
      cancelled = true;
      callbacks.current.onWidgetId(null);
      if (api && widgetId) api.remove(widgetId);
    };
  }, [siteKey, attempt]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={containerRef} role="group" aria-label="Verificação de segurança" className="min-h-[65px] w-full max-w-full overflow-hidden" />
      {failed ? (
        <div role="alert" className="flex flex-col items-start gap-1 text-meta text-danger-fg">
          <p>Não foi possível carregar a verificação de segurança.</p>
          <Button
            variant="ghost"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            Tentar de novo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
