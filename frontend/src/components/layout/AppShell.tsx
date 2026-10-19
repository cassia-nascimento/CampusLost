"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { DemoBanner, DemoFooter } from "./DemoNotice";
import { getRouteChrome, showsBottomNav } from "./navigation";

/**
 * Estrutura das páginas autenticadas: aviso de demonstração, header, `<main id="conteudo">`
 * (alvo do link "Pular para o conteúdo"), rodapé e BottomNav (celular, páginas de topo).
 * As páginas escolhem a largura com `Container`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const chrome = getRouteChrome(pathname);
  const bottomNav = user !== null && showsBottomNav(pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <AppHeader chrome={chrome} pathname={pathname} />
      <main id="conteudo" tabIndex={-1} className={cn("flex flex-1 flex-col outline-none", bottomNav && "max-md:pb-bottomnav")}>
        {children}
      </main>
      <DemoFooter />
      {bottomNav && user ? <BottomNav role={user.role} pathname={pathname} /> : null}
    </div>
  );
}
