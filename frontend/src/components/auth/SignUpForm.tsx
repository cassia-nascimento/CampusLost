"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { RadioCard, RadioGroup } from "@/components/ui/RadioCard";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { signUpSchema, type SignUpValues } from "@/lib/validation";
import { ROLE_LABEL, SIGNUP_ROLES, isServiceError } from "@/types/domain";

const EMAIL_TAKEN = "Esse e-mail já tem cadastro. Entre com ele.";

/** Cadastro de aluno ou professor (RF01 / AC01.1). Sem senha no protótipo. */
export function SignUpForm() {
  const { signUp } = useSession();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "" },
  });

  async function onSubmit(values: SignUpValues) {
    setFormError(null);
    setAnnouncement("");
    try {
      await signUp(values);
      toast.success("Conta criada. Você já entrou no CampusLost.");
    } catch (error) {
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
      setFormError("Não foi possível criar a conta. Tente de novo em instantes. Suas respostas foram mantidas.");
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
        <RadioGroup
          legend="Você é"
          hint="O papel é informado por você no cadastro e não é verificado."
          error={errors.role?.message}
        >
          {SIGNUP_ROLES.map((role) => (
            <RadioCard key={role} label={ROLE_LABEL[role]} value={role} {...register("role")} />
          ))}
        </RadioGroup>
        <p className="text-meta text-ink-muted">Não pedimos senha nesta demonstração.</p>
        <p className="text-body text-ink-muted">
          Já tem conta?{" "}
          <Link href="/entrar" className="link touch-target inline-flex items-center font-semibold">
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
