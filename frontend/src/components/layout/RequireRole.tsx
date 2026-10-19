"use client";

import type { ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { canAccessAdminArea } from "@/lib/rules";
import { AccessDenied } from "./AccessDenied";
import { RequireAuth } from "./RequireAuth";

/**
 * Guarda de rota por perfil (SIMULADA). Visitante: redireciona para `/entrar` (via `RequireAuth`).
 * Perfil sem permissão: tela "Acesso restrito" (AC01.5). Hoje só existe a área da administração (`/admin/**`).
 */
export function RequireRole({ role, children }: { role: "admin"; children: ReactNode }) {
  return (
    <RequireAuth>
      <RoleGate role={role}>{children}</RoleGate>
    </RequireAuth>
  );
}

const CHECKS = { admin: canAccessAdminArea } as const;

function RoleGate({ role, children }: { role: "admin"; children: ReactNode }) {
  const { user } = useSession();
  if (!user) return null; // RequireAuth já cuida do visitante
  if (!CHECKS[role](user)) return <AccessDenied role={user.role} />;
  return <>{children}</>;
}
