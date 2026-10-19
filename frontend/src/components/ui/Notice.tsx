import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tones";

const DEFAULT_ICONS: Record<Tone, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  neutral: Info,
  info: Info,
};

export interface NoticeProps {
  tone?: Tone;
  /** Título curto em negrito, na cor do tom. */
  title?: string;
  icon?: LucideIcon;
  /** Corpo em `ink` (contraste AAA sobre qualquer fundo de tom). */
  children?: ReactNode;
  /** Ação opcional abaixo do texto (link ou botão). */
  action?: ReactNode;
  /** `status` (padrão, educado) ou `alert` — só para erro depois de uma ação. */
  role?: "status" | "alert";
  className?: string;
}

/** Aviso inline: tom + ícone + texto (DESIGN §6.13). Usado também para explicar ação indisponível. */
export function Notice({
  tone = "info",
  title,
  icon,
  children,
  action,
  role = "status",
  className,
}: NoticeProps) {
  const Icon = icon ?? DEFAULT_ICONS[tone];
  return (
    <div
      role={role}
      className={cn("flex items-start gap-3 rounded-lg border p-4", TONE_CLASSES[tone].surface, className)}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", TONE_CLASSES[tone].fg)} />
      <div className="user-text min-w-0 flex-1 text-meta text-ink sm:text-body">
        {title ? <p className={cn("font-semibold", TONE_CLASSES[tone].fg)}>{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : undefined}>{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
