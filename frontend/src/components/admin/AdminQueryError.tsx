"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ACCOUNT_TWO_FACTOR_PATH } from "@/components/account/two-factor";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { ServiceError } from "@/types/domain";
import { isForbidden, isTwoFactorRequired } from "./admin-errors";

/**
 * Falha ao carregar uma lista da administração. Sem 2FA (`TWO_FACTOR_REQUIRED`): leva a `/conta` com o aviso
 * (e, se o redirecionamento não acontecer, mostra o link). Sem permissão: explica. Demais: "Tentar novamente".
 */
export function AdminQueryError({
  error,
  title,
  onRetry,
}: {
  error: ServiceError | undefined;
  title: string;
  onRetry(): void;
}) {
  const router = useRouter();
  const twoFactor = isTwoFactorRequired(error);

  useEffect(() => {
    if (twoFactor) router.replace(ACCOUNT_TWO_FACTOR_PATH);
  }, [twoFactor, router]);

  if (twoFactor) {
    return (
      <EmptyState
        variant="restricted"
        title="Ative a verificação em duas etapas"
        action={<LinkButton href={ACCOUNT_TWO_FACTOR_PATH}>Ir para Minha conta</LinkButton>}
      >
        A administração precisa dela para abrir esta tela. Estamos levando você para Minha conta.
      </EmptyState>
    );
  }
  if (isForbidden(error)) {
    return (
      <EmptyState variant="restricted" title="Você não tem acesso a esta tela">
        {error?.message}
      </EmptyState>
    );
  }
  return (
    <ErrorState title={title} onRetry={onRetry}>
      {error?.message}
    </ErrorState>
  );
}
