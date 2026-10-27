import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATALOG_DEMO_NOTICE } from "@/types/catalog";

/** Aviso discreto de que as categorias são dados demonstrativos (SPEC P5). */
export function CatalogNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-meta text-ink-subtle", className)}>
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {CATALOG_DEMO_NOTICE}
    </p>
  );
}
