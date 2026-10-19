import { hasCapability } from "@/lib/rules";
import type { UserRole } from "@/types/domain";

/** Página inicial de cada perfil depois de entrar: administração → painel; demais → busca de itens. */
export function homePathFor(role: UserRole): string {
  return hasCapability({ role }, "review_claims") ? "/admin" : "/itens";
}
