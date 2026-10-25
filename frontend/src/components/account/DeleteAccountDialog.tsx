"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { accountErrorMessage } from "@/components/auth/error-messages";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { deleteAccountSchema, type DeleteAccountValues } from "@/lib/validation";
import { isServiceError } from "@/types/domain";

const FORM_ID = "delete-account-form";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function DeleteAccountForm({ onBusyChange }: { onBusyChange(busy: boolean): void }) {
  const { user, deleteAccount } = useSession();
  const toast = useToast();
  // `hasPassword === false`: conta só-Google, confirma com um ID token novo do Google. Ausente = conta com senha.
  const googleOnly = user?.hasPassword === false;
  const [credential, setCredential] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountValues>({ resolver: zodResolver(deleteAccountSchema), defaultValues: { password: "" } });

  useEffect(() => onBusyChange(isSubmitting), [isSubmitting, onBusyChange]);

  async function onSubmit({ password }: DeleteAccountValues) {
    setFormError(null);
    if (googleOnly) {
      if (!credential) {
        setFormError("Confirme com o Google antes de excluir a conta.");
        return;
      }
    } else if (!password) {
      setError("password", { type: "required", message: "Digite sua senha para confirmar." });
      setFocus("password");
      return;
    }
    try {
      await deleteAccount(googleOnly ? { credential: credential ?? undefined } : { password });
      toast.success("Conta excluída. Seus dados pessoais foram removidos.");
      // A sessão termina e a guarda de rota leva a pessoa para fora da área logada.
    } catch (error) {
      if (isServiceError(error) && error.code === "INVALID_CREDENTIALS") {
        if (googleOnly) {
          setCredential(null);
          setFormError("Não conseguimos confirmar com o Google. Escolha a conta de novo.");
        } else {
          setError("password", { type: "server", message: error.fieldErrors?.password ?? "Senha incorreta." });
          setFocus("password");
        }
        return;
      }
      setFormError(
        isServiceError(error) && (error.code === "CONFLICT" || error.code === "FORBIDDEN")
          ? error.message
          : accountErrorMessage(error, "Não foi possível excluir a conta. Tente de novo em instantes."),
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
      {googleOnly ? (
        GOOGLE_CLIENT_ID ? (
          credential ? (
            <Notice tone="success">Conta Google confirmada. Agora é só excluir.</Notice>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-meta text-ink-muted">Sua conta entra pelo Google. Para confirmar que é você, escolha a conta de novo.</p>
              <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} onCredential={setCredential} />
            </div>
          )
        ) : (
          <Notice tone="warning">A confirmação pelo Google não está disponível neste ambiente, então não é possível excluir esta conta por aqui.</Notice>
        )
      ) : (
        <Field label="Sua senha" hint="Para confirmar que é você, digite a senha da conta." error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>
      )}
    </form>
  );
}

/** Confirmação de "Excluir minha conta" (LGPD): explica o efeito e a irreversibilidade; pede a senha só se a conta tiver. */
export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="destructive"
      busy={busy}
      title="Excluir sua conta?"
      description={
        <>
          <p>
            Seu nome e e-mail são removidos e suas reivindicações são encerradas. Os itens que você registrou
            continuam no acervo, sem o seu nome. Não é possível desfazer.
          </p>
          <p className="mt-2">Se quiser guardar uma cópia, baixe seus dados antes.</p>
        </>
      }
      actions={
        <>
          <Button variant="secondary" size="lg" width="mobile-full" disabled={busy} onClick={onClose} data-autofocus>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} variant="danger" size="lg" width="mobile-full" loading={busy} loadingText="Excluindo…">
            Excluir minha conta
          </Button>
        </>
      }
    >
      <DeleteAccountForm onBusyChange={setBusy} />
    </Dialog>
  );
}
