import type { ReactNode } from "react";
import { RequireRole } from "@/components/layout/RequireRole";

/** Tudo em `/admin/**` é só da administração; os demais perfis veem "Acesso restrito" (AC01.5). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireRole role="admin">{children}</RequireRole>;
}
