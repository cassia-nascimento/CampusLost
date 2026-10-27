"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { useTurnstile } from "@/hooks/use-turnstile";
import { signUpSchema, type SignUpValues } from "@/lib/validation";
import { isServiceError } from "@/types/domain";
import { accountErrorMessage } from "./error-messages";
import { PASSWORD_HINT } from "./password-strength";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

const EMAIL_TAKEN = "Esse e-mail já tem cadastro. Entre com ele.";

/**
 * Cadastro com senha (RF01 / AC01.1) com nome, e-mail, senha e aceite dos termos.
 * Sem confirmação de e-mail: a conta nasce com sessão e `RedirectIfAuthenticated` leva a pessoa adiante.
 */
export function SignUpForm() {
  const { signUp } = useSession();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const turnstile = useTurnstile();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", password: "" },
  });
  const password = useWatch({ control, name: "password" }) ?? "";

  async function onSubmit(values: SignUpValues) {
    setFormError(null);
    setAnnouncement("");
    try {
      await signUp({ ...values, turnstileToken: turnstile.token });
      toast.success("Conta criada. Você já pode usar o CampusLost.");
    } catch (error) {
      turnstile.reset();
      if (isServiceError(error) && error.code === "EMAIL_TAKEN") {
        setError("email", { type: "server", message: EMAIL_TAKEN });
        setFocus("email");
        return;
      }
      if (isServiceError(error) && error.code === "VALIDATION" && error.fieldErrors) {
        const entries = Object.entries(error.fieldErrors).filter(([field]) => field in values);
        if (entries.length > 0) {
          for (const [field, message] of entries) {
            setError(field as keyof SignUpValues, { type: "server", message });
          }
          return;
        }
      }
      setFormError(
        accountErrorMessage(error, "Não foi possível criar a conta. Tente de novo em instantes. Suas respostas foram mantidas."),
      );
    }
  }

  function onInvalid(fieldErrors: Record<string, unknown>) {
    const count = Object.keys(fieldErrors).length;
    setAnnouncement(`Corrija ${count} ${count === 1 ? "campo" : "campos"} para continuar.`);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-5">
        {formError ? (
          <Notice tone="danger" role="alert">
            {formError}
          </Notice>
        ) : null}
        <Field label="Nome completo" error={errors.name?.message}>
          <Input autoComplete="name" placeholder="Maria Exemplo" {...register("name")} />
        </Field>
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
          <Field label="Senha" hint={PASSWORD_HINT} error={errors.password?.message}>
            <PasswordInput autoComplete="new-password" {...register("password")} />
          </Field>
          <PasswordStrengthMeter password={password} className="mt-3" />
        </div>
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
        {turnstile.widget}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      <Button type="submit" size="lg" width="full" disabled={turnstile.blocked} loading={isSubmitting} loadingText="Criando conta…">
        Criar conta
      </Button>
    </form>
  );
}
