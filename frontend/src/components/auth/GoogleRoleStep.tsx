"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { RadioCard, RadioGroup } from "@/components/ui/RadioCard";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { googleRoleSchema, type GoogleRoleValues } from "@/lib/validation";
import type { GoogleRolePending } from "./GoogleSignIn";
import { ROLE_LABEL, SIGNUP_ROLES, isServiceError } from "@/types/domain";

/** Segundo passo do primeiro acesso com Google: a pessoa informa se é aluno ou professor (P30). */
export function GoogleRoleStep({ pending, onCancel }: { pending: GoogleRolePending; onCancel(): void }) {
  const { completeGoogleSignUp } = useSession();
  const { profile, ticket } = pending;
  const toast = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GoogleRoleValues>({ resolver: zodResolver(googleRoleSchema), mode: "onTouched" });

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function onSubmit({ role }: GoogleRoleValues) {
    setFormError(null);
    try {
      await completeGoogleSignUp({ ticket, role });
      toast.success("Conta criada. Você já entrou no CampusLost.");
    } catch (error) {
      if (isServiceError(error) && error.code === "EMAIL_TAKEN") {
        setFormError("Esse e-mail já tem cadastro. Entre com ele.");
      } else if (isServiceError(error) && error.code === "FORBIDDEN_DOMAIN") {
        setFormError("Use o e-mail institucional da UNDB.");
      } else if (isServiceError(error) && error.code === "UNAUTHENTICATED") {
        setFormError("Sua verificação do Google expirou. Cancele e entre com o Google novamente.");
      } else {
        setFormError("Não foi possível concluir o cadastro. Tente de novo em instantes.");
      }
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-display outline-none">
          Quase lá: você é aluno ou professor?
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
      <RadioGroup
        legend="Você é"
        hint="O papel é informado por você e não é verificado."
        error={errors.role?.message}
      >
        {SIGNUP_ROLES.map((role) => (
          <RadioCard key={role} label={ROLE_LABEL[role]} value={role} {...register("role")} />
        ))}
      </RadioGroup>
      <Button type="submit" size="lg" width="full" loading={isSubmitting} loadingText="Continuando…">
        Continuar
      </Button>
      <Button variant="ghost" size="lg" width="full" disabled={isSubmitting} onClick={onCancel}>
        Cancelar
      </Button>
    </form>
  );
}
