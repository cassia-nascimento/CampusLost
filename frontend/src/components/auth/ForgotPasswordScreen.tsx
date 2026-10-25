"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation";
import { isServiceError } from "@/types/domain";
import { services } from "@/services";
import { AuthCard } from "./AuthCard";
import { accountErrorMessage } from "./error-messages";
import { SimulatedEmailBox } from "./SimulatedEmailBox";

/** Mensagem única: não revela se o e-mail tem conta (mesmo cuidado do login). */
export const FORGOT_PASSWORD_SENT =
  "Se esse e-mail tiver cadastro com senha, enviamos um link para criar uma nova senha. O link vale por tempo limitado. Veja também a caixa de spam.";

/** `/esqueci-senha`: pede o link de redefinição. A resposta é sempre a mesma, exista a conta ou não. */
export function ForgotPasswordScreen() {
  const [sent, setSent] = useState<{ email: string; devLink: string | null } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: ForgotPasswordValues) {
    setFormError(null);
    try {
      const dispatch = await services.auth.forgotPassword(email);
      setSent({ email, devLink: dispatch.devLink ?? null });
    } catch (error) {
      const message = isServiceError(error) && error.code === "VALIDATION" ? error.fieldErrors?.email : undefined;
      if (message) {
        setError("email", { type: "server", message });
        setFocus("email");
        return;
      }
      setFormError(accountErrorMessage(error, "Não foi possível enviar agora. Tente de novo em instantes."));
    }
  }

  if (sent) {
    return (
      <AuthCard title="Veja seu e-mail">
        <div className="flex flex-col gap-5">
          <Notice tone="success" icon={MailCheck}>
            {FORGOT_PASSWORD_SENT}
          </Notice>
          <SimulatedEmailBox devLink={sent.devLink} action="Abrir link para criar nova senha" />
          <LinkButton href="/entrar" size="lg" width="mobile-full">
            Voltar para entrar
          </LinkButton>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Esqueci minha senha" description="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {formError ? (
          <Notice tone="danger" role="alert">
            {formError}
          </Notice>
        ) : null}
        <Field label="E-mail" error={errors.email?.message}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nome@exemplo.com"
            {...register("email")}
          />
        </Field>
        <Button type="submit" size="lg" width="full" loading={isSubmitting} loadingText="Enviando…">
          Enviar link
        </Button>
        <p className="text-body text-ink-muted">
          Lembrou a senha?{" "}
          <Link href="/entrar" className="link touch-target inline-flex items-center font-semibold">
            Entrar
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
