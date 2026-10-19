"use client";

import { useSyncExternalStore } from "react";

/**
 * `true` quando a media query casa. No servidor e na hidratação vale `false` (mobile-first);
 * as telas da administração só renderizam depois da sessão, então não há salto visível.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
