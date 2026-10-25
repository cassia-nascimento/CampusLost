import type { Metadata } from "next";
import { ForgotPasswordScreen } from "@/components/auth/ForgotPasswordScreen";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function Page() {
  return <ForgotPasswordScreen />;
}
