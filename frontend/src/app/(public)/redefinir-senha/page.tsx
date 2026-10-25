import type { Metadata } from "next";
import { ResetPasswordScreen } from "@/components/auth/ResetPasswordScreen";

export const metadata: Metadata = { title: "Criar nova senha" };

export default function Page() {
  return <ResetPasswordScreen />;
}
