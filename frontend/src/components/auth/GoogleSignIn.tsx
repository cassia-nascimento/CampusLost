"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { useSession } from "@/hooks/use-session";
import { isServiceError } from "@/types/domain";
import type { GoogleSignInResult } from "@/services";
import { GoogleSignInButton } from "./GoogleSignInButton";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const FORBIDDEN_DOMAIN = "Use o e-mail institucional da UNDB.";
/** Conta nova: a tela pede o papel e repassa o `ticket` opaco ao concluir o cadastro. */
export type GoogleRolePending = Extract<GoogleSignInResult, { status: "needs_role" }>;

const GENERIC_ERROR = "Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.";

/**
 * "Ou" + "Entrar com Google" (P30). Sem `NEXT_PUBLIC_GOOGLE_CLIENT_ID` nada é mostrado.
 * Quando a conta é nova, avisa `onNeedsRole` para a tela pedir aluno/professor.
 * A verificação do ID token é do serviço: no mock, a rota `/api/auth/google` do Next; na API, o FastAPI.
 */
export function GoogleSignIn({ onNeedsRole }: { onNeedsRole(pending: GoogleRolePending): void }) {
  const { signInWithGoogle } = useSession();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!CLIENT_ID) return null;

  async function handleCredential(credential: string) {
    setError(null);
    setSending(true);
    try {
      const result = await signInWithGoogle(credential);
      if (result.status === "needs_role") onNeedsRole(result);
      // `signed_in`: RedirectIfAuthenticated leva a pessoa ao destino (mesmo caminho do login normal).
    } catch (e) {
      if (isServiceError(e) && e.code === "FORBIDDEN_DOMAIN") setError(FORBIDDEN_DOMAIN);
      else if (isServiceError(e) && (e.code === "NETWORK" || e.code === "RATE_LIMITED")) setError(e.message);
      else setError(GENERIC_ERROR);
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label="Entrar com Google" className="flex flex-col gap-4">
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
      <GoogleSignInButton clientId={CLIENT_ID} onCredential={(c) => void handleCredential(c)} />
      <p role="status" className="flex items-center justify-center gap-2 text-meta text-ink-muted empty:hidden">
        {sending ? (
          <>
            <Spinner className="size-4" />
            Entrando com Google…
          </>
        ) : null}
      </p>
    </section>
  );
}
