"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { Brand } from "@/components/layout/Brand";
import { Notice } from "@/components/ui/Notice";
import { HOW_IT_WORKS_STEPS } from "@/components/landing/steps";
import { DemoProfiles } from "./DemoProfiles";
import { GoogleTermsStep } from "./GoogleTermsStep";
import { GoogleSignIn, type GooglePending } from "./GoogleSignIn";
import { withNext } from "./next-param";
import { AuthLoading, RedirectIfAuthenticated } from "./RedirectIfAuthenticated";
import { useNextPath } from "./use-next-path";
import { SignInForm } from "./SignInForm";
import { TwoFactorStep } from "./TwoFactorStep";

/** Painel de marca da tela de entrada (somente a partir de `lg`, DESIGN §9.1): o ciclo em quatro passos. */
function BrandPanel() {
  return (
    <section
      aria-labelledby="como-funciona"
      className="hidden flex-col justify-center gap-10 bg-primary px-12 py-16 text-on-primary lg:flex"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="block size-20 shrink-0 bg-on-primary"
          style={{
            maskImage: "url(/brand/logo-mark-mono.svg)",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            maskSize: "contain",
          }}
        />
        <p className="font-display text-h2 font-bold tracking-tight">CampusLost</p>
      </div>
      <div>
        <h2 id="como-funciona" className="text-h3 text-on-primary">
          Como funciona
        </h2>
        <ol className="mt-5 flex max-w-md flex-col gap-4">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <li key={step.title} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-on-primary font-display font-bold tabular"
              >
                {index + 1}
              </span>
              <p className="text-body">
                <strong className="font-semibold">{step.title}.</strong> {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SignInContent() {
  const next = useNextPath();
  const [googlePending, setGooglePending] = useState<GooglePending | null>(null);
  // Desafio do 2FA: só em memória, nunca em armazenamento nem na URL.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);
  function startTwoFactor(token: string) {
    setExpiredNotice(null);
    setChallengeToken(token);
  }
  return (
    <RedirectIfAuthenticated>
      <div className="grid flex-1 lg:grid-cols-2">
        <BrandPanel />
        <div className="flex flex-col px-gutter pt-6 pb-10 lg:justify-center lg:py-12">
          <div className="mx-auto flex w-full max-w-md flex-col gap-8">
            {challengeToken ? (
              <TwoFactorStep
                challengeToken={challengeToken}
                onExpired={(message) => {
                  setChallengeToken(null);
                  setExpiredNotice(message);
                }}
                onCancel={() => setChallengeToken(null)}
              />
            ) : googlePending ? (
              <GoogleTermsStep pending={googlePending} onCancel={() => setGooglePending(null)} />
            ) : (
              <>
                <div>
                  <Brand href="/entrar" className="-ml-1 lg:hidden" markSize={32} />
                  <h1 className="mt-4 text-display lg:mt-0">Achou ou perdeu algo no campus?</h1>
                  <p className="mt-3 text-lead font-normal text-ink-muted">Entre para ver e registrar itens.</p>
                </div>

                <div className="flex flex-col gap-5">
                  {expiredNotice ? (
                    <Notice tone="warning" role="alert">
                      {expiredNotice}
                    </Notice>
                  ) : null}
                  <SignInForm onNeedsTwoFactor={startTwoFactor} />
                  <GoogleSignIn onPending={setGooglePending} onNeedsTwoFactor={startTwoFactor} />
                </div>
                <DemoProfiles />
              </>
            )}

            <div className="flex flex-col items-start gap-1">
              <p className="text-body text-ink-muted">
                Não tem conta?{" "}
                <Link href={withNext("/cadastro", next)} className="link touch-target inline-flex items-center font-semibold">
                  Criar conta
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </RedirectIfAuthenticated>
  );
}

/** `/entrar` (RF01, AC01.2/01.3): login por e-mail e senha ou Google, perfis de demonstração e cadastro; volta ao item de `?next=`. */
export function SignInScreen() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <SignInContent />
    </Suspense>
  );
}
