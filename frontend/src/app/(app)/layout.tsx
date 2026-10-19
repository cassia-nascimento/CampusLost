import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { SessionLoading } from "@/components/layout/SessionLoading";

/**
 * Rotas privadas: exigem sessão (simulada) e usam o shell com header e navegação. O `Suspense` é exigido
 * pelo `useSearchParams` do shell (página de origem do voltar); a sessão só carrega no navegador, então o
 * esqueleto de sessão é o mesmo que a guarda já mostra.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Suspense fallback={<SessionLoading />}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </RequireAuth>
  );
}
