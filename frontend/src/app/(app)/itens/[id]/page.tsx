import type { Metadata } from "next";
import { ItemDetailView } from "@/components/items";

export const metadata: Metadata = { title: "Detalhe do item" };

export default function ItemDetailPage() {
  return <ItemDetailView />;
}
