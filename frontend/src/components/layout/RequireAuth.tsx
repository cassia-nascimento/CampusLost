"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { SessionLoading } from "./SessionLoading";

/**
 * Guarda de rota SIMULADA (RNF01, AC01.5): visitante vai para `/entrar`. Nada é renderizado dentro
 * dela antes de a sessão estar lida (evita piscar conteúdo e erro de hidratação). Segurança real é do backend.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "ready" && !user) router.replace("/entrar");
  }, [status, user, router]);

  if (status === "loading" || !user) return <SessionLoading />;
  return <>{children}</>;
}
