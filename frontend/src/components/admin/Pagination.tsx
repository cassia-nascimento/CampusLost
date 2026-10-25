import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Page } from "@/types/admin";
import { pageRange } from "./list-view";

/** Anterior / Próxima com a faixa mostrada (ex.: "21–40 de 135"). Só aparece quando há mais de uma página. */
export function Pagination({ page, onChange, busy }: { page: Page<unknown>; onChange(next: number): void; busy?: boolean }) {
  if (page.totalPages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-3">
      <Button variant="secondary" icon={ChevronLeft} disabled={busy || page.page <= 1} onClick={() => onChange(page.page - 1)}>
        Anterior
      </Button>
      <p className="text-center text-meta text-ink-muted tabular" aria-live="polite">
        Página {page.page} de {page.totalPages}
        <span className="block">{pageRange(page)}</span>
      </p>
      <Button variant="secondary" disabled={busy || page.page >= page.totalPages} onClick={() => onChange(page.page + 1)}>
        Próxima
      </Button>
    </nav>
  );
}
