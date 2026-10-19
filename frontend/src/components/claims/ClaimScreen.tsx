"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { services, type ItemDetail } from "@/services";
import { getClaimMessages } from "./claim-messages";
import { ClaimForm } from "./ClaimForm";
import { ClaimItemSummary, ClaimItemSummarySkeleton } from "./ClaimItemSummary";

/**
 * `/itens/[id]/reivindicar` (RF04, AC04.1–04.3). Quem decide se a pessoa pode reivindicar é o serviço
 * (`viewer.claim`); esta tela só mostra o formulário ou o motivo do bloqueio.
 */
export function ClaimScreen({ itemId }: { itemId: string }) {
  const { user } = useSession();
  const detail = useServiceQuery(() => services.items.get(itemId), [itemId, user?.id ?? null]);
  // Depois do envio a leitura é refeita e já mostraria "você já reivindicou": segura o estado até navegar.
  const [sent, setSent] = useState(false);

  return (
    <Container size="form">
      <h1 className="mb-6 max-md:sr-only">Reivindicar item</h1>
      {sent ? (
        <ScreenLoading label="Reivindicação enviada. Abrindo suas reivindicações…" />
      ) : detail.status === "loading" ? (
        <ScreenLoading label="Carregando o item…" />
      ) : detail.status === "error" ? (
        detail.error?.code === "NOT_FOUND" ? (
          <EmptyState
            variant="restricted"
            icon={FileText}
            title="Item não encontrado"
            action={<LinkButton href="/itens">Ver itens</LinkButton>}
          >
            Ele pode ter sido excluído.
          </EmptyState>
        ) : (
          <ErrorState title="Não conseguimos carregar o item" onRetry={detail.refetch}>
            Verifique sua conexão e tente de novo.
          </ErrorState>
        )
      ) : detail.data ? (
        <ClaimContent detail={detail.data} onSent={() => setSent(true)} onBlocked={detail.refetch} />
      ) : null}
    </Container>
  );
}

function ScreenLoading({ label }: { label: string }) {
  return (
    <LoadingRegion label={label}>
      <ClaimItemSummarySkeleton />
      <Skeleton className="mt-6 h-5 w-3/4" />
      <Skeleton className="mt-5 h-28 w-full rounded-md" />
      <Skeleton className="mt-5 h-12 w-full rounded-md" />
    </LoadingRegion>
  );
}

function ClaimContent({
  detail,
  onSent,
  onBlocked,
}: {
  detail: ItemDetail;
  onSent: () => void;
  onBlocked: () => void;
}) {
  const { item, viewer, myClaims } = detail;
  const decision = viewer.claim;

  if (!decision.allowed) {
    // Quem já tem reivindicação pendente/aceita lê o texto do DESIGN §10 (`claim-messages`); nos demais
    // bloqueios vale a mensagem que o serviço devolveu (`viewer.claim.message`).
    const mine = decision.code === "DUPLICATE_CLAIM" ? myClaims[0] : undefined;
    const blockedText =
      (mine
        ? getClaimMessages({ claimStatus: mine.status, itemStatus: item.status, storedAt: item.storedAt }).blocked
        : null) ?? decision.message;
    return (
      <>
        <ClaimItemSummary item={item} />
        <EmptyState
          variant="restricted"
          title={decision.code === "DUPLICATE_CLAIM" ? "Você já reivindicou este item" : "Não é possível reivindicar este item"}
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <LinkButton href={`/itens/${item.id}`} width="mobile-full">
                Ver item
              </LinkButton>
              {decision.code === "DUPLICATE_CLAIM" ? (
                <LinkButton href="/minhas-reivindicacoes" variant="secondary" width="mobile-full">
                  Minhas reivindicações
                </LinkButton>
              ) : null}
            </div>
          }
        >
          {blockedText}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <ClaimItemSummary item={item} />
      <ClaimForm itemId={item.id} itemStatus={item.status} onSent={onSent} onBlocked={onBlocked} />
    </>
  );
}
