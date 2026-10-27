"use client";

import type { ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { DemoBanner } from "./DemoNotice";
import { showsBottomNav } from "./navigation";
import { useRouteChrome } from "./use-route-chrome";

/**
 * Estrutura das páginas autenticadas: aviso de armazenamento, header, `<main id="conteudo">`
 * (alvo do link "Pular para o conteúdo"), rodapé e BottomNav (celular, páginas de topo).
 * As páginas escolhem a largura com `Container`. Lê `useSearchParams`: precisa estar dentro de `<Suspense>`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname, chrome } = useRouteChrome();
  const { user } = useSession();
  const bottomNav = user !== null && showsBottomNav(pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <AppHeader chrome={chrome} pathname={pathname} />
      <main id="conteudo" tabIndex={-1} className={cn("flex flex-1 flex-col outline-none", bottomNav && "max-md:pb-bottomnav")}>
        {children}
      </main>
      {bottomNav && user ? <BottomNav role={user.role} pathname={pathname} /> : null}
    </div>
  );
}
