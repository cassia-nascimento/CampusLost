"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { services } from "@/services";
import type { DemoProfileKey } from "@/services";
import { isServiceError } from "@/types/domain";

/** Entrada com um toque pelos dois perfis de demonstração: usuário e administração (AC01.3). */
export function DemoProfiles() {
  const { signInAsDemo } = useSession();
  const toast = useToast();
  const profiles = useServiceQuery(() => services.auth.listDemoProfiles(), []);
  const [pendingKey, setPendingKey] = useState<DemoProfileKey | null>(null);

  async function enter(key: DemoProfileKey) {
    setPendingKey(key);
    try {
      await signInAsDemo(key);
    } catch (error) {
      toast.error(isServiceError(error) ? error.message : "Não foi possível entrar. Tente de novo em instantes.");
    } finally {
      setPendingKey(null);
    }
  }

  // Servidor sem modo de demonstração (`/demo/*` desligado): os atalhos somem, sem erro.
  if (profiles.status === "success" && profiles.data?.length === 0) return null;

  return (
    <section aria-labelledby="demo-profiles-title">
      <h2 id="demo-profiles-title" className="sr-only">
        Perfis de demonstração
      </h2>

      {profiles.status === "loading" ? (
        <LoadingRegion label="Carregando perfis de demonstração…" className="mt-3 flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </LoadingRegion>
      ) : null}

      {profiles.status === "error" ? (
        <Notice
          tone="danger"
          role="alert"
          className="mt-3"
          action={
            <Button variant="secondary" onClick={profiles.refetch}>
              Tentar novamente
            </Button>
          }
        >
          Não conseguimos carregar os perfis de demonstração. Você ainda pode entrar com um e-mail cadastrado.
        </Notice>
      ) : null}

      {profiles.status === "success" ? (
        <ul className="mt-3 flex flex-col gap-3">
          {profiles.data?.map(({ key, label, user }) => (
            <li key={key}>
              <Button
                variant="secondary"
                size="lg"
                width="full"
                loading={pendingKey === key}
                loadingText="Entrando…"
                disabled={pendingKey !== null && pendingKey !== key}
                onClick={() => void enter(key)}
              >
                <span className="flex flex-col py-1 leading-tight">
                  <span>{label}</span>
                  <span className="text-meta font-normal text-ink-muted">
                    {user.name} · {user.email}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
