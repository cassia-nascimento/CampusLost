import type { Metadata } from "next";
import { ItemEditScreen } from "@/components/admin/ItemEditScreen";

export const metadata: Metadata = { title: "Editar item" };

export default async function ItemEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemEditScreen itemId={id} />;
}
