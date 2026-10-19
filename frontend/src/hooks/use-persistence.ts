"use client";

import { useSyncExternalStore } from "react";
import { services, type DemoPersistence } from "@/services";

const subscribeNever = () => () => undefined;

/**
 * Se os dados da demonstração sobrevivem a recarregar (`durable`) ou se perdem (`volatile`).
 * No servidor e na hidratação vale `durable`, para o HTML não trazer o aviso; o valor real entra logo
 * depois da hidratação (mesmo padrão de `useMinWidth`).
 */
export function usePersistence(): DemoPersistence {
  return useSyncExternalStore(subscribeNever, () => services.demo.persistence(), () => "durable");
}
