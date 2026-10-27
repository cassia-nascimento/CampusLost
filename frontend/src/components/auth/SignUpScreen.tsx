"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { AuthCard } from "./AuthCard";
import { GoogleTermsStep } from "./GoogleTermsStep";
import { GoogleSignIn, type GooglePending } from "./GoogleSignIn";
import { TwoFactorStep } from "./TwoFactorStep";
import { AuthLoading, RedirectIfAuthenticated } from "./RedirectIfAuthenticated";
import { SignUpForm } from "./SignUpForm";
import { withNext } from "./next-param";
import { useNextPath } from "./use-next-path";

function SignUpContent() {
  const next = useNextPath();
  const [googlePending, setGooglePending] = useState<GooglePending | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  return (
    <RedirectIfAuthenticated>
      {challengeToken ? (
        <TwoFactorStep
          challengeToken={challengeToken}
          onExpired={() => setChallengeToken(null)}
          onCancel={() => setChallengeToken(null)}
        />
      ) : googlePending ? (
        <GoogleTermsStep pending={googlePending} onCancel={() => setGooglePending(null)} />
      ) : (
        <AuthCard title="Criar conta" description="Use e-mail e senha ou, se preferir, sua conta Google.">
          <div className="flex flex-col gap-5">
            <SignUpForm />
            <GoogleSignIn mode="signup" onPending={setGooglePending} onNeedsTwoFactor={setChallengeToken} />
            <p className="text-body text-ink-muted">
              Já tem conta?{" "}
              <Link href={withNext("/entrar", next)} className="link touch-target inline-flex items-center font-semibold">
                Entrar
              </Link>
            </p>
          </div>
        </AuthCard>
      )}
    </RedirectIfAuthenticated>
  );
}

/** `/cadastro` (RF01 / AC01.1): formulário; a conta nova já tem sessão e segue o fluxo normal de acesso. */
export function SignUpScreen() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <SignUpContent />
    </Suspense>
  );
}
