import type { ReactNode } from "react";

/**
 * Barra de ação de formulário/detalhe (DESIGN §6.13). No celular fica colada à base da tela
 * (sticky dentro do `Container`, então não cobre o fim do conteúdo); a partir de `md` é uma linha comum.
 *
 * Passe os botões na ordem [secundários…, principal]: no celular a principal aparece em cima
 * (use `size="lg"` e `width="mobile-full"`); no desktop ficam em linha, principal à direita.
 * O `-mb-10` compensa o `pb-10` do `Container`.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none sticky bottom-0 z-20 mt-auto -mb-10 -mx-(--gutter) pt-8 md:pointer-events-auto md:static md:mx-0 md:mb-0 md:mt-8 md:pt-0">
      <div className="pointer-events-auto flex flex-col-reverse gap-3 bg-surface px-gutter pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-bar md:flex-row md:justify-end md:bg-transparent md:p-0 md:shadow-none">
        {children}
      </div>
    </div>
  );
}
