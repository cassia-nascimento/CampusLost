import type { Metadata } from "next";
import { UsersScreen } from "@/components/admin/UsersScreen";

export const metadata: Metadata = { title: "Usuários" };

export default function Page() {
  return <UsersScreen />;
}
