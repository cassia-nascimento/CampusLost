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
  /** Frase de apoio exibida junto ao status (StatusNote); só para itens. */
  note?: string;
}

export const ITEM_STATUS_META: Record<ItemStatus, StatusMeta> = {
  available: {
    label: ITEM_STATUS_LABEL.available,
    icon: PackageOpen,
    tone: "success",
    note: "Ninguém reivindicou este item ainda.",
  },
  under_claim: {
    label: ITEM_STATUS_LABEL.under_claim,
    icon: PackageSearch,
    tone: "warning",
    note: "Alguém já pediu este item e a administração está conferindo.",
  },
  returned: {
    label: ITEM_STATUS_LABEL.returned,
    icon: PackageCheck,
    tone: "neutral",
    note: "Este item já foi devolvido ao dono.",
  },
};

export const CLAIM_STATUS_META: Record<ClaimStatus, StatusMeta> = {
  pending: { label: CLAIM_STATUS_LABEL.pending, icon: Clock, tone: "warning" },
  accepted: { label: CLAIM_STATUS_LABEL.accepted, icon: CircleCheck, tone: "success" },
  rejected: { label: CLAIM_STATUS_LABEL.rejected, icon: CircleX, tone: "danger" },
};
