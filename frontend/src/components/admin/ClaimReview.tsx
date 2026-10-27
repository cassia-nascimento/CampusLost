"use client";

import { Calendar, MapPin, Tag, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Container } from "@/components/layout/Container";
import { DefinitionList } from "@/components/layout/DefinitionList";
import { withOrigin } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ACCOUNT_TWO_FACTOR_PATH } from "@/components/account/two-factor";
import { AdminQueryError } from "./AdminQueryError";
import { isTwoFactorRequired } from "./admin-errors";
import { Notice } from "@/components/ui/Notice";
import { Photo } from "@/components/ui/Photo";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { ClaimStatusBadge, ItemStatusBadge } from "@/components/ui/StatusBadge";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { formatCategory, formatDate, formatDateTime, formatInstantDate } from "@/lib/format";
import { canReviewClaim, reviewClaim } from "@/lib/rules";
import { itemPhotoAlt } from "@/lib/utils";
import { services, type ClaimDecisionResult, type ClaimView, type ItemDetail } from "@/services";
import { AFFILIATION_LABEL, AFFILIATION_NOTICE, isServiceError, type ItemStatus, type User } from "@/types/domain";
import { applyDecision, type ReviewState } from "./apply-decision";
import { toStoredItem } from "./stored-item";

type Dialog = "accept" | "reject" | "return" | null;

/**
 * Lê a reivindicação e o item. Na primeira leitura o `itemId` só se conhece depois de ler a reivindicação;
 * nas seguintes (`itemIdHint`) as duas leituras vão em paralelo e, se o palpite não bater, refaz em sequência.
 */
async function loadReview(claimId: string, itemIdHint?: string): Promise<ReviewState> {
  if (itemIdHint) {
    const [claim, detail] = await Promise.allSettled([services.claims.get(claimId), services.items.get(itemIdHint)]);
    if (claim.status === "rejected") throw claim.reason;
    if (detail.status === "fulfilled" && detail.value.item.id === claim.value.itemId) {
      return { claim: claim.value, detail: detail.value };
    }
  }
  const claim = await services.claims.get(claimId);
  const detail = await services.items.get(claim.itemId);
  return { claim, detail };
}

/**
 * Simula a decisão com a própria regra de domínio (`reviewClaim`, função pura) só para avisar o efeito
 * no diálogo. Quem decide de verdade é o serviço; `null` se a regra negaria.
 */
function previewDecision(user: User, claim: ClaimView, detail: ItemDetail, decision: "accept" | "reject") {
  try {
    return reviewClaim({
      actor: user,
      item: toStoredItem(detail.item),
      itemClaims: detail.claims,
      claimId: claim.id,
      decision,
      now: new Date(),
    });
  } catch {
    return null;
  }
}

/** Mensagem do toast ao aceitar, com quantas reivindicações foram recusadas automaticamente. */
function acceptedMessage(autoRejected: number): string {
  if (autoRejected === 0) return "Reivindicação aceita.";
  const rest =
    autoRejected === 1
      ? "1 outra reivindicação foi recusada automaticamente."
      : `${autoRejected} outras reivindicações foram recusadas automaticamente.`;
  return `Reivindicação aceita. ${rest}`;
}

