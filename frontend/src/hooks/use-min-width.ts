"use client";

import { useSyncExternalStore } from "react";

/**
 * `true` quando a janela tem pelo menos `minWidth`, sempre em `rem` como os breakpoints do Tailwind
 * (`"48rem"` = `md`, `"64rem"` = `lg`). `false` no servidor e na hidratação (mobile-first).
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
