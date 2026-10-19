"use client";

import { Info, TriangleAlert } from "lucide-react";
import { usePersistence } from "@/hooks/use-persistence";
import { cn } from "@/lib/utils";

/**
 * AC01.6 / RNF01: aviso de segurança simulada e de dados fictícios (DESIGN §8.1 e §10).
 * Os dados do protótipo (usuários, itens, categorias e locais) são demonstrativos e não representam o campus.
 */
const DEMO_BANNER_BASE = "Demonstração: login simulado; usuários, itens, categorias e locais são fictícios";
export const DEMO_BANNER_TEXT = `${DEMO_BANNER_BASE} e os dados ficam salvos só neste navegador.`;
/** Sem a promessa de guardar os dados: vale quando o navegador não tem onde guardá-los (ver `VOLATILE_NOTICE`). */
export const DEMO_BANNER_TEXT_VOLATILE = `${DEMO_BANNER_BASE}.`;

export const VOLATILE_NOTICE =
  "Seus dados desta demonstração não serão guardados neste navegador e serão perdidos ao recarregar.";

export const DEMO_FULL_NOTICE =
  "Este é um protótipo. O login é simulado, nenhuma senha é pedida ou guardada, e os dados ficam apenas neste navegador. Usuários, itens, categorias e locais são fictícios e não representam o campus real. A segurança real depende do sistema final.";

/**
 * Faixa informativa no topo de todas as páginas, num landmark próprio (`aside`) para o conteúdo não ficar
 * fora de regiões. Não é fixa: rola junto, para não roubar altura nem cobrir a ActionBar/BottomNav.
 * Quando o navegador não guarda os dados (D9), uma segunda linha avisa; o `role="status"` fica sempre no
 * DOM, para o leitor de tela anunciar o texto quando ele entra.
 */
export function DemoBanner() {
  const volatile = usePersistence() === "volatile";
  return (
    <aside aria-label="Aviso de demonstração" className="border-b border-info-border bg-info-bg">
      <p className="mx-auto flex max-w-admin items-start gap-2 px-gutter py-2 text-meta text-ink">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info-fg" />
        <span>{volatile ? DEMO_BANNER_TEXT_VOLATILE : DEMO_BANNER_TEXT}</span>
      </p>
      <div role="status" className={cn(volatile && "border-t border-warning-border bg-warning-bg")}>
        {volatile ? (
          <p className="mx-auto flex max-w-admin items-start gap-2 px-gutter py-2 text-meta text-ink">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-fg" />
            <span>{VOLATILE_NOTICE}</span>
          </p>
        ) : null}
      </div>
    </aside>
  );
}

/** Rodapé com o texto completo da simulação (desktop; no celular vale o banner e a tela de entrada). */
export function DemoFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("hidden border-t border-line bg-surface md:block", className)}>
      <p className="mx-auto max-w-admin px-gutter py-4 text-meta text-ink-muted">
        <strong className="font-semibold text-ink">Modo demonstração. </strong>
        {DEMO_FULL_NOTICE}
      </p>
    </footer>
  );
}
