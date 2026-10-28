import {
  ServiceError,
  type Claim,
  type Item,
  type User,
} from "@/types/domain";
import { ALLOW, assertAllowed, deny, type Decision } from "./decision";
import { checkEmailVerified, hasCapability } from "./permissions";
import { assertTransition } from "./item-status";

export function isActiveClaim(claim: Pick<Claim, "status">): boolean {
  return claim.status === "pending" || claim.status === "accepted";
}

export function hasAcceptedClaim(claims: readonly Claim[]): boolean {
  return claims.some((c) => c.status === "accepted");
}

/** Uma reivindicação só é visível à administração e ao próprio reivindicante. */
export function canViewClaim(actor: User | null | undefined, claim: Claim): Decision {
  if (actor == null) return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if (hasCapability(actor, "review_claims") || claim.claimantId === actor.id) return ALLOW;
  return deny("FORBIDDEN", "Você não tem permissão para ver esta reivindicação.");
}

/**
 * O usuário pode reivindicar este item? (RF04 / AC04.1, AC04.12, P46)
 * `itemClaims` são as reivindicações do item (de qualquer usuário; a função filtra).
 */
export function canClaim(
  actor: User | null | undefined,
  item: Item,
  itemClaims: readonly Claim[],
): Decision {
  if (actor == null) return deny("UNAUTHENTICATED", "Entre para reivindicar este item.");
  if (!hasCapability(actor, "claim_item")) {
    return deny("FORBIDDEN", "A administração analisa reivindicações, mas não reivindica itens.");
  }
  const verified = checkEmailVerified(actor);
  if (!verified.allowed) return verified;
  // Quem registrou o item não o reivindica (P46).
  if (item.createdById === actor.id) {
    return deny(
      "FORBIDDEN",
      "Você registrou este item, então não pode reivindicá-lo. Se ele é seu, procure a administração.",
    );
  }
  if (item.status === "returned") {
    return deny("ITEM_RETURNED", "Este item já foi devolvido.");
  }
  const mine = itemClaims.filter((c) => c.claimantId === actor.id);
  if (mine.some((c) => c.status === "accepted")) {
    return deny(
      "DUPLICATE_CLAIM",
      "Sua reivindicação foi aceita. Procure a administração para retirar o item.",
    );
  }
  if (mine.some(isActiveClaim)) {
    return deny("DUPLICATE_CLAIM", "Você já tem uma reivindicação em andamento para este item.");
  }
  if (mine.some((c) => c.status === "rejected")) {
    return deny(
      "CLAIM_BLOCKED",
      "Sua reivindicação para este item foi recusada. Procure a administração.",
    );
  }
  // Premissa P14 (SPEC §9): com reivindicação aceita, o item só aguarda a devolução.
  if (hasAcceptedClaim(itemClaims)) {
    return deny(
      "CLAIM_BLOCKED",
      "Este item já tem uma reivindicação aceita e aguarda a devolução.",
    );
  }
  return ALLOW;
}

export interface SubmitClaimArgs {
  actor: User | null | undefined;
  item: Item;
  itemClaims: readonly Claim[];
  input: { proofDetails: string; lostWhereWhen: string };
  id: string;
  now: Date;
}

/** Cria a reivindicação; item Disponível → Em reivindicação. */
export function submitClaim(args: SubmitClaimArgs): { claim: Claim; item: Item } {
  const { actor, item, itemClaims, input, id, now } = args;
  assertAllowed(canClaim(actor, item, itemClaims));
  const claim: Claim = {
    id,
    itemId: item.id,
    claimantId: actor!.id,
    proofDetails: input.proofDetails,
    lostWhereWhen: input.lostWhereWhen,
    status: "pending",
    createdAt: now.toISOString(),
  };
  let nextItem = item;
  if (item.status === "available") {
    assertTransition("available", "under_claim");
    nextItem = { ...item, status: "under_claim" };
  }
  return { claim, item: nextItem };
}

/** Só a administração analisa, e só reivindicações pendentes de itens em reivindicação. */
export function canReviewClaim(
  actor: User | null | undefined,
  item: Item,
  claim: Claim,
): Decision {
  if (actor == null) return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if (!hasCapability(actor, "review_claims")) {
    return deny("FORBIDDEN", "Somente a administração pode analisar reivindicações.");
  }
  if (item.status === "returned") {
    return deny("ITEM_RETURNED", "Este item já foi devolvido.");
  }
  if (claim.status !== "pending") {
    return deny("INVALID_TRANSITION", "Esta reivindicação já foi analisada.");
  }
  if (item.status !== "under_claim") {
    return deny("INVALID_TRANSITION", "O item não está em reivindicação.");
  }
  return ALLOW;
}

export interface ReviewClaimArgs {
  actor: User | null | undefined;
  item: Item;
  /** Todas as reivindicações do item. */
  itemClaims: readonly Claim[];
  claimId: string;
  decision: "accept" | "reject";
  now: Date;
}

export interface ReviewClaimResult {
  item: Item;
  /** A reivindicação analisada, já atualizada. */
  claim: Claim;
  /** Todas as reivindicações do item, já atualizadas. */
  claims: Claim[];
  /** Ids recusados automaticamente por causa de um aceite. */
  autoRejectedIds: string[];
}

/**
 * Aceitar: recusa automaticamente as demais pendentes; o item permanece Em reivindicação.
 * Recusar: se não restar nenhuma pendente/aceita, o item volta a Disponível.
 */
export function reviewClaim(args: ReviewClaimArgs): ReviewClaimResult {
  const { actor, item, itemClaims, claimId, decision, now } = args;
  const target = itemClaims.find((c) => c.id === claimId);
  if (!target) throw new ServiceError("NOT_FOUND", "Reivindicação não encontrada.");
  assertAllowed(canReviewClaim(actor, item, target));

  const reviewedAt = now.toISOString();
  const autoRejectedIds: string[] = [];
  const claims = itemClaims.map((c): Claim => {
    if (c.id === claimId) {
      return { ...c, status: decision === "accept" ? "accepted" : "rejected", reviewedAt };
    }
    if (decision === "accept" && c.status === "pending") {
      autoRejectedIds.push(c.id);
      return { ...c, status: "rejected", reviewedAt };
    }
    return c;
  });

  let nextItem = item;
  if (decision === "reject" && !claims.some(isActiveClaim)) {
    assertTransition("under_claim", "available");
    nextItem = { ...item, status: "available" };
  }

  return {
    item: nextItem,
    claim: claims.find((c) => c.id === claimId)!,
    claims,
    autoRejectedIds,
  };
}