/** `/admin/reivindicacoes/[id]`: compara o item publicado com a resposta da pessoa (RF04, AC04.4–04.6, AC05.1–05.2). */
export function ClaimReview({ claimId }: { claimId: string }) {
  const { user } = useSession();
  const itemIdRef = useRef<string | undefined>(undefined);
  const query = useServiceQuery(() => loadReview(claimId, itemIdRef.current), [claimId]);
  const latest = query.data;
  const latestRef = useRef<ReviewState | undefined>(undefined);
  useEffect(() => {
    latestRef.current = latest;
    if (latest) itemIdRef.current = latest.claim.itemId;
  }, [latest]);

  // Resultado da decisão aplicado já, para a tela não mostrar o estado antigo enquanto a releitura não chega.
  // Vale só para a leitura em que foi decidido (`base`): quando chega uma nova, ela é a oficial e assume.
  const [applied, setApplied] = useState<{ base: ReviewState; view: ReviewState } | null>(null);
  const shown = latest && applied?.base === latest ? applied.view : latest;

  function handleDecided(result: ClaimDecisionResult) {
    const base = latestRef.current;
    if (base) setApplied({ base, view: applyDecision(user, base, result) });
  }

  return (
    <Container size="admin">
      <PageHeader title="Analisar reivindicação" />
      {query.status === "loading" ? <ReviewSkeleton /> : null}
      {query.status === "error" && query.error?.code === "NOT_FOUND" ? (
        <EmptyState
          variant="restricted"
          title="Reivindicação não encontrada"
          action={<LinkButton href="/admin">Voltar ao painel</LinkButton>}
        >
          Ela pode ter sido removida junto com o item.
        </EmptyState>
      ) : null}
      {query.status === "error" && query.error?.code !== "NOT_FOUND" ? (
        <AdminQueryError error={query.error} title="Não conseguimos carregar a reivindicação" onRetry={query.refetch} />
      ) : null}
      {query.status === "success" && shown ? (
        <ReviewContent claim={shown.claim} detail={shown.detail} refetch={query.refetch} onDecided={handleDecided} />
      ) : null}
    </Container>
  );
}

