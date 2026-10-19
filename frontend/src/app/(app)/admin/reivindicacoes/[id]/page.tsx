import type { Metadata } from "next";
import { ClaimReview } from "@/components/admin/ClaimReview";

export const metadata: Metadata = { title: "Analisar reivindicação" };

export default async function ClaimReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClaimReview claimId={id} />;
}
