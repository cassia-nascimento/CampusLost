import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  /** 640 px: formulários e leitura. */
  form: "max-w-form",
  /** 1152 px: busca e detalhe. */
  page: "max-w-page",
  /** 1280 px: painel e análise lado a lado. */
  admin: "max-w-admin",
} as const;

/** Largura de conteúdo + margem lateral responsiva (16/24/32 px) + respiro vertical. Ocupa o resto da altura. */
export function Container({
  size = "page",
  className,
  children,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto flex w-full flex-1 flex-col px-gutter pt-6 pb-10", SIZES[size], className)}>
      {children}
    </div>
  );
}
