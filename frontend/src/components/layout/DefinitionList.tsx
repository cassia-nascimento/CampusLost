import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DefinitionItem {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
}

/** Pares rótulo/valor (detalhe e análise): empilhados no celular, duas colunas a partir de `sm`. */
export function DefinitionList({ items, className }: { items: DefinitionItem[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="min-w-0">
          <dt className="flex items-center gap-1.5 text-meta text-ink-subtle">
            {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
            {label}
          </dt>
          <dd className="user-text mt-0.5 text-body text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
