"use client";

import { useEffect, useRef } from "react";
import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { services } from "@/services";
import type { UserRole } from "@/types/domain";
import { AuthCard } from "./AuthCard";
import { homePathFor } from "./home-path";
import { ResendVerification } from "./ResendVerification";
import { useNextPath } from "./use-next-path";

/**
 * Tela "Confirme seu e-mail" depois do cadastro. A conta já tem sessão e pode navegar, mas só cadastra item
 * e reivindica depois de confirmar. No mock mostra o link simulado (`peekSimulatedEmail`), que também
 * sobrevive ao recarregamento; se o e-mail for confirmado em outra aba, a tela passa a dizer isso.
 */
export function CheckEmailPanel({ email, role }: { email: string; role: UserRole }) {
  const { user } = useSession();
  const next = useNextPath();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const simulated = useServiceQuery(async () => (await services.auth.peekSimulatedEmail?.()) ?? null, []);
  const verified = user?.emailVerified === true;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <AuthCard
      title={verified ? "E-mail confirmado" : "Confirme seu e-mail"}
      headingRef={headingRef}
      description={
        verified ? (
          "Tudo certo: você já pode cadastrar itens e reivindicar."
        ) : (
          <>
            Enviamos um link de confirmação para <strong className="user-text font-semibold text-ink">{email}</strong>.
            Abra o e-mail e toque no link.
          </>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {verified ? null : (
          <>
            <Notice tone="info">
              Até confirmar, você pode ver os itens, mas não pode cadastrar itens nem reivindicar. Não achou a
              mensagem? Olhe a caixa de spam ou peça outro link.
            </Notice>
            <ResendVerification label="Reenviar e-mail" initialDevLink={simulated.data?.devLink ?? null} />
          </>
        )}
        <LinkButton
          href={next ?? homePathFor(role)}
          variant={verified ? "primary" : "ghost"}
          size="lg"
          width="mobile-full"
        >
          Continuar para o CampusLost
        </LinkButton>
      </div>
    </AuthCard>
  );
}
