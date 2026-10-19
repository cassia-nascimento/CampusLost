import { Inbox, Search, ShieldAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** `empty`: nunca houve dados · `no-results`: filtros sem retorno · `restricted`: indisponível por permissão ou status. */
export type EmptyStateVariant = "empty" | "no-results" | "restricted";

const VARIANT_ICONS: Record<EmptyStateVariant, LucideIcon> = {
  empty: Inbox,
  "no-results": Search,
  restricted: ShieldAlert,
};

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: LucideIcon;
  title: string;
  /** Uma ou duas frases: o motivo e o que fazer. */
  children?: ReactNode;
  /** Botão ou link de ação (já estilizado). */
  action?: ReactNode;
  /** Nível do título na página. Padrão: h2. */
  headingLevel?: 1 | 2 | 3;
  className?: string;
}

/** Estado vazio centrado (DESIGN §6.9). Sempre explica o porquê e oferece o próximo passo. */
export function EmptyState({
  variant = "empty",
  icon,
  title,
  children,
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Icon = icon ?? VARIANT_ICONS[variant];
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cn("mx-auto flex max-w-sm flex-col items-center px-2 py-10 text-center", className)}>
      <div className="tag-shape flex size-16 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon aria-hidden="true" className="size-6" />
      </div>
      <Heading className="mt-5 text-h3">{title}</Heading>
      {children ? <div className="mt-2 text-body text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
