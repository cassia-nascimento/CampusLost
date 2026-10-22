"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { useSession } from "@/hooks/use-session";
import { isServiceError } from "@/types/domain";
import type { GoogleProfile } from "@/services";
import { GoogleSignInButton } from "./GoogleSignInButton";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const FORBIDDEN_DOMAIN = "Use o e-mail institucional da UNDB.";
const GENERIC_ERROR = "Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.";
const NETWORK_ERROR = "Sem conexão com o servidor. Confira sua internet e tente de novo.";

/** Pede ao servidor que verifique o ID token e devolva o perfil. Lança `Error` com mensagem pt-BR. */
async function verifyCredential(credential: string): Promise<GoogleProfile> {
  let response: Response;
  try {
    response = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (response.status === 403) throw new Error(FORBIDDEN_DOMAIN);
  if (!response.ok) throw new Error(GENERIC_ERROR);
  try {
    const data = (await response.json()) as Partial<GoogleProfile>;
    if (typeof data.email === "string" && typeof data.name === "string") return { email: data.email, name: data.name };
  } catch {
    // cai no erro genérico abaixo
  }
  throw new Error(GENERIC_ERROR);
}

/**
 * "Ou" + "Entrar com Google" (P30). Sem `NEXT_PUBLIC_GOOGLE_CLIENT_ID` nada é mostrado.
 * Quando a conta é nova, avisa `onNeedsRole` para a tela pedir aluno/professor.
 * Obs.: a verificação do token acontece na rota `/api/auth/google`; com o backend real ela passa para o FastAPI.
 */
export function GoogleSignIn({ onNeedsRole }: { onNeedsRole(profile: GoogleProfile): void }) {
  const { signInWithGoogle } = useSession();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!CLIENT_ID) return null;

  async function handleCredential(credential: string) {
    setError(null);
    setSending(true);
    try {
      const profile = await verifyCredential(credential);
      const result = await signInWithGoogle(profile);
      if (result.status === "needs_role") onNeedsRole(result.profile);
      // `signed_in`: RedirectIfAuthenticated leva a pessoa ao destino (mesmo caminho do login normal).
    } catch (e) {
      if (isServiceError(e) && e.code === "FORBIDDEN_DOMAIN") setError(FORBIDDEN_DOMAIN);
      else setError(e instanceof Error && !isServiceError(e) ? e.message : GENERIC_ERROR);
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
