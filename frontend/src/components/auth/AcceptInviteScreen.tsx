"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ACCOUNT_INVITE_PATH } from "@/components/account/two-factor";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { acceptInviteSchema, type AcceptInviteValues } from "@/lib/validation";
import { isServiceError } from "@/types/domain";
import { AuthCard } from "./AuthCard";
import { accountErrorMessage } from "./error-messages";
import { PASSWORD_HINT } from "./password-strength";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { classifyTokenFailure } from "./token-failure";

function InvalidInvite() {
  return (
    <AuthCard title="Convite inválido ou expirado">
      <EmptyState
        variant="restricted"
        icon={MailX}
        title="Este convite não funciona"
        action={
          <LinkButton href="/entrar" size="lg">
            Ir para o login
          </LinkButton>
        }
      >
        Ele pode estar incompleto, expirado, revogado ou já ter sido usado. Peça um novo convite a quem administra o CampusLost.
      </EmptyState>
    </AuthCard>
  );
}

function AcceptInviteContent() {
  const token = useSearchParams().get("token") ?? "";
  const { acceptInvite } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [invalid, setInvalid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
    mode: "onTouched",
    defaultValues: { token, name: "", password: "" },
  });
  const password = useWatch({ control, name: "password" }) ?? "";

  async function onSubmit(values: AcceptInviteValues) {
    setFormError(null);
    setEmailTaken(false);
    setAnnouncement("");
    try {
      await acceptInvite({ token: values.token, name: values.name, password: values.password });
      toast.success("Conta criada. Falta ativar a verificação em duas etapas.");
      router.replace(ACCOUNT_INVITE_PATH);
    } catch (error) {
      if (classifyTokenFailure(error) === "invalid") {
        setInvalid(true);
        return;
      }
      if (isServiceError(error) && error.code === "EMAIL_TAKEN") {
        setEmailTaken(true);
        return;
      }
      if (isServiceError(error) && error.code === "VALIDATION" && error.fieldErrors) {
        const { name, password: passwordError } = error.fieldErrors;
        if (name) setError("name", { type: "server", message: name });
        if (passwordError) setError("password", { type: "server", message: passwordError });
        if (name || passwordError) {
          setFocus(name ? "name" : "password");
          return;
        }
      }
      setFormError(accountErrorMessage(error, "Não foi possível criar a conta. Tente de novo em instantes."));
    }
  }

  if (!token || invalid) return <InvalidInvite />;

  return (
    <AuthCard
      title="Aceitar convite"
      description="Você foi convidado para a administração do CampusLost. Crie seu nome e sua senha para entrar."
    >
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
        {emailTaken ? (
          <Notice tone="danger" role="alert">
            Já existe uma conta com o e-mail deste convite.{" "}
            <Link href="/entrar" className="link font-semibold">
              Entrar
            </Link>
          </Notice>
        ) : null}
        <Field label="Seu nome" error={errors.name?.message}>
          <Input autoComplete="name" {...register("name")} />
        </Field>
        <div>
          <Field label="Senha" hint={PASSWORD_HINT} error={errors.password?.message}>
            <PasswordInput autoComplete="new-password" {...register("password")} />
          </Field>
          <PasswordStrengthMeter password={password} className="mt-3" />
        </div>
        <p className="text-meta text-ink-muted">
          Depois de entrar, você ativa a verificação em duas etapas, exigida da administração.
        </p>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        <Button type="submit" size="lg" width="full" loading={isSubmitting} loadingText="Criando conta…">
          Criar conta e entrar
        </Button>
      </form>
    </AuthCard>
  );
}

/** `/aceitar-convite?token=` (pública): nome e senha para uma conta de administração; depois, ativar o 2FA em Minha conta. */
export function AcceptInviteScreen() {
  return (
    <Suspense
      fallback={
        <LoadingRegion label="Carregando…" className="mx-auto w-full max-w-form flex-1 px-gutter pt-8">
          <Skeleton className="h-10 w-2/3" />
        </LoadingRegion>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
