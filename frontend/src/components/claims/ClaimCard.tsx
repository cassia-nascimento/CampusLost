import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Photo } from "@/components/ui/Photo";
import { Skeleton } from "@/components/ui/Skeleton";
import { ClaimStatusBadge, ItemStatusBadge } from "@/components/ui/StatusBadge";
import { formatInstantDate } from "@/lib/format";
import { withOrigin } from "@/components/layout/navigation";
import type { ClaimView } from "@/services";
import { getClaimMessages } from "./claim-messages";

/** O que a pessoa deve fazer a seguir, por status da reivindicação e do item (DESIGN §10; textos em `claim-messages`). */
function NextStep({ claim }: { claim: ClaimView }) {
  const { item } = claim;
  const { nextStep } = getClaimMessages({
    claimStatus: claim.status,
    itemStatus: item.status,
    storedAt: item.storedAt,
  });

  if (nextStep.highlight) {
    return (
      <Notice tone="success" title={nextStep.highlight}>
        {nextStep.text}
      </Notice>
    );
  }
  return <p className="text-body text-ink-muted">{nextStep.text}</p>;
}

/**
 * Reivindicação do usuário em "Minhas reivindicações" (DESIGN §6.13 e §9.7): item, status (ícone + texto +
 * cor), data de envio, próximo passo por status e link para o item. O status do item só aparece quando
 * ele já foi devolvido (relevante para quem reivindicou).
 */
export function ClaimCard({ claim }: { claim: ClaimView }) {
  const { item } = claim;
  return (
    <article className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card sm:p-5">
      <div className="flex gap-3">
        <Photo src={item.photoDataUrl} alt="" aspect="square" sizes="4rem" className="size-16 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-sans text-lead font-semibold tracking-normal">{item.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <ClaimStatusBadge status={claim.status} />
            {item.status === "returned" ? (
              <span className="inline-flex items-center gap-2 text-meta text-ink-muted">
                Item:
                <ItemStatusBadge status={item.status} />
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-meta text-ink-subtle">
            Enviada em{" "}
            <time dateTime={claim.createdAt} className="tabular">
              {formatInstantDate(claim.createdAt)}
            </time>
          </p>
        </div>
      </div>
      <NextStep claim={claim} />
      <div>
        <LinkButton href={withOrigin(`/itens/${item.id}`, "/minhas-reivindicacoes")} variant="secondary" width="mobile-full">
          Ver item
        </LinkButton>
      </div>
    </article>
  );
}

/** Esqueleto com a geometria do `ClaimCard`. Coloque dentro de `LoadingRegion`. */
export function ClaimCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card sm:p-5">
      <div className="flex gap-3">
        <Skeleton className="size-16 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 py-1">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-11 w-28 rounded-md" />
    </div>
  );
}
