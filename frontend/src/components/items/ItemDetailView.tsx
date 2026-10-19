"use client";

import { Archive, Calendar, Check, FileText, MapPin, Pencil, Tag, UserRound } from "lucide-react";
import { useParams } from "next/navigation";
import { ActionBar } from "@/components/layout/ActionBar";
import { Container } from "@/components/layout/Container";
import { DefinitionList } from "@/components/layout/DefinitionList";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Photo } from "@/components/ui/Photo";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { ITEM_STATUS_META } from "@/components/ui/status";
import { ItemStatusBadge } from "@/components/ui/StatusBadge";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { isAdmin } from "@/lib/rules";
import { services, type ItemDetail } from "@/services";
import { ItemClaimsPanel } from "./ItemClaimsPanel";
import { ItemViewerNotices } from "./ItemViewerNotices";
import { useMinWidth } from "./use-min-width";

function DetailSkeleton() {
  return (
    <Container size="page">
      <LoadingRegion label="Carregando item…">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          <Skeleton className="aspect-[4/3] w-full rounded-lg lg:col-span-5" />
          <div className="flex flex-col gap-4 lg:col-span-7">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-8 w-40 rounded-full" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-4 h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        </div>
      </LoadingRegion>
    </Container>
  );
}

function FoundDate({ date }: { date: string }) {
  const relative = formatRelativeDate(date);
  const full = formatDate(date);
  return (
    <>
      <time dateTime={date} className="tabular">
        {full}
      </time>
      {relative !== full ? <span className="text-ink-subtle"> ({relative})</span> : null}
    </>
  );
}

function ItemDetailBody({ detail }: { detail: ItemDetail }) {
  const { item, createdBy, viewer, claims } = detail;
  const { user } = useSession();
  const desktop = useMinWidth("48rem");
  const showClaims = isAdmin(user);
  const returned = item.status === "returned";

  // Ações vêm só de `viewer.*` (decididas pelo serviço com as regras de lib/rules).
  const claimAction = viewer.claim.allowed ? (
    <LinkButton href={`/itens/${item.id}/reivindicar`} size="lg" width="mobile-full" icon={Check}>
      É meu
    </LinkButton>
  ) : null;
  const editAction = viewer.edit.allowed ? (
    <LinkButton href={`/admin/itens/${item.id}/editar`} variant="secondary" icon={Pencil}>
      Editar
    </LinkButton>
  ) : null;

  return (
    <Container size="page">
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <Photo
            src={item.photoDataUrl}
            alt="Foto do item"
            aspect="landscape"
            iconSize="lg"
            sizes="(min-width: 64rem) 40vw, 100vw"
            className="w-full rounded-lg"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
          <header className="flex flex-col gap-3">
            <h1>{item.title}</h1>
            <div>
              <ItemStatusBadge status={item.status} size="lg" />
            </div>
            {returned ? null : <p className="text-body text-ink-muted">{ITEM_STATUS_META[item.status].note}</p>}
          </header>

          <ItemViewerNotices detail={detail} />

          <DefinitionList
            items={[
              { label: "Categoria", value: item.category, icon: Tag },
              { label: "Encontrado em", value: item.foundLocation, icon: MapPin },
              { label: "Data", value: <FoundDate date={item.foundDate} />, icon: Calendar },
              { label: "Guardado em", value: item.storedAt, icon: Archive },
              { label: "Registrado por", value: createdBy.name, icon: UserRound },
            ]}
          />

          <section aria-labelledby="description-heading">
            <h2 id="description-heading" className="text-h3">
              Descrição
            </h2>
            <p className="mt-2 text-body whitespace-pre-line">{item.description}</p>
          </section>

          {editAction || (desktop && claimAction) ? (
            <div className="flex flex-wrap gap-3">
              {desktop ? claimAction : null}
              {editAction}
            </div>
          ) : null}

          {showClaims ? <ItemClaimsPanel claims={claims} registerReturn={viewer.registerReturn} /> : null}
        </div>
      </div>

      {!desktop && claimAction ? <ActionBar>{claimAction}</ActionBar> : null}
    </Container>
  );
}

/**
 * Tela `/itens/[id]` (RF03/RF04, parte visual): detalhe do item e ações permitidas à pessoa logada.
 * Item Devolvido (acessível por link) é somente leitura e explicado; item inexistente tem estado próprio.
 */
export function ItemDetailView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const detail = useServiceQuery(() => services.items.get(id), [id, user?.id ?? null]);

  if (detail.status === "loading") return <DetailSkeleton />;

  if (detail.status === "error") {
    if (detail.error?.code === "NOT_FOUND") {
      return (
        <Container size="form">
          <EmptyState
            variant="restricted"
            icon={FileText}
            headingLevel={1}
            title="Item não encontrado"
            action={<LinkButton href="/itens">Ver itens</LinkButton>}
          >
            Ele pode ter sido excluído.
          </EmptyState>
        </Container>
      );
    }
    return (
      <Container size="form">
        <ErrorState title="Não conseguimos carregar o item" onRetry={detail.refetch}>
          Verifique sua conexão e tente de novo.
        </ErrorState>
      </Container>
    );
  }

  return detail.data ? <ItemDetailBody detail={detail.data} /> : null;
}