function ReviewContent({
  claim,
  detail,
  refetch,
  onDecided,
}: {
  claim: ClaimView;
  detail: ItemDetail;
  refetch: () => void;
  onDecided: (result: ClaimDecisionResult) => void;
}) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  // Depois de registrar a devolução a tela navega: some com as ações para não haver um segundo clique.
  const [leaving, setLeaving] = useState(false);

  const { item } = detail;
  const reviewable = canReviewClaim(user, toStoredItem(item), claim);
  const acceptPreview = user && reviewable.allowed ? previewDecision(user, claim, detail, "accept") : null;
  const rejectPreview = user && reviewable.allowed ? previewDecision(user, claim, detail, "reject") : null;
  const othersPending = acceptPreview?.autoRejectedIds.length ?? 0;
  const rejectFreesItem = rejectPreview?.item.status === "available";

  /** Outra aba/pessoa pode ter decidido antes: explica, fecha o diálogo e relê o estado atual. */
  function handleFailure(error: unknown) {
    setDialog(null);
    if (isTwoFactorRequired(error)) {
      router.replace(ACCOUNT_TWO_FACTOR_PATH);
      return;
    }
    if (!isServiceError(error)) {
      toast.error("Não foi possível concluir a ação. Tente de novo em instantes.");
      return;
    }
    const stale = error.code === "INVALID_TRANSITION" || error.code === "ITEM_RETURNED" || error.code === "NOT_FOUND";
    toast.error(stale ? `${error.message} Atualizamos a tela com o estado atual.` : error.message);
    if (stale) refetch();
  }

  async function confirm() {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog === "accept") {
        const result = await services.claims.accept(claim.id);
        onDecided(result);
        toast.success(acceptedMessage(result.autoRejectedIds.length));
      } else if (dialog === "reject") {
        const result = await services.claims.reject(claim.id);
        onDecided(result);
        toast.success(
          result.item.status === "available"
            ? "Reivindicação recusada. O item voltou a ficar Disponível."
            : "Reivindicação recusada.",
        );
      } else {
        await services.returns.register(item.id);
        setLeaving(true);
        toast.success("Devolução registrada. O item saiu da busca.");
        router.replace("/admin/devolucoes");
      }
      setDialog(null);
    } catch (error) {
      handleFailure(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <ClaimStatusBadge status={claim.status} size="lg" />
        <p className="text-body text-ink-muted">
          Enviada em <time dateTime={claim.createdAt}>{formatDateTime(claim.createdAt)}</time>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <Panel title="O que foi publicado">
          {item.photoDataUrl ? (
            <>
              <Photo
                src={item.photoDataUrl}
                alt={itemPhotoAlt(item.title, item.photoDataUrl)}
                aspect="landscape"
                className="w-full rounded-md"
              />
              <ItemHeading title={item.title} status={item.status} />
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Photo src={null} alt="" aspect="square" className="size-20 shrink-0 rounded-md" />
              <ItemHeading title={item.title} status={item.status} />
            </div>
          )}
          <DefinitionList
            items={[
              { label: "Categoria", value: formatCategory(item.category, item.categoryOther), icon: Tag },
              { label: "Encontrado em", value: item.foundLocation, icon: MapPin },
              { label: "Data", value: formatDate(item.foundDate), icon: Calendar },
              { label: "Guardado em", value: item.storedAt ?? "Ainda não informado", icon: Warehouse },
            ]}
          />
          <div>
            <p className="text-meta text-ink-subtle">Descrição pública</p>
            <p className="user-text mt-0.5 text-body whitespace-pre-wrap">{item.description}</p>
          </div>
          <div className="-ml-4 flex flex-wrap gap-1">
            <LinkButton href={withOrigin(`/itens/${item.id}`, `/admin/reivindicacoes/${claim.id}`)} variant="ghost">
              Ver item
            </LinkButton>
            {detail.viewer.edit.allowed ? (
              <LinkButton href={`/admin/itens/${item.id}/editar`} variant="ghost">
                Editar item
              </LinkButton>
            ) : null}
          </div>
        </Panel>

        <Panel title="O que a pessoa respondeu">
          <div>
            <p className="user-text text-lead font-semibold">{claim.claimant.name}</p>
            <p className="user-text mt-0.5 text-meta text-ink-muted">{claim.claimant.email}</p>
            <p className="mt-0.5 text-meta text-ink-subtle">
              Vínculo: {AFFILIATION_LABEL[claim.claimant.affiliation]}
            </p>
            <p className="mt-0.5 text-meta text-ink-subtle">{AFFILIATION_NOTICE}</p>
          </div>
          <Answer label="Detalhes que só o dono saberia">{claim.proofDetails}</Answer>
          <Answer label="Onde e quando perdeu">{claim.lostWhereWhen}</Answer>
        </Panel>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <DecisionNotice
          claim={claim}
          detail={detail}
          reviewableMessage={reviewable.allowed ? null : reviewable.message}
          othersPending={othersPending}
          rejectFreesItem={rejectFreesItem}
        />
      </div>

      {!leaving && claim.status === "pending" && reviewable.allowed ? (
        <ActionBar>
          <Button size="lg" width="mobile-full" variant="secondary" onClick={() => setDialog("reject")}>
            Recusar
          </Button>
          <Button size="lg" width="mobile-full" onClick={() => setDialog("accept")}>
            Aceitar
          </Button>
        </ActionBar>
      ) : null}
      {!leaving && claim.status === "accepted" && detail.viewer.registerReturn.allowed ? (
        <ActionBar>
          <Button size="lg" width="mobile-full" onClick={() => setDialog("return")}>
            Registrar devolução
          </Button>
        </ActionBar>
      ) : null}

      <ConfirmDialog
        open={dialog === "accept"}
        onClose={() => setDialog(null)}
        title="Aceitar esta reivindicação?"
        description={
          <>
            {othersPending > 0
              ? `${othersPending === 1 ? "A outra reivindicação pendente deste item será recusada" : `As outras ${othersPending} reivindicações pendentes deste item serão recusadas`} automaticamente. `
              : null}
            O item continua Em reivindicação até você registrar a devolução.
          </>
        }
        confirmLabel="Aceitar reivindicação"
        confirmingLabel="Aceitando…"
        busy={busy}
        onConfirm={() => void confirm()}
      />
      <ConfirmDialog
        destructive
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title="Recusar esta reivindicação?"
        description={
          <>
            {claim.claimant.name} não poderá reenviar para este item.
            {rejectFreesItem ? " O item voltará a ficar Disponível." : null}
          </>
        }
        confirmLabel="Recusar reivindicação"
        confirmingLabel="Recusando…"
        busy={busy}
        onConfirm={() => void confirm()}
      />
      <ConfirmDialog
        open={dialog === "return"}
        onClose={() => setDialog(null)}
        title="Registrar a devolução?"
        description={
          <>
            <span className="block">
              Item: <strong>{item.title}</strong>.
            </span>
            <span className="block">
              Entregue a: <strong>{claim.claimant.name}</strong>.
            </span>
            <span className="mt-2 block">Esta ação não pode ser desfeita.</span>
          </>
        }
        confirmLabel="Registrar devolução"
        confirmingLabel="Registrando…"
        busy={busy}
        onConfirm={() => void confirm()}
      />
    </>
  );
}

