/** Mensagens de falha comuns a todos os formulários de conta. Função pura. */
import { isServiceError } from "@/types/domain";

/** CAPTCHA/CSRF recusados (só na API): o motivo técnico não ajuda a pessoa; orientamos a recarregar. */
export const SECURITY_CHECK_MESSAGE =
  "Não conseguimos confirmar a segurança deste envio. Recarregue a página e tente de novo.";

/** Mensagem amigável para falhas de verificação de segurança; `fallback` para os demais erros. */
export function accountErrorMessage(error: unknown, fallback: string): string {
  if (isServiceError(error) && (error.code === "CAPTCHA_FAILED" || error.code === "CSRF_FAILED")) {
    return SECURITY_CHECK_MESSAGE;
  }
  return fallback;
}
