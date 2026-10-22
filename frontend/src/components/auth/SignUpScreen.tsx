"use client";

import { Suspense } from "react";
import { Brand } from "@/components/layout/Brand";
import { AuthLoading, RedirectIfAuthenticated } from "./RedirectIfAuthenticated";
import { SignUpForm } from "./SignUpForm";

function SignUpContent() {
  return (
    <RedirectIfAuthenticated>
      <div className="mx-auto flex w-full max-w-form flex-1 flex-col px-gutter pt-6 pb-10 md:py-12">
        <div className="flex flex-1 flex-col md:flex-none md:rounded-xl md:bg-surface md:p-8 md:shadow-card">
          <Brand href="/entrar" className="-ml-1 self-start" markSize={32} />
          <h1 className="mt-4 text-display">Criar conta</h1>
          <p className="mt-3 mb-6 text-lead font-normal text-ink-muted">Todos os campos são obrigatórios.</p>
          <SignUpForm />
        </div>
      </div>
    </RedirectIfAuthenticated>
  );
}

/** `/cadastro` (RF01 / AC01.1): no celular ocupa a tela; a partir de `md` vira um cartão centralizado. */
export function SignUpScreen() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <SignUpContent />
    </Suspense>
  );
}
