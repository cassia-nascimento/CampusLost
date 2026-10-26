"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Notice } from "@/components/ui/Notice";
import { RadioCard, RadioGroup } from "@/components/ui/RadioCard";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { googleRoleSchema } from "@/lib/validation";
import { GOOGLE_SIGNUP_ROLES, ROLE_LABEL, isServiceError, type GoogleSignupRole } from "@/types/domain";
import { accountErrorMessage } from "./error-messages";
import type { GooglePending } from "./GoogleSignIn";

const acceptedTerms = z.literal(true, { error: "Aceite os termos de uso para criar a conta." });
/** Domínio institucional: papel + termos. Fora dele: só os termos (a conta vira comunidade externa). */
const ROLE_AND_TERMS = googleRoleSchema.extend({ acceptedTerms });
const TERMS_ONLY = z.object({ acceptedTerms });

interface StepValues {
  role?: GoogleSignupRole;
  acceptedTerms: boolean;
}

/**
 * Segundo passo do primeiro acesso com Google (P30). E-mail institucional (`needs_role`): escolhe aluno ou
 * professor e aceita os termos. Outro domínio (`needs_terms`): só aceita os termos e entra como comunidade externa.
 */
export function GoogleRoleStep({ pending, onCancel }: { pending: GooglePending; onCancel(): void }) {
  const { completeGoogleSignUp } = useSession();
  const { profile, ticket } = pending;
  const needsRole = pending.status === "needs_role";
  const toast = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StepValues>({
    resolver: zodResolver(needsRole ? ROLE_AND_TERMS : TERMS_ONLY) as never,
    mode: "onTouched",
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function onSubmit({ role }: StepValues) {
    setFormError(null);
    try {
      await completeGoogleSignUp({ ticket, role: needsRole ? role : undefined, acceptedTerms: true });
      toast.success("Conta criada. Você já entrou no CampusLost.");
    } catch (error) {
      if (isServiceError(error) && error.code === "VALIDATION" && error.fieldErrors) {
        const { role: roleError, acceptedTerms: termsError } = error.fieldErrors;
        if (roleError) setError("role", { type: "server", message: roleError });
        if (termsError) setError("acceptedTerms", { type: "server", message: termsError });
        if (roleError || termsError) return;
      }
      if (isServiceError(error) && error.code === "EMAIL_TAKEN") {
        setFormError("Esse e-mail já tem cadastro. Entre com ele.");
      } else if (isServiceError(error) && error.code === "FORBIDDEN_DOMAIN") {
        setFormError("Só e-mails institucionais da UNDB escolhem aluno ou professor. Cancele e entre com o Google de novo.");
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
          {needsRole ? "Quase lá: você é aluno ou professor?" : "Quase lá: aceite os termos"}
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
      {needsRole ? (
        <RadioGroup
          legend="Você é"
          hint="Seu e-mail é institucional. O papel é informado por você e não é verificado."
          error={errors.role?.message}
        >
          {GOOGLE_SIGNUP_ROLES.map((role) => (
            <RadioCard key={role} label={ROLE_LABEL[role]} value={role} {...register("role")} />
          ))}
        </RadioGroup>
      ) : (
        <Notice tone="info">Esse e-mail não é institucional: você vai entrar como {ROLE_LABEL.external}.</Notice>
      )}
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
