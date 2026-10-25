"use client";

import { Button } from "@/components/ui/Button";
import { useResendVerification } from "@/hooks/use-resend-verification";
import { cn } from "@/lib/utils";
import { SimulatedEmailBox } from "./SimulatedEmailBox";

/**
 * Botão "Reenviar e-mail de confirmação" com retorno em texto (região de status) e, no mock, o link simulado.
 * Para telas que explicam uma ação bloqueada por `EMAIL_NOT_VERIFIED` ou um link vencido.
 */
export function ResendVerification({
  label = "Reenviar e-mail de confirmação",
  initialDevLink = null,
  className,
}: {
  label?: string;
  /** Link simulado já conhecido (ex.: o pendente do cadastro). */
  initialDevLink?: string | null;
  className?: string;
}) {
  const { resend, sending, message, failed, devLink } = useResendVerification();
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Button variant="secondary" size="lg" width="mobile-full" loading={sending} loadingText="Reenviando…" onClick={() => void resend()}>
        {label}
      </Button>
      <p role="status" className={cn("text-meta empty:hidden", failed ? "text-danger-fg" : "text-ink")}>
        {message}
      </p>
      <SimulatedEmailBox devLink={devLink ?? initialDevLink} action="Abrir link de confirmação" className="text-left" />
    </div>
  );
}
