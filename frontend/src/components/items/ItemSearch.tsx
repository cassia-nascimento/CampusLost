"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ItemCard, ItemCardSkeleton } from "@/components/ui/ItemCard";
import { LoadingRegion } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { formatCount } from "@/lib/format";
import { hasCapability } from "@/lib/rules";
import { services } from "@/services";
import type { ClaimStatus } from "@/types/domain";
import { FilterBar } from "./FilterBar";
import { rememberItemsSearch } from "./last-search";
import { EMPTY_FILTERS, filtersToSearch, getActiveChips, parseFilterParams, toItemFilters } from "./search-params";

const SKELETON_COUNT = 4;

/**
 * Tela `/itens` (RF03): busca e listagem com filtros combináveis refletidos na URL.
 * Devolvidos não aparecem; "Em reivindicação" aparece identificado no próprio cartão.
 */
export function ItemSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSession();

  const search = searchParams.toString();
  const filters = useMemo(() => parseFilterParams(new URLSearchParams(search)), [search]);
  const hasFilters = getActiveChips(filters).length > 0;

  // Guarda a busca para o "voltar" do header mobile reabrir a lista com estes filtros (detalhe, registrar).
  useEffect(() => {
    rememberItemsSearch(filtersToSearch(filters));
  }, [filters]);

  // `replace`: mudar filtro não empilha histórico; voltar do detalhe retorna a esta mesma URL.
  function applyFilters(next: typeof filters) {
    router.replace(`${pathname}${filtersToSearch(next)}`, { scroll: false });
  }

  const items = useServiceQuery(() => services.items.list(toItemFilters(filters)), [filters]);

  // "Sua reivindicação: …" nos cartões (AC04.1). Administração não reivindica; é só enfeite, então falha em silêncio.
  const wantsClaims = hasCapability(user, "view_own_claims");
  const myClaims = useServiceQuery(
    () => (wantsClaims ? services.claims.listMine() : Promise.resolve([])),
    [wantsClaims, user?.id ?? null],
  );
  const claimStatusByItem = useMemo(() => {
    const map = new Map<string, ClaimStatus>();
    for (const claim of myClaims.data ?? []) {
      if (!map.has(claim.itemId)) map.set(claim.itemId, claim.status); // mais recente primeiro
    }
    return map;
  }, [myClaims.data]);

  const loading = items.status === "loading" || (wantsClaims && myClaims.status === "loading");
  const list = items.data ?? [];
  const resultLabel = !loading && items.status === "success" ? formatCount(list.length, "item", "itens") : "";

  return (
    <Container size="page">
      <PageHeader title="Itens encontrados" />
      <FilterBar value={filters} onChange={applyFilters} resultLabel={resultLabel} />

      {loading ? (
        <LoadingRegion label="Carregando itens…">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: SKELETON_COUNT }, (_, n) => (
              <ItemCardSkeleton key={n} />
            ))}
          </div>
        </LoadingRegion>
      ) : items.status === "error" ? (
        <ErrorState title="Não conseguimos carregar os itens" onRetry={items.refetch}>
          Verifique sua conexão e tente de novo.
        </ErrorState>
      ) : list.length === 0 ? (
        hasFilters ? (
          <EmptyState
            variant="no-results"
            title="Nenhum item com esses filtros"
            action={
              <Button variant="secondary" onClick={() => applyFilters(EMPTY_FILTERS)}>
                Limpar filtros
              </Button>
            }
          >
            Tente outra categoria, local ou período, ou limpe os filtros.
          </EmptyState>
        ) : (
          <EmptyState
            variant="empty"
            title="Nenhum item registrado ainda"
            action={<LinkButton href="/itens/novo">Registrar item</LinkButton>}
          >
            Quando alguém registrar um item encontrado, ele aparece aqui.
          </EmptyState>
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} myClaimStatus={claimStatusByItem.get(item.id)} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

/** Esqueleto enquanto o Next resolve os parâmetros da URL (limite de Suspense do `useSearchParams`). */
export function ItemSearchFallback() {
  return (
    <Container size="page">
      <PageHeader title="Itens encontrados" />
      <LoadingRegion label="Carregando itens…">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SKELETON_COUNT }, (_, n) => (
            <ItemCardSkeleton key={n} />
          ))}
        </div>
      </LoadingRegion>
    </Container>
  );
}
