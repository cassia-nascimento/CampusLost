/**
 * Único mapeamento status → rótulo / ícone / tom (DESIGN §3.4).
 * Todo status é exibido com ícone + texto + cor, nunca só com cor. Os rótulos vêm de `@/types`.
 */
import {
  CircleCheck,
  CircleX,
  Clock,
  PackageCheck,
  PackageOpen,
  PackageSearch,
  type LucideIcon,
} from "lucide-react";
import {
  CLAIM_STATUS_LABEL,
  ITEM_STATUS_LABEL,
  type ClaimStatus,
  type ItemStatus,
} from "@/types/domain";
import type { Tone } from "./tones";

export interface StatusMeta {
  label: string;
  icon: LucideIcon;
  tone: Tone;
  /**
   * Frase de apoio ao status do item. Descreve só o item e vale para qualquer pessoa e em qualquer
   * histórico (ex.: Disponível depois de uma recusa): nada de "ninguém" ou "alguém" nem a situação de quem lê.
   */
  note?: string;
}

export const ITEM_STATUS_META: Record<ItemStatus, StatusMeta> = {
  available: {
    label: ITEM_STATUS_LABEL.available,
    icon: PackageOpen,
    tone: "success",
    note: "Pode ser reivindicado.",
  },
  under_claim: {
    label: ITEM_STATUS_LABEL.under_claim,
    icon: PackageSearch,
    tone: "warning",
    note: "Há reivindicação em andamento.",
  },
  returned: {
    label: ITEM_STATUS_LABEL.returned,
    icon: PackageCheck,
    tone: "neutral",
    note: "Este item já foi devolvido.",
  },
};

export const CLAIM_STATUS_META: Record<ClaimStatus, StatusMeta> = {
  pending: { label: CLAIM_STATUS_LABEL.pending, icon: Clock, tone: "warning" },
  accepted: { label: CLAIM_STATUS_LABEL.accepted, icon: CircleCheck, tone: "success" },
  rejected: { label: CLAIM_STATUS_LABEL.rejected, icon: CircleX, tone: "danger" },
};
