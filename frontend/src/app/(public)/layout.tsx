import type { ReactNode } from "react";
import { DemoBanner, DemoFooter } from "@/components/layout/DemoNotice";

/** Rotas públicas (`/entrar`, `/cadastro`): sem header nem navegação; só o aviso de demonstração. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <DemoFooter />
    </div>
  );
}
