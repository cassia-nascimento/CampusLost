import {
  ServiceError,
  type Claim,
  type Item,
  type ReturnRecord,
  type User,
} from "@/types/domain";
import { ALLOW, assertAllowed, deny, type Decision } from "./decision";
import { localDateOfInstant } from "./dates";
import { assertTransition } from "./item-status";
import { hasCapability } from "./permissions";

/** Botão "Registrar devolução": só administração, item em reivindicação e com reivindicação aceita (AC05.1). */
export function canRegisterReturn(
  actor: User | null | undefined,
  item: Item,
  itemClaims: readonly Claim[],
): Decision {
  if (actor == null) return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if (!hasCapability(actor, "register_return")) {
    return deny("FORBIDDEN", "Somente a administração pode registrar devoluções.");
  }
  if (item.status === "returned") {
    return deny("ITEM_RETURNED", "Este item já foi devolvido.");
  }
  if (item.status !== "under_claim") {
    return deny("INVALID_TRANSITION", "Só é possível devolver um item que está em reivindicação.");
  }
  if (!itemClaims.some((c) => c.status === "accepted")) {
    return deny(
      "INVALID_TRANSITION",
      "Aceite uma reivindicação antes de registrar a devolução.",
    );
  }
  return ALLOW;
}

export interface RegisterReturnArgs {
  actor: User | null | undefined;
  item: Item;
  itemClaims: readonly Claim[];
  id: string;
  now: Date;
}

/** Em reivindicação → Devolvido, gerando o registro de devolução. */
export function registerReturn(args: RegisterReturnArgs): { item: Item; record: ReturnRecord } {
  const { actor, item, itemClaims, id, now } = args;
  assertAllowed(canRegisterReturn(actor, item, itemClaims));
  const accepted = itemClaims.find((c) => c.status === "accepted");
  if (!accepted) throw new ServiceError("INVALID_TRANSITION", "Nenhuma reivindicação aceita.");
  assertTransition(item.status, "returned");
  return {
    item: { ...item, status: "returned" },
    record: {
      id,
      itemId: item.id,
      claimId: accepted.id,
      returnedToId: accepted.claimantId,
      registeredById: actor!.id,
      returnedAt: now.toISOString(),
    },
  };
}

export interface PeriodFilter {
  /** `YYYY-MM-DD`, inclusive. */
  from?: string;
  to?: string;
}

/** Filtra devoluções pela data local de `returnedAt` (premissa: período sobre a data da devolução). */
export function filterReturnsByPeriod<T extends Pick<ReturnRecord, "returnedAt">>(
  records: readonly T[],
  period: PeriodFilter = {},
): T[] {
  return records.filter((r) => {
    const day = localDateOfInstant(r.returnedAt);
    if (period.from && day < period.from) return false;
    if (period.to && day > period.to) return false;
    return true;
  });
}

/** Mais recentes primeiro. */
export function sortReturns<T extends Pick<ReturnRecord, "returnedAt" | "id">>(
  records: readonly T[],
): T[] {
  return [...records].sort(
    (a, b) => b.returnedAt.localeCompare(a.returnedAt) || a.id.localeCompare(b.id),
  );
}
