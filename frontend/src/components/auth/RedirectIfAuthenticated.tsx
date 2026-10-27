"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/hooks/use-session";
import { homePathFor } from "./home-path";
import { useNextPath } from "./use-next-path";

/**
 * Guarda das rotas públicas (`/entrar`, `/cadastro`): quem já tem sessão vai direto para o destino `?next=`
 * (P28, só `/itens/<id>`) ou, sem ele, para a página inicial do seu perfil. Nada é mostrado antes de a sessão
 * ser lida, para o formulário não piscar para quem está logado. Exige `<Suspense>` acima (`useSearchParams`).
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  const router = useRouter();
  const next = useNextPath();

  useEffect(() => {
    if (status === "ready" && user) router.replace(next ?? homePathFor(user.role));
  }, [status, user, next, router]);

  if (status !== "ready" || user) return <AuthLoading />;
  return <>{children}</>;
}

/** Esqueleto de `/entrar` e `/cadastro` enquanto a sessão é lida (também o `fallback` do `Suspense` das telas). */
export function AuthLoading() {
  return (
    <LoadingRegion label="Carregando…" className="mx-auto w-full max-w-form flex-1 px-gutter pt-8">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-6 h-12 w-full" />
      <Skeleton className="mt-4 h-12 w-full" />
    </LoadingRegion>
  );
}
