import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { DemoBanner } from "./DemoNotice";

/** Tela de espera enquanto a sessão é lida (ou o redirecionamento ao login acontece). */
export function SessionLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <div className="h-(--header-h) border-b border-line bg-surface" />
      <LoadingRegion label="Carregando…" className="mx-auto w-full max-w-page flex-1 px-gutter pt-6">
        <Skeleton className="h-9 w-2/3 max-w-sm" />
        <Skeleton className="mt-6 h-28 w-full" />
        <Skeleton className="mt-3 h-28 w-full" />
      </LoadingRegion>
    </div>
  );
}
