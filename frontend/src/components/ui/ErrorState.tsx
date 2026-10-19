"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  /** Causa provável + o que fazer. */
  children?: ReactNode;
  /** Refaz a chamada sem recarregar a página. Sem ele, o botão não aparece. */
  onRetry?: () => void;
  className?: string;
}

/** Falha de carregamento no lugar do conteúdo (DESIGN §6.10). `role="alert"`. */
export function ErrorState({
  title = "Não conseguimos carregar os dados",
  children = "Verifique sua conexão e tente de novo.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("mx-auto flex max-w-sm flex-col items-center px-2 py-10 text-center", className)}
    >
      <div className="flex size-16 items-center justify-center rounded-lg bg-danger-bg text-danger-fg">
        <TriangleAlert aria-hidden="true" className="size-6" />
      </div>
      <h2 className="mt-5 text-h3">{title}</h2>
      <div className="mt-2 text-body text-ink-muted">{children}</div>
      {onRetry ? (
        <div className="mt-6">
          <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
