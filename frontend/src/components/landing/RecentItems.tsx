"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ItemCard, ItemCardSkeleton } from "@/components/ui/ItemCard";
import { LoadingRegion } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/use-service-query";
import { services } from "@/services";

const RECENT_COUNT = 4;

const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4";

/**
 * "Itens recentes" (DESIGN §9.13): até 4 itens não devolvidos, mais recentes primeiro (a mesma regra da busca,
 * sem filtros). Os estados vivem só dentro da faixa: se ela falhar, o resto da landing continua utilizável.
 */
export function RecentItems() {
  const items = useServiceQuery(() => services.items.list(), []);
  const recent = (items.data ?? []).slice(0, RECENT_COUNT);

  return (
    <section aria-labelledby="itens-recentes-titulo">
      <div className="flex items-center justify-between gap-4">
        <h2 id="itens-recentes-titulo">Itens recentes</h2>
        <Link
          href="/itens"
          className="link touch-target inline-flex shrink-0 items-center gap-1 font-semibold no-underline hover:underline"
        >
          Ver todos
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div className="mt-6">
        {items.status === "loading" ? (
          <LoadingRegion label="Carregando itens…">
            <div className={GRID}>
              {Array.from({ length: RECENT_COUNT }, (_, n) => (
                <ItemCardSkeleton key={n} />
              ))}
            </div>
          </LoadingRegion>
        ) : items.status === "error" ? (
          <ErrorState title="Não conseguimos carregar os itens" onRetry={items.refetch} className="py-4">
            Verifique sua conexão e tente de novo.
          </ErrorState>
        ) : recent.length === 0 ? (
          <EmptyState variant="empty" headingLevel={3} title="Nenhum item registrado ainda" className="py-4">
            Quando alguém registrar um item encontrado, ele aparece aqui.
          </EmptyState>
        ) : (
          <>
            <ul role="list" className={GRID}>
              {recent.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
            <LinkButton href="/itens" variant="secondary" width="full" className="mt-6 sm:hidden">
              Ver todos os itens
            </LinkButton>
          </>
        )}
      </div>
    </section>
  );
}
