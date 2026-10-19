import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata: Metadata = { title: "Painel" };

export default function AdminPage() {
  return <AdminDashboard />;
}
