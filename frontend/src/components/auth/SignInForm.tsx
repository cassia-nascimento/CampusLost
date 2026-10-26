"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { accountErrorMessage } from "./error-messages";
import { PasswordInput } from "./PasswordInput";
import { useSession } from "@/hooks/use-session";
import { useTurnstile } from "@/hooks/use-turnstile";
import { signInSchema, type SignInValues } from "@/lib/validation";
import { isServiceError } from "@/types/domain";

const INVALID_CREDENTIALS = "E-mail ou senha incorretos.";

/**
 * Login por e-mail e senha (AC01.2). O redirecionamento é feito por `RedirectIfAuthenticated`.
 * Conta com 2FA: `onNeedsTwoFactor` recebe o desafio e a tela pede o código.
 */
export function SignInForm({ onNeedsTwoFactor }: { onNeedsTwoFactor(challengeToken: string): void }) {
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const turnstile = useTurnstile();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    setAnnouncement("");
    try {
      const result = await signIn({ ...values, turnstileToken: turnstile.token });
      if (result.status === "needs_2fa") onNeedsTwoFactor(result.challengeToken);
    } catch (error) {
      turnstile.reset();
      if (isServiceError(error) && error.code === "INVALID_CREDENTIALS") {
        // Erro geral, sem apontar qual campo errou (AC01.2).
        setFormError(INVALID_CREDENTIALS);
        setFocus("email");
        return;
      }
      if (isServiceError(error) && (error.code === "ACCOUNT_DISABLED" || error.code === "RATE_LIMITED" || error.code === "NETWORK")) {
        setFormError(error.message);
        return;
      }
      if (isServiceError(error) && error.code === "VALIDATION" && error.fieldErrors) {
        const { email, password } = error.fieldErrors;
        if (email) setError("email", { type: "server", message: email });
        if (password) setError("password", { type: "server", message: password });
        if (email || password) {
          setFocus(email ? "email" : "password");
          return;
        }
      }
      setFormError(accountErrorMessage(error, "Não foi possível entrar. Tente de novo em instantes."));
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, () => setAnnouncement("Corrija os campos para continuar."))}
      className="flex flex-col gap-5"
    >
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
      <div>
        <Field label="Senha" error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>
        <Link href="/esqueci-senha" className="link touch-target mt-1 inline-flex items-center text-meta font-semibold">
          Esqueci minha senha
        </Link>
      </div>
      {turnstile.widget}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <Button type="submit" size="lg" width="full" disabled={turnstile.blocked} loading={isSubmitting} loadingText="Entrando…">
        Entrar
      </Button>
    </form>
  );
}
