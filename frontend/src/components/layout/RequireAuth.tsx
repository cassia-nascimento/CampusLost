"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { withNext } from "@/components/auth/next-param";
import { useSession } from "@/hooks/use-session";
import { SessionLoading } from "./SessionLoading";

/**
 * Guarda de rota SIMULADA (RNF01, AC01.5): visitante vai para `/entrar`; vindo de `/itens/<id>/reivindicar`,
 * o `?next=` leva de volta ao detalhe do item (P28; `withNext` valida o destino). Nada é renderizado dentro
 * dela antes de a sessão estar lida (evita piscar conteúdo e erro de hidratação). Segurança real é do backend.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "ready" || user) return;
    const claimOf = /^\/itens\/([^/]+)\/reivindicar$/.exec(pathname);
    router.replace(claimOf ? withNext("/entrar", `/itens/${claimOf[1]}`) : "/entrar");
  }, [status, user, pathname, router]);

  if (status === "loading" || !user) return <SessionLoading />;
  return <>{children}</>;
}
