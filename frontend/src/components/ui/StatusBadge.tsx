import { cn } from "@/lib/utils";
import type { ClaimStatus, ItemStatus } from "@/types/domain";
import { CLAIM_STATUS_META, ITEM_STATUS_META, type StatusMeta } from "./status";
import { TONE_CLASSES } from "./tones";

interface BadgeProps {
  size?: "md" | "lg";
  className?: string;
}

function Badge({ meta, size = "md", className }: BadgeProps & { meta: StatusMeta }) {
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        TONE_CLASSES[meta.tone].surface,
        size === "lg" ? "h-8 px-3 text-body" : "h-7 px-2.5 text-meta",
        className,
      )}
    >
      <Icon aria-hidden="true" className={size === "lg" ? "size-5" : "size-4"} />
      {meta.label}
    </span>
  );
}

/** Status do item: ícone + rótulo + cor, derivados do status (DESIGN §3.4/§6.4). */
export function ItemStatusBadge({ status, ...props }: BadgeProps & { status: ItemStatus }) {
  return <Badge meta={ITEM_STATUS_META[status]} {...props} />;
}

/** Status da reivindicação: ícone + rótulo + cor. */
export function ClaimStatusBadge({ status, ...props }: BadgeProps & { status: ClaimStatus }) {
  return <Badge meta={CLAIM_STATUS_META[status]} {...props} />;
}
