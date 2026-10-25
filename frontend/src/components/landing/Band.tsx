import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  paper: "",
  surface: "bg-surface",
  primary: "bg-primary",
} as const;

/**
 * Faixa de largura total da landing (DESIGN §9.13): alterna o fundo entre as seções para dar ritmo, e mantém o
 * conteúdo na largura de página. `primary` exige texto `on-primary` e nenhum controle interativo dentro.
 */
export function Band({
  tone = "paper",
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={TONES[tone]}>
      <div className={cn("mx-auto w-full max-w-page px-gutter py-12 lg:py-16", className)}>{children}</div>
    </div>
  );
}
