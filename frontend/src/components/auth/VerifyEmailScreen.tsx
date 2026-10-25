"use client";

import { MailCheck, MailX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/hooks/use-session";
import { services } from "@/services";
import { AuthCard } from "./AuthCard";
import { homePathFor } from "./home-path";
import { ResendVerification } from "./ResendVerification";
import { classifyTokenFailure, type TokenFailure } from "./token-failure";

type Phase = { name: "loading" } | { name: "done" } | { name: "failed"; failure: TokenFailure };

function VerifyEmailContent() {
  const token = useSearchParams().get("token") ?? "";
  const { user, refreshUser } = useSession();
  const [phase, setPhase] = useState<Phase>(() =>
    token ? { name: "loading" } : { name: "failed", failure: "invalid" },
  );
  const [attempt, setAttempt] = useState(0);
  // O token é de uso único: o efeito roda duas vezes no modo de desenvolvimento do React, e a segunda
  // chamada receberia "link já usado". A chave guarda o que já foi enviado.
  const sentKey = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const key = `${token}:${attempt}`;
    if (sentKey.current === key) return;
    sentKey.current = key;
    services.auth.verifyEmail(token).then(
      // `verifyEmail` não devolve o usuário: relê a sessão para o aviso de e-mail sumir.
      async () => {
        await refreshUser().catch(() => undefined);
        setPhase({ name: "done" });
      },
      (error: unknown) => setPhase({ name: "failed", failure: classifyTokenFailure(error) }),
    );
  }, [token, attempt, refreshUser]);

  if (phase.name === "loading") {
    return (
      <AuthCard title="Confirmando seu e-mail…">
        <LoadingRegion label="Confirmando seu e-mail…" className="flex flex-col gap-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-12 w-full" />
        </LoadingRegion>
      </AuthCard>
    );
  }

  if (phase.name === "done") {
    return (
      <AuthCard title="E-mail confirmado">
        <EmptyState
          icon={MailCheck}
          title="Tudo certo"
          action={
            <LinkButton href={user ? homePathFor(user.role) : "/entrar"} size="lg">
              {user ? "Continuar para o CampusLost" : "Entrar"}
            </LinkButton>
          }
        >
          Seu e-mail foi confirmado. Agora você pode cadastrar itens e reivindicar.
        </EmptyState>
      </AuthCard>
    );
  }

  if (phase.failure === "other") {
    return (
      <AuthCard title="Confirmar e-mail">
        <ErrorState title="Não conseguimos confirmar agora" onRetry={() => {
            setPhase({ name: "loading" });
            setAttempt((n) => n + 1);
          }}>
          Verifique sua conexão e tente de novo.
        </ErrorState>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Link inválido ou expirado">
      <EmptyState
        variant="restricted"
        icon={MailX}
        title="Este link não funciona"
        action={
          user ? (
            <ResendVerification label="Enviar novo link" />
          ) : (
            <LinkButton href="/entrar" size="lg">
              Entrar para pedir novo link
            </LinkButton>
          )
        }
      >
        Ele pode estar incompleto, expirado ou já ter sido usado.{" "}
        {user ? "Peça um novo link abaixo." : "Entre na sua conta e peça um novo link."}
      </EmptyState>
    </AuthCard>
  );
}

/** `/verificar-email?token=` (RF01): confirma o e-mail pelo link. Funciona com ou sem sessão. */
export function VerifyEmailScreen() {
  return (
    <Suspense
      fallback={
        <LoadingRegion label="Carregando…" className="mx-auto w-full max-w-form flex-1 px-gutter pt-8">
          <Skeleton className="h-10 w-2/3" />
        </LoadingRegion>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
