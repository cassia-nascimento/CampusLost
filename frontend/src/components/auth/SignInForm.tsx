"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useSession } from "@/hooks/use-session";
import { signInSchema, type SignInValues } from "@/lib/validation";
import { isServiceError } from "@/types/domain";

const EMAIL_NOT_FOUND = "Não encontramos esse e-mail. Confira a digitação ou crie uma conta.";

/** Login por e-mail (AC01.2). Não há senha no protótipo. O redirecionamento é feito por `RedirectIfAuthenticated`. */
export function SignInForm() {
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    setAnnouncement("");
    try {
      await signIn(values);
    } catch (error) {
      if (isServiceError(error) && error.code === "USER_NOT_FOUND") {
        setError("email", { type: "server", message: EMAIL_NOT_FOUND });
        setFocus("email");
        return;
      }
      if (isServiceError(error) && error.code === "VALIDATION" && error.fieldErrors?.email) {
        setError("email", { type: "server", message: error.fieldErrors.email });
        setFocus("email");
        return;
      }
      setFormError("Não foi possível entrar. Tente de novo em instantes.");
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, () => setAnnouncement("Corrija o e-mail para continuar."))}
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
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <Button type="submit" size="lg" width="full" loading={isSubmitting} loadingText="Entrando…">
        Entrar
      </Button>
    </form>
  );
}
