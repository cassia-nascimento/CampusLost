"use client";

import { TriangleAlert } from "lucide-react";
import { usePersistence } from "@/hooks/use-persistence";

export const VOLATILE_NOTICE =
  "Seus dados desta demonstração não serão guardados neste navegador e serão perdidos ao recarregar.";

/**
 * Único aviso que permanece: quando o navegador não tem onde guardar os dados (D9), o usuário precisa saber
 * que eles se perdem ao recarregar. Fora dessa situação não renderiza nada. O `role="status"` fica sempre no
 * DOM, para o leitor de tela anunciar o texto quando ele entra.
 */
export function DemoBanner() {
  const volatile = usePersistence() === "volatile";
  return (
    <div role="status">
      {volatile ? (
        <aside aria-label="Aviso de armazenamento" className="border-b border-warning-border bg-warning-bg">
          <p className="mx-auto flex max-w-admin items-start gap-2 px-gutter py-2 text-meta text-ink">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-fg" />
            <span>{VOLATILE_NOTICE}</span>
          </p>
        </aside>
      ) : null}
    </div>
  );
}
