"use client";

import { Suspense, useState } from "react";
import type { User } from "@/types/domain";
import { AuthCard } from "./AuthCard";
import { CheckEmailPanel } from "./CheckEmailPanel";
import { AuthLoading, RedirectIfAuthenticated } from "./RedirectIfAuthenticated";
import { SignUpForm } from "./SignUpForm";

function SignUpContent() {
  // `creating`/`created` seguram o redirecionamento: a conta nova já tem sessão, mas antes de seguir
  // a pessoa precisa ver "Confirme seu e-mail".
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<User | null>(null);
  return (
    <RedirectIfAuthenticated hold={creating || created !== null}>
      {created ? (
        <CheckEmailPanel email={created.email} role={created.role} />
      ) : (
        <AuthCard title="Criar conta" description="Todos os campos são obrigatórios.">
          <SignUpForm onCreatingChange={setCreating} onCreated={setCreated} />
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
