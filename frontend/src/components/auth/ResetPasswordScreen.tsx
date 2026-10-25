"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, MailX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/use-toast";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation";
import { services } from "@/services";
import { isServiceError } from "@/types/domain";
import { AuthCard } from "./AuthCard";
import { accountErrorMessage } from "./error-messages";
import { PASSWORD_HINT } from "./password-strength";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { classifyTokenFailure } from "./token-failure";

function InvalidLink() {
  return (
    <AuthCard title="Link inválido ou expirado">
      <EmptyState
        variant="restricted"
        icon={MailX}
        title="Este link não funciona"
        action={
          <LinkButton href="/esqueci-senha" size="lg">
            Pedir novo link
          </LinkButton>
        }
      >
        Ele pode estar incompleto, expirado ou já ter sido usado. Peça um novo link.
      </EmptyState>
    </AuthCard>
  );
}

function ResetPasswordContent() {
  const token = useSearchParams().get("token") ?? "";
  const toast = useToast();
  const [done, setDone] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { token, password: "" },
  });
  const password = useWatch({ control, name: "password" }) ?? "";

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);
    setAnnouncement("");
    try {
      await services.auth.resetPassword(values.token, values.password);
      toast.success("Senha alterada. Entre com a nova senha.");
      setDone(true);
    } catch (error) {
      if (classifyTokenFailure(error) === "invalid") {
        setInvalidLink(true);
        return;
      }
      const message = isServiceError(error) ? error.fieldErrors?.password : undefined;
      if (message) {
        setError("password", { type: "server", message });
        setFocus("password");
        return;
      }
      setFormError(accountErrorMessage(error, "Não foi possível alterar a senha. Tente de novo em instantes."));
    }
  }

  if (!token || invalidLink) return <InvalidLink />;

  if (done) {
    return (
      <AuthCard title="Senha alterada">
        <EmptyState
          icon={CircleCheck}
          title="Tudo certo"
          action={
            <LinkButton href="/entrar" size="lg">
              Entrar
            </LinkButton>
          }
        >
          Sua nova senha já vale. Use-a para entrar.
        </EmptyState>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Criar nova senha" description="Escolha uma senha nova para a sua conta.">
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit, () => setAnnouncement("Corrija o campo para continuar."))}
        className="flex flex-col gap-5"
      >
        {formError ? (
          <Notice tone="danger" role="alert">
            {formError}
          </Notice>
        ) : null}
        <div>
          <Field label="Nova senha" hint={PASSWORD_HINT} error={errors.password?.message}>
            <PasswordInput autoComplete="new-password" {...register("password")} />
          </Field>
          <PasswordStrengthMeter password={password} className="mt-3" />
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        <Button type="submit" size="lg" width="full" loading={isSubmitting} loadingText="Salvando…">
          Salvar nova senha
        </Button>
      </form>
    </AuthCard>
  );
}

/** `/redefinir-senha?token=` (RF01): define a nova senha com o link recebido. */
export function ResetPasswordScreen() {
  return (
    <Suspense
      fallback={
        <LoadingRegion label="Carregando…" className="mx-auto w-full max-w-form flex-1 px-gutter pt-8">
          <Skeleton className="h-10 w-2/3" />
        </LoadingRegion>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
