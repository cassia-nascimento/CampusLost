import type { Metadata } from "next";
import { InvitesScreen } from "@/components/admin/InvitesScreen";

export const metadata: Metadata = { title: "Convites" };

export default function Page() {
  return <InvitesScreen />;
}
