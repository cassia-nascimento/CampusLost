"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "./SessionProvider";
import { ToastProvider } from "./ToastProvider";

/** Providers globais, montados uma vez no layout raiz. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SessionProvider>{children}</SessionProvider>
    </ToastProvider>
  );
}
