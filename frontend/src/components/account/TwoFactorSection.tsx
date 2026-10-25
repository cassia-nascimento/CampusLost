"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Download, ExternalLink, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { accountErrorMessage } from "@/components/auth/error-messages";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { toLocalDateString } from "@/lib/rules";
import { enableTwoFactorSchema, type EnableTwoFactorValues } from "@/lib/validation";
import { services } from "@/services";
import type { TwoFactorSetup } from "@/types/admin";
import { isServiceError, type User } from "@/types/domain";
import { DisableTwoFactorDialog } from "./DisableTwoFactorDialog";
import { effectiveTwoFactor, formatSecret, recoveryCodesFileName, serializeRecoveryCodes } from "./two-factor";

/** `idle`: sem fluxo · `starting`/`setup`: ligando · `codes`: códigos de recuperação (só desta vez). */
type Phase =
  | { name: "idle" }
  | { name: "starting" }
  | { name: "setup"; setup: TwoFactorSetup }
  | { name: "codes"; codes: string[] };

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** `/conta`: ligar, confirmar e desligar a verificação em duas etapas (TOTP). Sem QR: segredo para digitar + link otpauth. */
export function TwoFactorSection({ user }: { user: User }) {
  const { refreshUser } = useSession();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [override, setOverride] = useState<boolean | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);
  const enabled = effectiveTwoFactor(user.twoFactorEnabled, override);

  async function start() {
    setStartError(null);
    setPhase({ name: "starting" });
    try {
      setPhase({ name: "setup", setup: await services.auth.setupTwoFactor() });
    } catch (error) {
      setPhase({ name: "idle" });
      if (isServiceError(error) && error.code === "CONFLICT") {
        setOverride(true);
        await refreshUser();
      }
      setStartError(
        isServiceError(error) && (error.code === "CONFLICT" || error.code === "RATE_LIMITED" || error.code === "NETWORK")
          ? error.message
          : accountErrorMessage(error, "Não foi possível iniciar agora. Tente de novo em instantes."),
      );
    }
  }

  async function handleEnabled(codes: string[]) {
    setOverride(true);
    setPhase({ name: "codes", codes });
    await refreshUser();
  }

  return (
    <section aria-labelledby="account-2fa" className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
      <h2 id="account-2fa" className="text-h3">
        Verificação em duas etapas
      </h2>

      {phase.name === "codes" ? (
        <RecoveryCodes
          codes={phase.codes}
          email={user.email}
          onDone={() => {
            setPhase({ name: "idle" });
            toast.success("Verificação em duas etapas ligada.");
          }}
        />
      ) : phase.name === "setup" ? (
        <SetupSteps
          setup={phase.setup}
          onCancel={() => setPhase({ name: "idle" })}
          onEnabled={handleEnabled}
          onRestart={() => {
            setPhase({ name: "idle" });
            setStartError("A ativação foi reiniciada. Comece de novo para gerar um segredo novo.");
          }}
        />
      ) : (
        <>
          <p className="flex items-center gap-2 text-body font-semibold">
            {enabled ? (
              <ShieldCheck aria-hidden="true" className="size-5 text-success-fg" />
            ) : (
              <ShieldOff aria-hidden="true" className="size-5 text-ink-muted" />
            )}
            {enabled ? "Ligada" : "Desligada"}
          </p>
          <p className="text-body text-ink-muted">
            {enabled
              ? "Ao entrar, além da senha, você digita um código de 6 dígitos do aplicativo autenticador."
              : "Além da senha, você passa a digitar um código de 6 dígitos de um aplicativo autenticador. Protege a conta se a senha vazar."}
          </p>
          {startError ? (
            <Notice tone="danger" role="alert">
              {startError}
            </Notice>
          ) : null}
          <div>
            {enabled ? (
              <Button variant="danger-quiet" size="lg" width="mobile-full" icon={ShieldOff} onClick={() => setDisabling(true)}>
                Desligar verificação
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                width="mobile-full"
                icon={ShieldCheck}
                loading={phase.name === "starting"}
                loadingText="Preparando…"
                onClick={() => void start()}
              >
                Ativar verificação em duas etapas
              </Button>
            )}
          </div>
        </>
      )}

      <DisableTwoFactorDialog
        open={disabling}
        onClose={() => setDisabling(false)}
        onDisabled={() => {
          setDisabling(false);
          setOverride(false);
          toast.success("Verificação em duas etapas desligada.");
          void refreshUser();
        }}
      />
    </section>
  );
}

