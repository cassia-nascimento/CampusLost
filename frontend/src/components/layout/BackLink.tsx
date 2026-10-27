"use client";

import { LinkButton } from "@/components/ui/Button";
import { ChevronLeft } from "lucide-react";
import { useRouteChrome } from "./use-route-chrome";

/**
 * Retorno contextual no topo das páginas internas, a partir de 768 px (DESIGN §6.12): ali o header não tem
 * seta de voltar. No celular o header já a mostra, então este link fica oculto. Destino e texto vêm de
 * `getRouteChrome` (a mesma fonte do header): respeita `?de=` e a última busca de `/itens`.
 * Não renderiza nada em páginas de topo. Precisa estar dentro de `<Suspense>` (como os shells).
 */
export function BackLink() {
  const { chrome } = useRouteChrome();
  if (chrome.kind !== "detail") return null;

  return (
    <LinkButton
      href={chrome.backHref}
      variant="ghost"
      icon={ChevronLeft}
      className="-ml-4 mb-2 hidden self-start md:inline-flex"
    >
      {chrome.backLabel}
    </LinkButton>
  );
}
