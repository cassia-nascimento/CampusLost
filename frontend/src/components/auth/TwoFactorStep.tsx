"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useSession } from "@/hooks/use-session";
import {
  classifyTwoFactorFailure,
  codeStepSchema,
  recoveryStepSchema,
  verifyPayload,
  type TwoFactorMode,
} from "./two-factor-step";

interface StepValues {
  value: string;
}

const COPY: Record<TwoFactorMode, { label: string; hint: string; toggle: string }> = {
  code: {
    label: "Código de 6 dígitos",
    hint: "Abra o aplicativo autenticador e digite o código atual do CampusLost.",
    toggle: "Usar um código de recuperação",
  },
  recovery: {
    label: "Código de recuperação",
    hint: "Use um dos códigos guardados quando ativou a verificação. Cada código vale uma vez.",
    toggle: "Usar o código do aplicativo",
  },
};

function CodeForm({
  mode,
  challengeToken,
  onExpired,
}: {
  mode: TwoFactorMode;
  challengeToken: string;
  onExpired(message: string): void;
}) {
  const { verifyTwoFactor } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<StepValues>({
    resolver: zodResolver(mode === "code" ? codeStepSchema : recoveryStepSchema) as never,
    mode: "onTouched",
    defaultValues: { value: "" },
  });

  useEffect(() => setFocus("value"), [setFocus]);

  async function onSubmit({ value }: StepValues) {
    setFormError(null);
    setAnnouncement("");
    try {
      await verifyTwoFactor({ challengeToken, ...verifyPayload(mode, value) });
      // Sessão aberta: RedirectIfAuthenticated leva a pessoa ao destino.
    } catch (error) {
      const failure = classifyTwoFactorFailure(error, mode);
      if (failure.kind === "expired") return onExpired(failure.message);
      if (failure.kind === "field") {
        setError("value", { type: "server", message: failure.message });
        setFocus("value");
        return;
      }
      setFormError(failure.message);
    }
  }

  const copy = COPY[mode];
  return (
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
      <Field label={copy.label} hint={copy.hint} error={errors.value?.message}>
        {mode === "code" ? (
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="000000"
            className="tabular tracking-widest"
            {...register("value")}
          />
        ) : (
          <Input
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={16}
            placeholder="xxxxx-xxxxx"
            className="tabular"
            {...register("value")}
          />
        )}
      </Field>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <Button type="submit" size="lg" width="full" loading={isSubmitting} loadingText="Verificando…">
        Verificar e entrar
      </Button>
    </form>
  );
}

/**
 * Segundo passo do login quando a conta tem verificação em duas etapas. O `challengeToken` fica só em memória
 * (estado da tela); nenhuma sessão existe até o código ser aceito. Código do aplicativo ou de recuperação.
 */
export function TwoFactorStep({
  challengeToken,
  onExpired,
  onCancel,
}: {
  challengeToken: string;
  onExpired(message: string): void;
  onCancel(): void;
}) {
  const [mode, setMode] = useState<TwoFactorMode>("code");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="two-factor-title" className="flex flex-col gap-5">
      <div>
        <h1 id="two-factor-title" ref={headingRef} tabIndex={-1} className="text-display outline-none">
          Verificação em duas etapas
        </h1>
        <p className="mt-3 text-lead font-normal text-ink-muted">Confirme que é você para terminar de entrar.</p>
      </div>
      <CodeForm key={mode} mode={mode} challengeToken={challengeToken} onExpired={onExpired} />
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="lg" width="full" onClick={() => setMode((m) => (m === "code" ? "recovery" : "code"))}>
          {COPY[mode].toggle}
        </Button>
        <Button variant="ghost" size="lg" width="full" onClick={onCancel}>
          Voltar ao login
        </Button>
      </div>
    </section>
  );
}
