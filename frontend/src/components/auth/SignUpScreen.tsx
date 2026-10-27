"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import type { User } from "@/types/domain";
import { AuthCard } from "./AuthCard";
import { CheckEmailPanel } from "./CheckEmailPanel";
import { GoogleTermsStep } from "./GoogleTermsStep";
import { GoogleSignIn, type GooglePending } from "./GoogleSignIn";
import { TwoFactorStep } from "./TwoFactorStep";
import { AuthLoading, RedirectIfAuthenticated } from "./RedirectIfAuthenticated";
import { SignUpForm } from "./SignUpForm";
import { withNext } from "./next-param";
import { useNextPath } from "./use-next-path";

function SignUpContent() {
  const next = useNextPath();
  // `creating`/`created` seguram o redirecionamento: a conta nova já tem sessão, mas antes de seguir
  // a pessoa precisa ver "Confirme seu e-mail".
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<User | null>(null);
  const [googlePending, setGooglePending] = useState<GooglePending | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  return (
    <RedirectIfAuthenticated hold={creating || created !== null}>
      {challengeToken ? (
        <TwoFactorStep
          challengeToken={challengeToken}
          onExpired={() => setChallengeToken(null)}
          onCancel={() => setChallengeToken(null)}
        />
      ) : googlePending ? (
        <GoogleTermsStep pending={googlePending} onCancel={() => setGooglePending(null)} />
      ) : created ? (
        <CheckEmailPanel email={created.email} role={created.role} />
      ) : (
        <AuthCard title="Criar conta" description="Use e-mail e senha ou, se preferir, sua conta Google.">
          <div className="flex flex-col gap-5">
            <SignUpForm onCreatingChange={setCreating} onCreated={setCreated} />
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

/** `/cadastro` (RF01 / AC01.1): formulário e, depois de criar a conta, a tela "Confirme seu e-mail". */
export function SignUpScreen() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <SignUpContent />
    </Suspense>
  );
}
