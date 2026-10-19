import { CLAIM_STATUS_LABEL, type ClaimStatus } from "@/types/domain";

/** Status de cada reivindicação (por id) num momento da leitura. */
export type StatusSnapshot = Readonly<Record<string, ClaimStatus>>;

interface ClaimLike {
  id: string;
  status: ClaimStatus;
  item: { title: string };
}

export function snapshotStatuses(claims: readonly ClaimLike[]): StatusSnapshot {
  return Object.fromEntries(claims.map((claim) => [claim.id, claim.status]));
}

export function snapshotsEqual(a: StatusSnapshot, b: StatusSnapshot): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/**
 * Texto para a região `aria-live` (AC04.8, DESIGN §10): "Status atualizado: Aceita (Título do item).".
 * Só conta reivindicações que já existiam na leitura anterior e mudaram de status; `null` se nada mudou.
 */
export function describeStatusChanges(previous: StatusSnapshot, claims: readonly ClaimLike[]): string | null {
  const changes = claims
    .filter((claim) => previous[claim.id] !== undefined && previous[claim.id] !== claim.status)
    .map((claim) => `${CLAIM_STATUS_LABEL[claim.status]} (${claim.item.title})`);
  return changes.length > 0 ? `Status atualizado: ${changes.join("; ")}.` : null;
}
