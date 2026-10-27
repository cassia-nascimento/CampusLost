"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/use-service-query";
import { formatDateTime } from "@/lib/format";
import { services, type ClaimView, type IssuedReturnCode } from "@/services";
import { isServiceError } from "@/types/domain";

/** Copia para a área de transferência; sem a API moderna (ex.: página sem HTTPS), tenta o método antigo. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* cai no método antigo */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * "Código de retirada" do proprietário (reivindicação aceita, item aguardando devolução; SPEC AC05.5/05.6).
 * Gera o código na própria conta e o mostra UMA vez: depois só se sabe QUANDO foi gerado. Gerar de novo invalida o
 * anterior. O código só existe neste estado local da página, nunca em armazenamento do navegador.
 */
export function ReturnCodePanel({ claim }: { claim: ClaimView }) {
  const headingId = useId();
  const status = useServiceQuery(() => services.claims.getReturnCodeStatus(claim.id), [claim.id]);
  const [issued, setIssued] = useState<IssuedReturnCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const issuedAt = issued?.issuedAt ?? status.data?.issuedAt ?? null;
  const hasCode = status.data?.issued === true || issued !== null;

  async function generate() {
    setBusy(true);
    setError(null);
    setCopyMessage("");
    setCopied(false);
    try {
      setIssued(await services.claims.issueReturnCode(claim.id));
    } catch (cause) {
      setError(isServiceError(cause) ? cause.message : "Não foi possível gerar o código. Tente de novo em instantes.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!issued) return;
    const ok = await copyText(issued.code);
    setCopied(ok);
    setCopyMessage(ok ? "Código copiado." : "Não foi possível copiar. Selecione o código e copie manualmente.");
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-4">
      <h3 id={headingId} className="flex items-center gap-2 font-sans text-lead font-semibold tracking-normal">
        <KeyRound aria-hidden="true" className="size-5 shrink-0 text-primary" />
        Código de retirada
      </h3>
      <p className="text-body text-ink-muted">
        Gere o código e mostre-o à administração no momento da entrega. Ele é pessoal: não compartilhe.
      </p>

      {issued ? (
        <div className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
          <p className="text-meta text-ink-subtle">Seu código</p>
          {/* Visualmente grande; o leitor de tela recebe o código letra a letra. */}
          <p aria-hidden="true" className="user-text font-mono text-h1 font-bold tracking-widest break-all text-ink select-all">
            {issued.code}
          </p>
          <p className="sr-only">Seu código de retirada: {issued.code.split("").join(" ")}</p>
          <div>
            <Button variant="secondary" icon={copied ? Check : Copy} onClick={() => void copy()}>
              Copiar código
            </Button>
          </div>
          <p className="text-meta text-ink-muted">
            Anote ou mantenha esta tela aberta: ele não aparece de novo.
          </p>
        </div>
      ) : null}
      <p role="status" aria-live="polite" className="text-meta text-ink-muted empty:hidden">
        {copyMessage}
      </p>

      {status.status === "loading" && !issued ? <Skeleton className="h-11 w-48 rounded-md" /> : null}

      {status.status === "error" && !issued ? (
        <Notice
          tone="danger"
          role="alert"
          action={
            <Button variant="secondary" onClick={status.refetch}>
              Tentar novamente
            </Button>
          }
        >
          {status.error?.message ?? "Não foi possível consultar o código."}
        </Notice>
      ) : null}

      {!issued && status.data?.issued && issuedAt ? (
        <p className="text-body">
          Código gerado em <time dateTime={issuedAt}>{formatDateTime(issuedAt)}</time>. Por segurança ele não é exibido
          de novo.
        </p>
      ) : null}

      {hasCode ? <p className="text-meta text-ink-muted">O código anterior deixa de valer.</p> : null}

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {status.status === "success" || issued ? (
        <div>
          <Button
            variant={hasCode ? "secondary" : "primary"}
            width="mobile-full"
            loading={busy}
            loadingText="Gerando…"
            onClick={() => void generate()}
          >
            {hasCode ? "Gerar novo código" : "Gerar código de retirada"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
