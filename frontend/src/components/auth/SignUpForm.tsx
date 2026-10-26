"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { RadioCard, RadioGroup } from "@/components/ui/RadioCard";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { signUpSchema, type SignUpValues } from "@/lib/validation";
import { ROLE_LABEL, SIGNUP_ROLES, isServiceError, type User } from "@/types/domain";
import { accountErrorMessage } from "./error-messages";
import { PASSWORD_HINT } from "./password-strength";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { withNext } from "./next-param";
import { useNextPath } from "./use-next-path";

const EMAIL_TAKEN = "Esse e-mail já tem cadastro. Entre com ele.";

/**
 * Cadastro com senha (RF01 / AC01.1) de aluno, professor ou comunidade externa, com aceite dos termos.
 * `onCreatingChange` avisa a tela quando o envio começa/termina (segura o redirecionamento da sessão nova)
 * e `onCreated` entrega a conta criada, para a tela mostrar "Confirme seu e-mail".
 */
export function SignUpForm({
  onCreatingChange,
  onCreated,
}: {
  onCreatingChange(creating: boolean): void;
  onCreated(user: User): void;
}) {
  const { signUp } = useSession();
  const toast = useToast();
  const next = useNextPath();
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
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
    onCreatingChange(true);
    try {
      const user = await signUp(values);
      toast.success("Conta criada. Falta confirmar seu e-mail.");
      onCreated(user);
    } catch (error) {
      onCreatingChange(false);
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
    <form noValidate onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-5">
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
        <RadioGroup
          legend="Você é"
          hint="O papel é informado por você no cadastro e não é verificado."
          error={errors.role?.message}
        >
          {SIGNUP_ROLES.map((role) => (
            <RadioCard key={role} label={ROLE_LABEL[role]} value={role} {...register("role")} />
          ))}
        </RadioGroup>
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
        <p className="text-body text-ink-muted">
          Já tem conta?{" "}
          <Link href={withNext("/entrar", next)} className="link touch-target inline-flex items-center font-semibold">
            Entrar
          </Link>
        </p>
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </div>
      <ActionBar>
        <Button type="submit" size="lg" width="mobile-full" loading={isSubmitting} loadingText="Criando conta…">
          Criar conta
        </Button>
      </ActionBar>
    </form>
  );
}
