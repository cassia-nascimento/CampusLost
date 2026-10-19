import type { Metadata } from "next";
import { Suspense } from "react";
import { ItemSearch, ItemSearchFallback } from "@/components/items";

export const metadata: Metadata = { title: "Itens encontrados" };

export default function ItemsPage() {
  // `useSearchParams` (filtros na URL) exige um limite de Suspense.
  return (
    <Suspense fallback={<ItemSearchFallback />}>
      <ItemSearch />
    </Suspense>
  );
}
