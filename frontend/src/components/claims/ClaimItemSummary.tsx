import { Calendar, MapPin } from "lucide-react";
import { Photo } from "@/components/ui/Photo";
import { Skeleton } from "@/components/ui/Skeleton";
import { ItemStatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatRelativeDate } from "@/lib/format";
import type { Item } from "@/types/domain";

/**
 * Resumo do item na tela de reivindicação (DESIGN §9.6): foto, título, status e onde/quando foi encontrado.
 * Não é clicável: quem quer ver o item inteiro volta pelo botão de voltar. Mostra só dados públicos.
 */
export function ClaimItemSummary({
  item,
}: {
  item: Pick<Item, "title" | "status" | "photoDataUrl" | "foundLocation" | "foundDate">;
}) {
  return (
    <div className="flex gap-3 rounded-lg bg-surface p-3 shadow-card">
      <Photo src={item.photoDataUrl} alt="" aspect="square" sizes="6rem" className="size-24 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="user-text line-clamp-2 font-sans text-lead font-semibold tracking-normal">{item.title}</h2>
        <div>
          <ItemStatusBadge status={item.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-subtle">
          <span className="user-text inline-flex items-center gap-1">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            {item.foundLocation}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar aria-hidden="true" className="size-4 shrink-0" />
            <time dateTime={item.foundDate} title={formatDate(item.foundDate)} className="tabular">
              {formatRelativeDate(item.foundDate)}
            </time>
          </span>
        </p>
      </div>
    </div>
  );
}

/** Esqueleto com a geometria do resumo. Coloque dentro de `LoadingRegion`. */
export function ClaimItemSummarySkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-3 rounded-lg bg-surface p-3 shadow-card">
      <Skeleton className="size-24 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 py-1">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}
