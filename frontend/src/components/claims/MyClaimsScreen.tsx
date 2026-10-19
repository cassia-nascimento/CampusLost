"use client";

import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingRegion } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { hasCapability } from "@/lib/rules";
import { services } from "@/services";
import { ClaimCard, ClaimCardSkeleton } from "./ClaimCard";
import { useClaimStatusAnnouncement } from "./use-claim-status-announcement";

/** `/minhas-reivindicacoes` (RF04, AC04.7/04.8): acompanhamento de status no lugar de notificações. */
export function MyClaimsScreen() {
  const { user } = useSession();
  return (
    <Container size="form">
      <PageHeader title="Minhas reivindicações" />
      {user && !hasCapability(user, "view_own_claims") ? (
        <EmptyState
          variant="restricted"
          title="A administração não tem reivindicações"
          action={<LinkButton href="/admin">Ir para o painel</LinkButton>}
        >
          Esta página é para alunos e professores. Para analisar as reivindicações, use o painel.
        </EmptyState>
      ) : (
        <MyClaimsList userId={user?.id ?? null} />
      )}
    </Container>
  );
}

function MyClaimsList({ userId }: { userId: string | null }) {
  const claims = useServiceQuery(() => services.claims.listMine(), [userId]);
  const announcement = useClaimStatusAnnouncement(claims.data);

  return (
    <>
      {/* Presente desde a primeira renderização para o leitor de tela anunciar as mudanças (AC04.8). */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {claims.status === "loading" ? (
        <LoadingRegion label="Carregando suas reivindicações…" className="flex flex-col gap-3">
          <ClaimCardSkeleton />
          <ClaimCardSkeleton />
          <ClaimCardSkeleton />
        </LoadingRegion>
      ) : null}

      {claims.status === "error" ? (
        <ErrorState title="Não conseguimos carregar suas reivindicações" onRetry={claims.refetch}>
          Verifique sua conexão e tente de novo.
        </ErrorState>
      ) : null}

      {claims.status === "success" && claims.data?.length === 0 ? (
        <EmptyState
          variant="empty"
          title="Você ainda não reivindicou nenhum item"
          action={<LinkButton href="/itens">Ver itens</LinkButton>}
        >
          Se algo seu foi encontrado, ele aparece em Itens.
        </EmptyState>
      ) : null}

      {claims.status === "success" && claims.data && claims.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {claims.data.map((claim) => (
            <li key={claim.id}>
              <ClaimCard claim={claim} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
