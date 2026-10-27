"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNow } from "@/hooks/use-now";
import { useServiceQuery } from "@/hooks/use-service-query";
import { formatDateTime, formatTime } from "@/lib/format";
import { RETURN_CODE_EXPIRED_MESSAGE, RETURN_CODE_MAX_ATTEMPTS, RETURN_CODE_NOT_ISSUED_MESSAGE } from "@/lib/rules";
import { services, type ClaimView, type ReturnCodeStatus } from "@/services";
import { isServiceError } from "@/types/domain";
import { AdminQueryError } from "./AdminQueryError";

const HELP = "Peça o código à pessoa no momento da entrega. Ela o gera em Minhas reivindicações.";

/** `mm:ss` restantes até `untilMs`. */
function countdown(untilMs: number, nowMs: number): string {
  const total = Math.max(0, Math.ceil((untilMs - nowMs) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export interface ConfirmDeliveryPanelProps {
  claim: ClaimView;
  /** Entrega registrada: a tela avisa e navega. */
  onDelivered: () => void;
  /** Falha que a tela da reivindicação sabe tratar (2FA exigido, estado obsoleto, erro inesperado). */
  onFailure: (error: unknown) => void;
}

/**
 * "Confirmar entrega" (RF05, AC05.5–05.11) em dois passos: (1) validar o código que a pessoa informou e (2) confirmar
 * a entrega, liberada só depois da validação. O estado vem SEMPRE do serviço (resposta de `verifyCode` ou
 * `getReturnCodeStatus`); a administração nunca vê o código. Validar não devolve o item.
 */
export function ConfirmDeliveryPanel({ claim, onDelivered, onFailure }: ConfirmDeliveryPanelProps) {
  const headingId = useId();
  const query = useServiceQuery(() => services.claims.getReturnCodeStatus(claim.id), [claim.id]);
  // Resposta mais nova que a leitura: vale enquanto a leitura de base não muda (depois a nova assume).
  const [applied, setApplied] = useState<{ base: ReturnCodeStatus | undefined; view: ReturnCodeStatus } | null>(null);
  const status = applied && applied.base === query.data ? applied.view : query.data;
  const latestBase = useRef<ReturnCodeStatus | undefined>(undefined);
  useEffect(() => {
    latestBase.current = query.data;
  }, [query.data]);

  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const focusConfirm = useRef(false);

  const lockedUntil = status?.lockedUntil ? Date.parse(status.lockedUntil) : null;
  const verifiedUntil = status?.verified && status.verifiedUntil ? Date.parse(status.verifiedUntil) : null;
  const now = useNow(lockedUntil !== null || verifiedUntil !== null);
  const locked = lockedUntil !== null && now < lockedUntil;
  const verified = verifiedUntil !== null && now < verifiedUntil;
  const expired = !verified && !locked && Boolean(status?.verifiedAt);

  // Prazo vencido (bloqueio acabou ou conferência expirou): relê o estado do serviço, uma vez por prazo.
  const expiredAt = (lockedUntil !== null && now >= lockedUntil ? lockedUntil : null) ?? (verifiedUntil !== null && now >= verifiedUntil ? verifiedUntil : null);
  const syncedFor = useRef<number | null>(null);
  useEffect(() => {
    if (expiredAt === null || syncedFor.current === expiredAt) return;
    syncedFor.current = expiredAt;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiredAt]);

  // Depois de validar o campo trava; o foco segue para o passo 2.
  useEffect(() => {
    if (verified && focusConfirm.current) {
      focusConfirm.current = false;
      confirmRef.current?.focus();
    }
  }, [verified]);

  // Foco no campo quando há erro (primeiro erro).
  useEffect(() => {
    if (fieldError) inputRef.current?.focus();
  }, [fieldError]);

  /** Relê o estado no serviço e o aplica já (sem esperar a próxima leitura periódica). */
  async function reload() {
    try {
      const fresh = await services.claims.getReturnCodeStatus(claim.id);
      setApplied({ base: latestBase.current, view: fresh });
    } catch {
      /* o estado anterior continua; a próxima leitura corrige */
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (verifying || verified || locked) return;
    setFieldError(undefined);
    setNotice(null);
    setVerifying(true);
    try {
      const result = await services.returns.verifyCode(claim.id, value);
      focusConfirm.current = true;
      setApplied({ base: latestBase.current, view: result });
    } catch (error) {
      if (isServiceError(error) && error.code === "VALIDATION" && error.fieldErrors?.code) {
        setFieldError(error.fieldErrors.code);
        await reload();
      } else if (isServiceError(error) && error.code === "RATE_LIMITED") {
        setValue("");
        setNotice(error.message);
        await reload();
      } else if (isServiceError(error) && error.code === "INVALID_TRANSITION") {
        // "Ainda não gerou" já aparece como aviso fixo do painel; não repete.
        if (error.message !== RETURN_CODE_NOT_ISSUED_MESSAGE) setNotice(error.message);
        await reload();
      } else {
        onFailure(error);
      }
    } finally {
      setVerifying(false);
    }
  }

  async function deliver() {
    setDelivering(true);
    try {
      await services.returns.register(claim.itemId);
      setDialogOpen(false);
      onDelivered();
    } catch (error) {
      setDialogOpen(false);
      // Conferência vencida ou não feita: mostra o motivo no painel e relê o estado.
      if (isServiceError(error) && error.code === "INVALID_TRANSITION") setNotice(error.message);
      await reload();
      onFailure(error);
    } finally {
      setDelivering(false);
    }
  }

  const notIssued = status !== undefined && !status.issued;
  const attemptsLeft = status?.attemptsLeft;
  const validatedAt = status?.verifiedAt ?? null;

  return (
    <section
      aria-labelledby={headingId}
      className="mt-6 flex min-w-0 flex-col gap-5 rounded-lg bg-surface p-4 shadow-card md:p-5"
    >
      <h2 id={headingId} className="text-meta font-semibold tracking-wide text-ink-subtle uppercase">
        Confirmar entrega
      </h2>

      {query.status === "loading" && !status ? <Skeleton className="h-40 w-full rounded-lg" /> : null}
      {query.status === "error" && !status ? (
        <AdminQueryError error={query.error} title="Não conseguimos consultar o código de retirada" onRetry={query.refetch} />
      ) : null}

      {status ? (
        <>
          <form onSubmit={(event) => void verify(event)} noValidate className="flex flex-col gap-3">
            <h3 className="font-sans text-lead font-semibold tracking-normal">1. Validar o código de retirada</h3>

            {notIssued && !verified ? (
              <Notice tone="info" title="Código ainda não gerado">
                {RETURN_CODE_NOT_ISSUED_MESSAGE}
              </Notice>
            ) : null}
            {status.issued && status.issuedAt && !verified ? (
              <p className="text-meta text-ink-muted">
                {claim.claimant.name} gerou o código em <time dateTime={status.issuedAt}>{formatDateTime(status.issuedAt)}</time>.
              </p>
            ) : null}

            <Field label={`Código informado por ${claim.claimant.name}`} hint={HELP} error={fieldError}>
              <Input
                ref={inputRef}
                name="return-code"
                value={value}
                onChange={(event) => setValue(event.target.value.toLocaleUpperCase("pt-BR"))}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="done"
                maxLength={24}
                readOnly={verifying}
                disabled={verified || locked}
                placeholder="XXXX-XXXX"
                className="font-mono tracking-widest uppercase"
              />
            </Field>

            {attemptsLeft !== undefined && attemptsLeft < RETURN_CODE_MAX_ATTEMPTS && !locked && !verified ? (
              <p className="text-meta text-ink-muted">Tentativas restantes: {attemptsLeft}.</p>
            ) : null}

            <div>
              <Button type="submit" variant="secondary" width="mobile-full" loading={verifying} loadingText="Validando…" disabled={verified || locked}>
                Validar código
              </Button>
            </div>

            {/* Região sempre presente: o leitor de tela anuncia validação, bloqueio e expiração. */}
            <div aria-live="polite" className="flex flex-col gap-3 empty:hidden">
              {locked && lockedUntil !== null ? (
                <Notice tone="warning" title="Validação bloqueada">
                  <p>
                    Muitas tentativas incorretas. A validação fica bloqueada até as{" "}
                    <time dateTime={status.lockedUntil ?? undefined}>{formatTime(new Date(lockedUntil).toISOString())}</time>.
                  </p>
                  <p aria-hidden="true" className="tabular mt-1 text-ink-muted">
                    Faltam {countdown(lockedUntil, now)}
                  </p>
                </Notice>
              ) : null}
              {notice && !locked ? <Notice tone="warning">{notice}</Notice> : null}
              {verified && validatedAt ? (
                <Notice tone="success" title={`Código validado às ${formatTime(validatedAt)}`}>
                  Confirme a entrega.
                  {verifiedUntil !== null ? ` A validação vale até as ${formatTime(new Date(verifiedUntil).toISOString())}.` : ""}
                </Notice>
              ) : null}
              {expired && !notice ? <Notice tone="neutral">{RETURN_CODE_EXPIRED_MESSAGE}</Notice> : null}
            </div>
          </form>

          <div className="flex flex-col gap-3 border-t border-line pt-5">
            <h3 className="font-sans text-lead font-semibold tracking-normal">2. Confirmar a entrega</h3>
            <p id={`${headingId}-deliver-help`} className="text-meta text-ink-muted">
              {verified
                ? `Entregue o item a ${claim.claimant.name} e confirme. Esta ação não pode ser desfeita.`
                : "Disponível depois de validar o código."}
            </p>
            <div>
              <Button
                ref={confirmRef}
                size="lg"
                width="mobile-full"
                disabled={!verified}
                aria-describedby={`${headingId}-deliver-help`}
                onClick={() => setDialogOpen(true)}
              >
                Confirmar entrega
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Registrar a devolução?"
        description={
          <>
            <span className="block">
              Item: <strong>{claim.item.title}</strong>.
            </span>
            <span className="block">
              Entregue a: <strong>{claim.claimant.name}</strong>.
            </span>
            {validatedAt ? <span className="block">Código validado às {formatTime(validatedAt)}.</span> : null}
            <span className="mt-2 block">Esta ação não pode ser desfeita.</span>
          </>
        }
        confirmLabel="Registrar devolução"
        confirmingLabel="Registrando…"
        busy={delivering}
        onConfirm={() => void deliver()}
      />
    </section>
  );
}
