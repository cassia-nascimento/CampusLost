/** Leitura das falhas das operações de administração. Funções puras. */
import { isServiceError } from "@/types/domain";

export type AdminFailure =
  /** Administração sem 2FA: leva a `/conta` com o aviso. */
  | { kind: "two-factor" }
  /** Mensagem para mostrar (CONFLICT, FORBIDDEN e demais). */
  | { kind: "message"; message: string };

export function classifyAdminFailure(error: unknown, fallback: string): AdminFailure {
  if (isServiceError(error)) {
    if (error.code === "TWO_FACTOR_REQUIRED") return { kind: "two-factor" };
    // CONFLICT (própria conta, último admin, convite já aceito) e FORBIDDEN trazem o motivo em pt-BR.
    if (error.code === "CONFLICT" || error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
      return { kind: "message", message: error.message };
    }
  }
  return { kind: "message", message: fallback };
}

/** O erro de uma leitura é a falta de 2FA? */
export function isTwoFactorRequired(error: unknown): boolean {
  return isServiceError(error) && error.code === "TWO_FACTOR_REQUIRED";
}

export function isForbidden(error: unknown): boolean {
  return isServiceError(error) && error.code === "FORBIDDEN";
}
