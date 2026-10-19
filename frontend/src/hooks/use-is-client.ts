"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` no servidor e na hidratação, `true` depois no navegador. Use para conteúdo que depende do
 * relógio, do fuso ou do armazenamento do navegador e por isso não pode sair no HTML do servidor.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
