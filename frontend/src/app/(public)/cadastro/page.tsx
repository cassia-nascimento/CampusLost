import type { Metadata } from "next";
import { SignUpScreen } from "@/components/auth/SignUpScreen";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return <SignUpScreen />;
}
