import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bloco de carregamento decorativo. Dê a ele a mesma geometria do conteúdo final. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

/**
 * Região de carregamento: `aria-busy` + texto para leitores de tela (DESIGN §6.8).
 * Os filhos devem ser `Skeleton`s (decorativos).
 */
export function LoadingRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={className}>
      <p role="status" className="sr-only">
        {label}
      </p>
      {children}
    </div>
  );
}
