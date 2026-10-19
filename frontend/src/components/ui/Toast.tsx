"use client";

import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";
import { TONE_CLASSES, type Tone } from "./tones";

export type ToastTone = Extract<Tone, "success" | "danger" | "info">;

export interface ToastData {
  id: number;
  tone: ToastTone;
  message: string;
  /** Link ou botão opcional (ex.: "Desfazer"). */
  action?: ReactNode;
}

const ICONS: Record<ToastTone, LucideIcon> = {
  success: CircleCheck,
  danger: CircleAlert,
  info: Info,
};

/** Sucesso e informação somem sozinhos; erro fica até ser dispensado (DESIGN §6.7). */
export const TOAST_DURATION_MS = 6000;

/**
 * Posição: base do celular acima do BottomNav ou da ActionBar (quando a página tem uma delas) e canto inferior
 * direito a partir de `md`. O BottomNav marca-se com `data-bottomnav`; a ActionBar com `data-actionbar` e publica
 * a altura em `--actionbar-h`. O seletor `body:has(...)` evita acoplar o provider ao layout.
 */
const VIEWPORT_CLASSES =
  "pointer-events-none fixed inset-x-0 bottom-4 z-60 flex flex-col items-center px-gutter pb-safe " +
  "max-md:[body:has([data-bottomnav])_&]:bottom-[calc(var(--bottomnav-h)+0.75rem)] " +
  "max-md:[body:has([data-actionbar])_&]:bottom-[calc(var(--actionbar-h,0px)+0.75rem)] " +
  "md:inset-x-auto md:right-4 md:items-end md:px-0";

/**
 * Contêiner fixo com duas regiões vivas SEMPRE presentes (educada para sucesso/info, `alert` para erro):
 * regiões já existentes no DOM são anunciadas de forma confiável pelos leitores de tela.
 */
export function ToastViewport({
  toast,
  onDismiss,
}: {
  toast: ToastData | null;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className={VIEWPORT_CLASSES}>
      <div role="status" className="w-full max-w-sm">
        {toast && toast.tone !== "danger" ? <ToastCard toast={toast} onDismiss={onDismiss} /> : null}
      </div>
      <div role="alert" className="w-full max-w-sm">
        {toast && toast.tone === "danger" ? <ToastCard toast={toast} onDismiss={onDismiss} /> : null}
      </div>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const Icon = ICONS[toast.tone];
  const autoDismiss = toast.tone !== "danger";

  useEffect(() => {
    if (!autoDismiss || paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [autoDismiss, paused, toast.id, onDismiss]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "animate-rise pointer-events-auto flex items-start gap-3 rounded-lg border-l-4 bg-surface py-3 pr-1 pl-4 shadow-overlay",
        TONE_CLASSES[toast.tone].border,
      )}
    >
      <Icon aria-hidden="true" className={cn("mt-2.5 size-5 shrink-0", TONE_CLASSES[toast.tone].fg)} />
      <div className="min-w-0 flex-1 py-2 text-body text-ink">
        {toast.message}
        {toast.action ? <div className="mt-1 font-semibold">{toast.action}</div> : null}
      </div>
      <IconButton label="Dispensar aviso" icon={X} onClick={() => onDismiss(toast.id)} />
    </div>
  );
}
