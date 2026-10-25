/** Passo de código do 2FA no login: validação do que foi digitado e leitura das falhas do serviço. Funções puras. */
import { z } from "zod";
import { normalizeRecoveryCode } from "@/lib/rules";
import { totpCodeField } from "@/lib/validation";
import { isServiceError } from "@/types/domain";
import { accountErrorMessage } from "./error-messages";

/** `code`: 6 dígitos do aplicativo · `recovery`: código de uso único (`xxxxx-xxxxx`). */
export type TwoFactorMode = "code" | "recovery";

export const RECOVERY_FORMAT_MESSAGE = "Use o formato xxxxx-xxxxx, com 10 letras e números.";

export const codeStepSchema = z.object({ value: totpCodeField });
export const recoveryStepSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1, "Informe o código de recuperação.")
    .refine((v) => normalizeRecoveryCode(v) !== null, { error: RECOVERY_FORMAT_MESSAGE }),
});

/** Corpo para `verifyTwoFactor`: exatamente um entre `code` e `recoveryCode`, já normalizado. */
export function verifyPayload(
  mode: TwoFactorMode,
  value: string,
): { code: string } | { recoveryCode: string } {
  if (mode === "code") return { code: value.replace(/\s/g, "") };
  return { recoveryCode: normalizeRecoveryCode(value) ?? value.trim() };
}

export type TwoFactorFailure =
  /** Código errado: mensagem no campo. */
  | { kind: "field"; message: string }
  /** Desafio expirado ou inválido: volta ao login com aviso. */
  | { kind: "expired"; message: string }
  /** Falha geral, mostrada acima do campo. */
  | { kind: "form"; message: string };

export const EXPIRED_CHALLENGE_MESSAGE = "A verificação expirou. Entre de novo com seu e-mail e senha.";

export function wrongCodeMessage(mode: TwoFactorMode): string {
  return mode === "code"
    ? "Código incorreto. Confira o código atual no aplicativo e tente de novo."
    : "Código de recuperação incorreto ou já usado.";
}

/** Classifica a falha de `verifyTwoFactor`. */
export function classifyTwoFactorFailure(error: unknown, mode: TwoFactorMode): TwoFactorFailure {
  if (isServiceError(error)) {
    if (error.code === "INVALID_CREDENTIALS" || error.code === "VALIDATION") {
      const message = error.fieldErrors?.code ?? error.fieldErrors?.recoveryCode;
      if (error.code === "INVALID_CREDENTIALS" || message) return { kind: "field", message: message ?? wrongCodeMessage(mode) };
    }
    if (error.code === "UNAUTHENTICATED") return { kind: "expired", message: EXPIRED_CHALLENGE_MESSAGE };
    if (error.code === "ACCOUNT_DISABLED" || error.code === "RATE_LIMITED" || error.code === "NETWORK") {
      return { kind: "form", message: error.message };
    }
  }
  return { kind: "form", message: accountErrorMessage(error, "Não foi possível verificar o código. Tente de novo em instantes.") };
}
