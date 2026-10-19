import type { Metadata } from "next";
import { NewItemScreen } from "@/components/items";

export const metadata: Metadata = { title: "Registrar item" };

export default function NewItemPage() {
  return <NewItemScreen />;
}
