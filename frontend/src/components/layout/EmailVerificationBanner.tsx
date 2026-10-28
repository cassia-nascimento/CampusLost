"use client";

import { MailWarning } from "lucide-react";
import { SimulatedEmailBox } from "@/components/auth/SimulatedEmailBox";
import { Button } from "@/components/ui/Button";
import { useResendVerification } from "@/hooks/use-resend-verification";
import { useSession } from "@/hooks/use-session";
import { checkEmailVerified } from "@/lib/rules";
import { cn } from "@/lib/utils";

/**
 * Faixa global do app autenticado enquanto o e-mail não está confirmado: explica o que fica bloqueado
 * (cadastrar item e reivindicar) e deixa reenviar o link. A decisão vem de `checkEmailVerified` (lib/rules).
 * A região de status existe só com a faixa visível; o texto de retorno é anunciado quando muda.
 */
export function EmailVerificationBanner() {
  const { user } = useSession();
  const { resend, sending, message, failed, devLink, widget, blocked } = useResendVerification();
  if (!user || checkEmailVerified(user).allowed) return null;

  return (
    <aside aria-label="Confirmação de e-mail" className="border-b border-warning-border bg-warning-bg">
      <div className="mx-auto flex max-w-admin flex-col gap-3 px-gutter py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-meta text-ink sm:text-body">
            <MailWarning aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-fg" />
            <span>
              <strong className="font-semibold">Confirme seu e-mail para cadastrar itens e reivindicar.</strong> Enviamos
              um link para <span className="user-text font-semibold">{user.email}</span>.
            </span>
          </p>
          <Button variant="secondary" width="mobile-full" disabled={blocked} loading={sending} loadingText="Reenviando…" onClick={() => void resend()}>
            Reenviar e-mail
          </Button>
        </div>
        {widget}
        <p role="status" className={cn("text-meta empty:hidden", failed ? "text-danger-fg" : "text-ink")}>
          {message}
        </p>
        <SimulatedEmailBox devLink={devLink} action="Abrir link de confirmação" className="bg-surface" />
      </div>
    </aside>
  );
}
