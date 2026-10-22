import type { ReactNode } from "react";
import { DemoBanner } from "./DemoNotice";
import { PublicHeader } from "./PublicHeader";
import type { RouteChrome } from "./navigation";

/**
 * Estrutura das páginas abertas ao visitante (P26): aviso de armazenamento (só se indisponível), header
 * público, `<main id="conteudo">` (alvo do "Pular para o conteúdo") e rodapé opcional. Sem BottomNav.
 */
export function PublicShell({
  pathname,
  chrome,
  footer,
  children,
}: {
  pathname: string;
  chrome?: RouteChrome;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <PublicHeader chrome={chrome} pathname={pathname} />
      <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      {footer}
    </div>
  );
}
