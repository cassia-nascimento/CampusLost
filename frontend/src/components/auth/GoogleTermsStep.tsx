"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Notice } from "@/components/ui/Notice";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { isServiceError } from "@/types/domain";
import { accountErrorMessage } from "./error-messages";
import type { GooglePending } from "./GoogleSignIn";

const termsSchema = z.object({
  acceptedTerms: z.literal(true, { error: "Aceite os termos de uso para criar a conta." }),
});
type StepValues = z.input<typeof termsSchema>;

/**
 * Segundo passo do primeiro acesso com Google (P30): conta nova de qualquer domínio só precisa aceitar os termos.
 * O vínculo (e-mail institucional ou externo) sai do domínio do e-mail e não é perguntado.
 */
export function GoogleTermsStep({ pending, onCancel }: { pending: GooglePending; onCancel(): void }) {
  const { completeGoogleSignUp } = useSession();
  const { profile, ticket } = pending;
  const toast = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StepValues>({
    resolver: zodResolver(termsSchema),
    mode: "onTouched",
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function onSubmit() {
    setFormError(null);
    try {
      await completeGoogleSignUp({ ticket, acceptedTerms: true });
      toast.success("Conta criada. Você já entrou no CampusLost.");
    } catch (error) {
      if (isServiceError(error) && error.code === "VALIDATION" && error.fieldErrors?.acceptedTerms) {
        setError("acceptedTerms", { type: "server", message: error.fieldErrors.acceptedTerms });
        return;
      }
      if (isServiceError(error) && error.code === "EMAIL_TAKEN") {
        setFormError("Esse e-mail já tem cadastro. Entre com ele.");
      } else if (isServiceError(error) && error.code === "UNAUTHENTICATED") {
        setFormError("Sua verificação do Google expirou. Cancele e entre com o Google novamente.");
      } else {
        setFormError(accountErrorMessage(error, "Não foi possível concluir o cadastro. Tente de novo em instantes."));
      }
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-display outline-none">
          Quase lá: aceite os termos
        </h1>
        <p className="user-text mt-3 text-lead font-normal text-ink-muted">
          Conta Google: <strong className="font-semibold text-ink">{profile.email}</strong>
        </p>
      </div>
      {formError ? (
        <Notice tone="danger" role="alert">
          {formError}
        </Notice>
      ) : null}
      <Checkbox
        error={errors.acceptedTerms?.message}
        label={
          <>
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" rel="noopener" className="link font-semibold">
              Termos de uso<span className="sr-only"> (abre em nova aba)</span>
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" rel="noopener" className="link font-semibold">
              Política de privacidade<span className="sr-only"> (abre em nova aba)</span>
            </Link>
            .
          </>
        }
        {...register("acceptedTerms")}
      />
      <Button type="submit" size="lg" width="full" loading={isSubmitting} loadingText="Continuando…">
        Continuar
      </Button>
      <Button variant="ghost" size="lg" width="full" disabled={isSubmitting} onClick={onCancel}>
        Cancelar
      </Button>
    </form>
  );
}
