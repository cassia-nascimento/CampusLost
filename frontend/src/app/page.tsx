"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homePathFor } from "@/components/auth/home-path";
import { SessionLoading } from "@/components/layout/SessionLoading";
import { useSession } from "@/hooks/use-session";

/**
 * `/` não tem conteúdo próprio: só redireciona. Com sessão vai para a página inicial do perfil
 * (administração → `/admin`; demais → `/itens`); sem sessão, para `/entrar`.
 */
export default function HomePage() {
  const { user, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "ready") return;
    router.replace(user ? homePathFor(user.role) : "/entrar");
  }, [status, user, router]);

  return <SessionLoading />;
}
