"use client";

import { TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./Button";

/**
 * `confirm`/`destructive`: caixa centrada · `sheet`: folha presa à base (filtros no celular).
 * Foco inicial: o elemento com `data-autofocus` (ou o primeiro focável). Veja `ConfirmDialog`.
 */
export type DialogVariant = "confirm" | "destructive" | "sheet";

export interface DialogProps {
  open: boolean;
  /** Chamado por Esc, clique no fundo ou botão fechar. Ignorado enquanto `busy`. */
  onClose: () => void;
  title: string;
  description?: ReactNode;
  variant?: DialogVariant;
  /** Operação em andamento: Esc, fundo e fechar ficam desativados. */
  busy?: boolean;
  children?: ReactNode;
  /** Área de ações (botões); no celular fica empilhada com a principal em cima. */
  actions?: ReactNode;
}

/**
 * Diálogo modal sobre o `<dialog>` nativo: `showModal()` prende o foco, deixa o resto inerte, Esc fecha
 * e o foco volta ao gatilho (DESIGN §6.6). A rolagem do fundo é travada em `globals.css`.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  variant = "confirm",
  busy = false,
  children,
  actions,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isSheet = variant === "sheet";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function requestClose() {
    if (!busy) onClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    // O conteúdo ocupa todo o <dialog> (sem padding próprio): clicar no próprio elemento = clicar no fundo.
    if (event.target === event.currentTarget) requestClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Esc: nós controlamos o fechamento para respeitar `busy` e manter `open` em sincronia.
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        if (open) onClose(); // fechado por outro meio (ex.: form method=dialog)
      }}
      onClick={handleBackdropClick}
      className={cn(
        "m-auto max-h-[85dvh] border-0 bg-surface p-0 text-ink shadow-overlay",
        isSheet
          ? "mb-0 w-full max-w-none rounded-t-xl rounded-b-none"
          : "w-[calc(100%-2*var(--gutter))] max-w-md rounded-xl",
      )}
    >
      {open ? (
        <div
          className={cn(
            "animate-rise relative flex max-h-[85dvh] flex-col overflow-y-auto p-5",
            isSheet && "pb-safe",
          )}
        >
          {!busy ? (
            <IconButton
              label="Fechar"
              icon={X}
              onClick={requestClose}
              className="absolute top-2 right-2"
            />
          ) : null}
          {variant === "destructive" ? (
            <TriangleAlert aria-hidden="true" className="mb-3 size-7 text-danger-fg" />
          ) : null}
          <h2 id={titleId} className="pr-10 text-h3">
            {title}
          </h2>
          {description ? (
            <div id={descriptionId} className="mt-2 text-body text-ink-muted">
              {description}
            </div>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
          {actions ? (
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** O EFEITO da ação e se é irreversível (DESIGN §6.6). */
  description: ReactNode;
  confirmLabel: string;
  /** Rótulo do botão enquanto `busy` (gerúndio). */
  confirmingLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Usa o visual destrutivo (botão `danger`) e põe o foco inicial em Cancelar. */
  destructive?: boolean;
  busy?: boolean;
}

/** Confirmação de ação. Ação principal em cima no celular; em linha [Cancelar] [Confirmar] a partir de `sm`. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  confirmingLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  destructive = false,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      variant={destructive ? "destructive" : "confirm"}
      busy={busy}
      actions={
        <>
          <Button
            variant="secondary"
            size="lg"
            width="mobile-full"
            disabled={busy}
            onClick={onClose}
            data-autofocus={destructive ? true : undefined}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            size="lg"
            width="mobile-full"
            loading={busy}
            loadingText={confirmingLabel}
            onClick={onConfirm}
            data-autofocus={destructive ? undefined : true}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
