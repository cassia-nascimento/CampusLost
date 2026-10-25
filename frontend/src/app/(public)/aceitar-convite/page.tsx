import type { Metadata } from "next";
import { AcceptInviteScreen } from "@/components/auth/AcceptInviteScreen";

export const metadata: Metadata = { title: "Aceitar convite" };

export default function Page() {
  return <AcceptInviteScreen />;
}
