"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { accountErrorMessage } from "@/components/auth/error-messages";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useSession } from "@/hooks/use-session";
import { disableTwoFactorSchema, type DisableTwoFactorValues } from "@/lib/validation";
import { services } from "@/services";
import { isServiceError } from "@/types/domain";

const FORM_ID = "disable-two-factor-form";

function DisableForm({ onBusyChange, onDone }: { onBusyChange(busy: boolean): void; onDone(): void }) {
  const { user } = useSession();
  // `hasPassword === false`: conta só-Google, sem senha para confirmar. Ausente = conta com senha.
  const needsPassword = user?.hasPassword !== false;
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DisableTwoFactorValues>({
    resolver: zodResolver(disableTwoFactorSchema),
    defaultValues: { password: "", code: "" },
  });

  useEffect(() => onBusyChange(isSubmitting), [isSubmitting, onBusyChange]);

  async function onSubmit({ password, code }: DisableTwoFactorValues) {
    setFormError(null);
    if (needsPassword && !password) {
      setError("password", { type: "required", message: "Digite sua senha para confirmar." });
      setFocus("password");
      return;
    }
    try {
      await services.auth.disableTwoFactor({ password: needsPassword ? password : undefined, code: code.trim() });
      onDone();
    } catch (error) {
      if (isServiceError(error) && (error.code === "INVALID_CREDENTIALS" || error.code === "VALIDATION")) {
        const passwordMessage = error.fieldErrors?.password;
        const codeMessage = error.fieldErrors?.code;
        if (passwordMessage) setError("password", { type: "server", message: passwordMessage });
        if (codeMessage) setError("code", { type: "server", message: codeMessage });
        if (passwordMessage || codeMessage) {
          setFocus(passwordMessage ? "password" : "code");
          return;
        }
        if (error.code === "INVALID_CREDENTIALS") {
          setFormError("Senha ou código incorretos. A verificação em duas etapas continua ligada.");
          return;
        }
      }
      setFormError(
        isServiceError(error) && (error.code === "CONFLICT" || error.code === "RATE_LIMITED" || error.code === "NETWORK")
          ? error.message
          : accountErrorMessage(error, "Não foi possível desligar agora. Tente de novo em instantes."),
      );
    }
  }

  return (
    <form id={FORM_ID} noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {formError ? (
        <Notice tone="danger" role="alert">
          {formError}
        </Notice>
      ) : null}
      {needsPassword ? (
        <Field label="Sua senha" error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>
      ) : null}
      <Field
        label="Código do aplicativo ou de recuperação"
        hint="Digite o código atual de 6 dígitos ou um código de recuperação que você ainda não usou."
        error={errors.code?.message}
      >
        <Input autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} maxLength={16} {...register("code")} />
      </Field>
    </form>
  );
}

/** Confirmação para desligar a verificação em duas etapas: senha (se a conta tem) e um código. */
export function DisableTwoFactorDialog({ open, onClose, onDisabled }: { open: boolean; onClose(): void; onDisabled(): void }) {
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="destructive"
      busy={busy}
      title="Desligar a verificação em duas etapas?"
      description={
        <>
          <p>Sua conta volta a pedir só a senha para entrar, o que a deixa menos protegida.</p>
          {user?.role === "admin" ? (
            <p className="mt-2">
              Como administração, você perde o acesso a usuários, convites e auditoria até ligar de novo.
            </p>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="secondary" size="lg" width="mobile-full" disabled={busy} onClick={onClose} data-autofocus>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} variant="danger" size="lg" width="mobile-full" loading={busy} loadingText="Desligando…">
            Desligar
          </Button>
        </>
      }
    >
      <DisableForm onBusyChange={setBusy} onDone={onDisabled} />
    </Dialog>
  );
}
