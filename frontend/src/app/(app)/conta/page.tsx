import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountScreen } from "@/components/account/AccountScreen";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Minha conta" };

export default function AccountPage() {
  // `AccountScreen` lê `?motivo=` (`useSearchParams`), que exige `Suspense`.
  return (
    <Suspense
      fallback={
        <LoadingRegion label="Carregando…" className="mx-auto w-full max-w-form px-gutter pt-6">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="mt-6 h-32 w-full" />
        </LoadingRegion>
      }
    >
      <AccountScreen />
    </Suspense>
  );
}
