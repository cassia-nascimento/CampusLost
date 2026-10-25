import { CircleCheck, CircleSlash, Clock, MailCheck, MailX, ShieldCheck, ShieldOff, TimerOff, type LucideIcon } from "lucide-react";
import { TONE_CLASSES, type Tone } from "@/components/ui/tones";
import { cn } from "@/lib/utils";
import { INVITE_STATUS_LABEL, type InviteStatus } from "@/types/admin";

function Pill({ tone, icon: Icon, children }: { tone: Tone; icon: LucideIcon; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-meta font-semibold whitespace-nowrap",
        TONE_CLASSES[tone].surface,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {children}
    </span>
  );
}

/** Situação da conta: ícone + texto + cor (nunca só cor). */
export function AccountStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Pill tone="success" icon={CircleCheck}>
      Ativa
    </Pill>
  ) : (
    <Pill tone="neutral" icon={CircleSlash}>
      Desativada
    </Pill>
  );
}

export function TwoFactorBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Pill tone="success" icon={ShieldCheck}>
      2FA ligado
    </Pill>
  ) : (
    <Pill tone="neutral" icon={ShieldOff}>
      2FA desligado
    </Pill>
  );
}

const INVITE_META: Record<InviteStatus, { tone: Tone; icon: LucideIcon }> = {
  pending: { tone: "info", icon: Clock },
  accepted: { tone: "success", icon: MailCheck },
  revoked: { tone: "neutral", icon: MailX },
  expired: { tone: "warning", icon: TimerOff },
};

export function InviteStatusBadge({ status }: { status: InviteStatus }) {
  const { tone, icon } = INVITE_META[status];
  return (
    <Pill tone={tone} icon={icon}>
      {INVITE_STATUS_LABEL[status]}
    </Pill>
  );
}
