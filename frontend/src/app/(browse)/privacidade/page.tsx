import type { Metadata } from "next";
import { PrivacyScreen } from "@/components/legal/PrivacyScreen";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return <PrivacyScreen />;
}
