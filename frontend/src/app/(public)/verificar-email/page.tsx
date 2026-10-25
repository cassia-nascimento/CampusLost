import type { Metadata } from "next";
import { VerifyEmailScreen } from "@/components/auth/VerifyEmailScreen";

export const metadata: Metadata = { title: "Confirmar e-mail" };

export default function Page() {
  return <VerifyEmailScreen />;
}
