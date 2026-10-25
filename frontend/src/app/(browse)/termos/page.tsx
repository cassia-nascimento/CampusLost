import type { Metadata } from "next";
import { TermsScreen } from "@/components/legal/TermsScreen";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return <TermsScreen />;
}
