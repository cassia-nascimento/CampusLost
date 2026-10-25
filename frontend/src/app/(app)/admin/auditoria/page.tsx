import type { Metadata } from "next";
import { AuditScreen } from "@/components/admin/AuditScreen";

export const metadata: Metadata = { title: "Auditoria" };

export default function Page() {
  return <AuditScreen />;
}
