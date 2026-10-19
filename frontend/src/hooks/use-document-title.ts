"use client";

import { useLayoutEffect } from "react";

/**
 * Título da aba para telas cujo título só se conhece depois de ler os dados (ex.: o título do item) ou
 * que trocam o conteúdo da rota (ex.: "Acesso restrito" no lugar do painel). O `metadata` do Next cobre as
 * demais telas, com o mesmo sufixo (ver `app/layout.tsx`). `null` mantém o título atual.
 *
 * Enquanto a tela está montada ela é a dona do título: o Next aplica o `title` do `metadata` da rota
 * (inclusive por streaming, logo depois da hidratação) e o sobrescreveria, então o título é reaplicado se
 * mudar. O observador é desligado na própria desmontagem (efeito de layout, antes de o Next gravar o
 * título da rota seguinte), por isso a navegação não é afetada. Não há restauração do título anterior.
 */
export function useDocumentTitle(title: string | null): void {
  useLayoutEffect(() => {
    if (!title) return;
    const full = `${title} · CampusLost`;
    const apply = () => {
      if (document.title !== full) document.title = full;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [title]);
}
