import type { ReactNode } from "react";
import { BrowseShell } from "@/components/layout/BrowseShell";

/**
 * Rotas abertas ao visitante (P26): `/itens` e `/itens/[id]`. A casca depende da sessão (shell logado ou
 * header público). As demais rotas de `/itens/**` (novo, reivindicar) seguem privadas, em `(app)`.
 */
export default function BrowseLayout({ children }: { children: ReactNode }) {
  return <BrowseShell>{children}</BrowseShell>;
}