/** Aviso abaixo da comparação: efeito da decisão, ou a decisão já tomada / o motivo de não haver ação. */
function DecisionNotice({
  claim,
  detail,
  reviewableMessage,
  othersPending,
  rejectFreesItem,
}: {
  claim: ClaimView;
  detail: ItemDetail;
  reviewableMessage: string | null;
  othersPending: number;
  rejectFreesItem: boolean;
}) {
  const decidedOn = claim.reviewedAt ? ` em ${formatInstantDate(claim.reviewedAt)}` : "";

  if (claim.status === "rejected") {
    return (
      <Notice tone="neutral" title={`Reivindicação recusada${decidedOn}`}>
        {claim.claimant.name} não pode reenviar para este item.
      </Notice>
    );
  }

  if (claim.status === "accepted") {
    if (detail.returnRecord) {
      return (
        <Notice tone="neutral" title="Item devolvido">
          Este item já foi devolvido em {formatInstantDate(detail.returnRecord.returnedAt)} a {claim.claimant.name}.
        </Notice>
      );
    }
    return (
      <Notice tone="success" title={`Reivindicação aceita${decidedOn}`}>
        {detail.viewer.registerReturn.allowed
          ? `O item continua Em reivindicação até você registrar a devolução a ${claim.claimant.name}.`
          : detail.viewer.registerReturn.message}
      </Notice>
    );
  }

  // Pendente.
  if (reviewableMessage) {
    return (
      <Notice tone="neutral" title="Não é possível analisar agora">
        {reviewableMessage}
      </Notice>
    );
  }
  if (othersPending > 0) {
    return (
      <Notice tone="info">
        {othersPending === 1
          ? "Há outra reivindicação pendente neste item: se você aceitar, ela será recusada automaticamente."
          : `Há outras ${othersPending} reivindicações pendentes neste item: se você aceitar, elas serão recusadas automaticamente.`}
      </Notice>
    );
  }
  if (rejectFreesItem) {
    return (
      <Notice tone="info">
        Esta é a única reivindicação ativa deste item: se você recusar, ele volta a ficar Disponível.
      </Notice>
    );
  }
  return null;
}

function ItemHeading({ title, status }: { title: string; status: ItemStatus }) {
  return (
    <div className="min-w-0">
      <h3 className="user-text font-sans text-lead font-semibold tracking-normal">{title}</h3>
      <div className="mt-2">
        <ItemStatusBadge status={status} />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-lg bg-surface p-4 shadow-card md:p-5">
      <h2 className="text-meta font-semibold tracking-wide text-ink-subtle uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Answer({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-meta text-ink-subtle">{label}</p>
      <p className="user-text mt-1 rounded-md bg-paper p-3 text-body whitespace-pre-wrap">{children}</p>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <LoadingRegion label="Carregando a reivindicação…">
      <Skeleton className="mb-6 h-8 w-48 rounded-full" />
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <Skeleton className="h-96 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </LoadingRegion>
  );
}
