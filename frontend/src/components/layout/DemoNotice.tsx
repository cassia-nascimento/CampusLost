import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** AC01.6 / RNF01: aviso de segurança simulada (DESIGN §8.1 e §10). */
export const DEMO_BANNER_TEXT = "Demonstração: login simulado e dados salvos só neste navegador.";

export const DEMO_FULL_NOTICE =
  "Este é um protótipo. O login é simulado, nenhuma senha é pedida ou guardada, e os dados ficam apenas neste navegador. A segurança real depende do sistema final.";

/** Faixa informativa no topo de todas as páginas. Não é fixa: rola junto, para não roubar altura. */
export function DemoBanner() {
  return (
    <div className="border-b border-info-border bg-info-bg">
      <p className="mx-auto flex max-w-admin items-start gap-2 px-gutter py-2 text-meta text-ink">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info-fg" />
        <span>{DEMO_BANNER_TEXT}</span>
      </p>
    </div>
  );
}

/** Rodapé com o texto completo da simulação (desktop; no celular vale o banner e a tela de entrada). */
export function DemoFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("hidden border-t border-line bg-surface md:block", className)}>
      <p className="mx-auto max-w-admin px-gutter py-4 text-meta text-ink-muted">
        <strong className="font-semibold text-ink">Modo demonstração. </strong>
        {DEMO_FULL_NOTICE}
      </p>
    </footer>
  );
}
