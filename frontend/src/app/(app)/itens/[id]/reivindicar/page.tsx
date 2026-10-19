import type { Metadata } from "next";
import { ClaimScreen } from "@/components/claims/ClaimScreen";

export const metadata: Metadata = { title: "Reivindicar item" };

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClaimScreen itemId={id} />;
}
