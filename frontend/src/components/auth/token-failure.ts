/** Classifica a falha de um link com token (verificação de e-mail e redefinição de senha). Função pura. */
import { isServiceError } from "@/types/domain";

/** `invalid` cobre token inexistente, usado ou expirado: a tela diz o mesmo ("inválido ou expirado"). */
export type TokenFailure = "invalid" | "other";

export function classifyTokenFailure(error: unknown): TokenFailure {
  if (isServiceError(error) && (error.code === "TOKEN_INVALID" || error.code === "TOKEN_EXPIRED")) return "invalid";
  return "other";
}
