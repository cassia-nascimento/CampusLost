"use client";

import { Suspense, type ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { AppShell } from "./AppShell";
import { PublicShell } from "./PublicShell";
import { SessionLoading } from "./SessionLoading";
import { useRouteChrome } from "./use-route-chrome";

/** Visitante em `/itens` e `/itens/[id]`: header público e o mesmo voltar do shell logado (última busca). */
function VisitorShell({ children }: { children: ReactNode }) {
  const { pathname, chrome } = useRouteChrome();
  return (
    <PublicShell pathname={pathname} chrome={chrome}>
      {children}
    </PublicShell>
  );
}

/**
 * Casca das rotas abertas a todos (`/itens`, `/itens/[id]`; P26): com sessão, o shell logado de sempre; sem
 * sessão, o header público e nenhuma navegação inferior. Nada é renderizado antes de a sessão ser lida, para
 * não piscar uma casca e trocar por outra. O `Suspense` é exigido pelo `useSearchParams` dos dois shells.
 */
export function BrowseShell({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  if (status === "loading") return <SessionLoading />;
  return (
    <Suspense fallback={<SessionLoading />}>
      {user ? <AppShell>{children}</AppShell> : <VisitorShell>{children}</VisitorShell>}
    </Suspense>
  );
}
