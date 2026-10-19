import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClaimStatus, Item } from "@/types/domain";
import { Photo } from "./Photo";
import { Skeleton } from "./Skeleton";
import { ClaimStatusBadge, ItemStatusBadge } from "./StatusBadge";

export interface ItemCardProps {
  item: Pick<Item, "id" | "title" | "status" | "foundLocation" | "foundDate" | "photoDataUrl">;
  /** Status da reivindicação da pessoa logada neste item, quando houver (AC04.1). */
  myClaimStatus?: ClaimStatus;
  className?: string;
}

/**
 * Cartão de item (DESIGN §6.5): um único link para `/itens/[id]`.
 * Horizontal no celular (foto 96 px); vertical em grade a partir de `sm`.
 */
export function ItemCard({ item, myClaimStatus, className }: ItemCardProps) {
  return (
    <Link
      href={`/itens/${item.id}`}
      className={cn(
        "flex min-h-30 gap-3 rounded-lg bg-surface p-3 shadow-card transition-shadow",
        "hover:shadow-raised active:bg-paper",
        "sm:h-full sm:flex-col sm:gap-0 sm:overflow-hidden sm:p-0",
        className,
      )}
    >
      <Photo
        src={item.photoDataUrl}
        alt=""
        aspect="square"
        sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 6rem"
        className="size-24 shrink-0 rounded-md sm:h-auto sm:w-full sm:aspect-[4/3] sm:rounded-none"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:p-4">
        <h2 className="line-clamp-2 font-sans text-lead font-semibold tracking-normal">{item.title}</h2>
        <div>
          <ItemStatusBadge status={item.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-subtle">
          <span className="inline-flex items-center gap-1">
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
        {myClaimStatus ? (
          <p className="mt-auto flex flex-wrap items-center gap-2 text-meta text-ink-muted">
            Sua reivindicação:
            <ClaimStatusBadge status={myClaimStatus} />
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/** Esqueleto com a mesma geometria do `ItemCard` (sem salto de layout). Coloque dentro de `LoadingRegion`. */
export function ItemCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-30 gap-3 rounded-lg bg-surface p-3 shadow-card sm:flex-col sm:gap-0 sm:overflow-hidden sm:p-0"
    >
      <Skeleton className="size-24 shrink-0 rounded-md sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 py-1 sm:p-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}
