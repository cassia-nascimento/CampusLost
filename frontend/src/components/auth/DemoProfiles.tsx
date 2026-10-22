"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { services } from "@/services";
import { ROLE_LABEL, isServiceError, type UserRole } from "@/types/domain";

/** Entrada com um toque pelos três perfis de demonstração (AC01.3). */
export function DemoProfiles() {
  const { signInAsDemo } = useSession();
  const toast = useToast();
  const profiles = useServiceQuery(() => services.auth.listDemoProfiles(), []);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  async function enter(role: UserRole) {
    setPendingRole(role);
    try {
      await signInAsDemo(role);
    } catch (error) {
      toast.error(isServiceError(error) ? error.message : "Não foi possível entrar. Tente de novo em instantes.");
    } finally {
      setPendingRole(null);
    }
  }

  // Servidor sem modo de demonstração (`/demo/*` desligado): os atalhos somem, sem erro.
  if (profiles.status === "success" && profiles.data?.length === 0) return null;

  return (
    <section aria-labelledby="demo-profiles-title">
      <h2 id="demo-profiles-title" className="text-meta font-semibold text-ink-muted font-sans tracking-normal">
        Ou entre com um perfil de demonstração
      </h2>

      {profiles.status === "loading" ? (
        <LoadingRegion label="Carregando perfis de demonstração…" className="mt-3 flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-md" />
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
          {profiles.data?.map(({ role, user }) => (
            <li key={role}>
              <Button
                variant="secondary"
                size="lg"
                width="full"
                loading={pendingRole === role}
                loadingText="Entrando…"
                disabled={pendingRole !== null && pendingRole !== role}
                onClick={() => void enter(role)}
              >
                <span className="flex flex-col py-1 leading-tight">
                  <span>{ROLE_LABEL[role]} demo</span>
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
