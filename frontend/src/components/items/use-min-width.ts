"use client";

import { useSyncExternalStore } from "react";

/**
 * `true` quando a janela tem pelo menos `minWidth` (ex.: `"48rem"` = breakpoint `md`). `false` no servidor.
 * Use só quando a estrutura do DOM muda (CSS não basta), como a barra de ação fixa do celular que vira
 * botão em linha no desktop.
 */
export function useMinWidth(minWidth: string): boolean {
  const query = `(min-width: ${minWidth})`;
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
