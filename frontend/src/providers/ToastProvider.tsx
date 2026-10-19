"use client";

import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastViewport, type ToastData, type ToastTone } from "@/components/ui/Toast";

export interface ToastOptions {
  /** Link ou botão extra no aviso (ex.: "Desfazer"). */
  action?: ReactNode;
}

export interface ToastApi {
  success(message: string, options?: ToastOptions): void;
  error(message: string, options?: ToastOptions): void;
  info(message: string, options?: ToastOptions): void;
  dismiss(): void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Um aviso por vez: o novo substitui o anterior (DESIGN §6.7). Fica no layout raiz, então sobrevive à navegação. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const nextId = useRef(1);

  const show = useCallback((tone: ToastTone, message: string, options?: ToastOptions) => {
    setToast({ id: nextId.current++, tone, message, action: options?.action });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);
  const dismissById = useCallback((id: number) => setToast((current) => (current?.id === id ? null : current)), []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => show("success", message, options),
      error: (message, options) => show("danger", message, options),
      info: (message, options) => show("info", message, options),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext value={api}>
      {children}
      <ToastViewport toast={toast} onDismiss={dismissById} />
    </ToastContext>
  );
}
