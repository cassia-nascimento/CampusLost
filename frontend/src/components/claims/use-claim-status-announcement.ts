"use client";

import { useState } from "react";
import type { ClaimView } from "@/services";
import { describeStatusChanges, snapshotStatuses, snapshotsEqual, type StatusSnapshot } from "./claim-status-changes";

/**
 * Compara cada leitura de "Minhas reivindicações" com a anterior e devolve o texto a anunciar quando algum
 * status mudou (AC04.8). A primeira leitura nunca anuncia. Atualiza durante a renderização (padrão do React
 * para derivar estado da leitura anterior), sem efeito.
 */
export function useClaimStatusAnnouncement(claims: readonly ClaimView[] | undefined): string {
  const [known, setKnown] = useState<StatusSnapshot | null>(null);
  const [message, setMessage] = useState("");

  if (claims) {
    const current = snapshotStatuses(claims);
    if (known === null) {
      setKnown(current);
    } else if (!snapshotsEqual(known, current)) {
      setKnown(current);
      const announcement = describeStatusChanges(known, claims);
      if (announcement) setMessage(announcement);
    }
  }
  return message;
}