function SetupSteps({
  setup,
  onCancel,
  onEnabled,
  onRestart,
}: {
  setup: TwoFactorSetup;
  onCancel(): void;
  onEnabled(codes: string[]): void | Promise<void>;
  onRestart(): void;
}) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<EnableTwoFactorValues>({
    resolver: zodResolver(enableTwoFactorSchema),
    mode: "onTouched",
    defaultValues: { code: "" },
  });

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(setup.secret);
      toast.success("Segredo copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o segredo e copie manualmente.");
    }
  }

  async function onSubmit({ code }: EnableTwoFactorValues) {
    setFormError(null);
    try {
      const { recoveryCodes } = await services.auth.enableTwoFactor(code);
      await onEnabled(recoveryCodes);
    } catch (error) {
      if (isServiceError(error) && error.code === "CONFLICT") return onRestart();
      const message = isServiceError(error) ? error.fieldErrors?.code : undefined;
      if (message || (isServiceError(error) && (error.code === "VALIDATION" || error.code === "INVALID_CREDENTIALS"))) {
        setError("code", { type: "server", message: message ?? "Código incorreto. Confira o código atual no aplicativo e tente de novo." });
        setFocus("code");
        return;
      }
      setFormError(
        isServiceError(error) && (error.code === "RATE_LIMITED" || error.code === "NETWORK")
          ? error.message
          : accountErrorMessage(error, "Não foi possível confirmar o código. Tente de novo em instantes."),
      );
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <ol className="flex list-decimal flex-col gap-4 pl-5 text-body marker:font-semibold">
        <li className="pl-1">
          <p>Abra um aplicativo autenticador (como Google Authenticator, Authy ou 1Password) e adicione uma conta digitando este segredo:</p>
          <p
            className="user-text tabular mt-2 rounded-md bg-sunken px-3 py-2.5 font-mono text-lead font-semibold tracking-wide break-all select-all"
            aria-label="Segredo para digitar no aplicativo"
          >
            {formatSecret(setup.secret)}
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" width="mobile-full" icon={Copy} onClick={() => void copySecret()}>
              Copiar segredo
            </Button>
            <a href={setup.otpauthUri} className={buttonStyles({ variant: "ghost", width: "mobile-full", className: "gap-2 no-underline" })}>
              <ExternalLink aria-hidden="true" className="size-5 shrink-0" />
              Abrir no aplicativo
            </a>
          </div>
          <p className="mt-1 text-meta text-ink-muted">
            O segredo vale só para esta ativação e é mostrado agora. Se escolher &quot;Abrir no aplicativo&quot; e nada acontecer, digite o segredo.
          </p>
        </li>
        <li className="pl-1">
          <p>Digite o código de 6 dígitos que o aplicativo mostra para confirmar.</p>
          {formError ? (
            <Notice tone="danger" role="alert" className="mt-2">
              {formError}
            </Notice>
          ) : null}
          <Field label="Código de 6 dígitos" error={errors.code?.message} className="mt-2">
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" className="tabular tracking-widest" {...register("code")} />
          </Field>
        </li>
      </ol>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" width="mobile-full" loading={isSubmitting} loadingText="Confirmando…">
          Confirmar e ligar
        </Button>
        <Button variant="ghost" size="lg" width="mobile-full" disabled={isSubmitting} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function RecoveryCodes({ codes, email, onDone }: { codes: string[]; email: string; onDone(): void }) {
  const toast = useToast();
  const [saved, setSaved] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Códigos copiados.");
    } catch {
      toast.error("Não foi possível copiar. Selecione os códigos e copie manualmente.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Notice tone="warning" title="Guarde estes códigos agora">
        Eles aparecem só desta vez. Se você perder o aplicativo, cada código entra uma única vez no lugar do código de 6 dígitos.
      </Notice>
      <ul aria-label="Códigos de recuperação" className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        {codes.map((code) => (
          <li key={code} className="tabular rounded-md bg-sunken px-3 py-2.5 text-center font-mono text-body font-semibold select-all">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" width="mobile-full" icon={Copy} onClick={() => void copy()}>
          Copiar códigos
        </Button>
        <Button
          variant="secondary"
          width="mobile-full"
          icon={Download}
          onClick={() => downloadText(recoveryCodesFileName(toLocalDateString(new Date())), serializeRecoveryCodes(codes, email))}
        >
          Baixar arquivo
        </Button>
      </div>
      <Checkbox label="Guardei os códigos em um lugar seguro." checked={saved} onChange={(event) => setSaved(event.target.checked)} />
      <div>
        <Button size="lg" width="mobile-full" disabled={!saved} onClick={onDone}>
          Concluir
        </Button>
      </div>
      {!saved ? <p className="sr-only">Marque a caixa acima para concluir.</p> : null}
    </div>
  );
}
