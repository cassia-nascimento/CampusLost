"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { useSession } from "@/hooks/use-session";
import { isServiceError } from "@/types/domain";
import type { GoogleSignInResult } from "@/services";
import { accountErrorMessage } from "./error-messages";
import { GoogleSignInButton } from "./GoogleSignInButton";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** Conta nova: a tela pede o papel (domínio institucional) e/ou o aceite dos termos e repassa o `ticket` opaco. */
export type GooglePending = Extract<GoogleSignInResult, { status: "needs_terms" }>;

const GENERIC_ERROR = "Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.";

/**
 * "Ou" + "Entrar com Google" (P30). Sem `NEXT_PUBLIC_GOOGLE_CLIENT_ID` nada é mostrado.
 * Quando a conta é nova, avisa `onPending` para a tela pedir o aceite dos termos.
 * A verificação do ID token é do serviço: no mock, a rota `/api/auth/google` do Next; na API, o FastAPI.
 */
export function GoogleSignIn({
  onPending,
  onNeedsTwoFactor,
  mode = "signin",
}: {
  onPending(pending: GooglePending): void;
  /** Conta com 2FA: recebe o desafio e a tela pede o código. */
  onNeedsTwoFactor(challengeToken: string): void;
  /** Na tela de cadastro o botão diz "Cadastrar-se com o Google". */
  mode?: "signin" | "signup";
}) {
  const { signInWithGoogle } = useSession();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!CLIENT_ID) return null;

  async function handleCredential(credential: string) {
    setError(null);
    setSending(true);
    try {
      const result = await signInWithGoogle(credential);
      if (result.status === "needs_2fa") onNeedsTwoFactor(result.challengeToken);
      else if (result.status !== "signed_in") onPending(result);
      // `signed_in`: RedirectIfAuthenticated leva a pessoa ao destino (mesmo caminho do login normal).
    } catch (e) {
      if (isServiceError(e) && (e.code === "FORBIDDEN_DOMAIN" || e.code === "NETWORK" || e.code === "RATE_LIMITED" || e.code === "ACCOUNT_DISABLED")) setError(e.message);
      else setError(accountErrorMessage(e, GENERIC_ERROR));
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label={mode === "signup" ? "Cadastrar com Google" : "Entrar com Google"} className="flex flex-col gap-4">
      <div aria-hidden="true" className="flex items-center gap-3 text-meta text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        ou
        <span className="h-px flex-1 bg-line" />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <GoogleSignInButton clientId={CLIENT_ID} onCredential={(c) => void handleCredential(c)} mode={mode} />
      <p role="status" className="flex items-center justify-center gap-2 text-meta text-ink-muted empty:hidden">
        {sending ? (
          <>
            <Spinner className="size-4" />
            Continuando com Google…
          </>
        ) : null}
      </p>
    </section>
  );
}
