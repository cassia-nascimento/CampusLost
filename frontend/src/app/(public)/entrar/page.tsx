import type { Metadata } from "next";
import { SignInScreen } from "@/components/auth/SignInScreen";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return <SignInScreen />;
}
