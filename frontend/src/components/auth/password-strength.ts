/**
 * Apresentação do medidor de força da senha e dica da política. Funções puras: a nota vem de
 * `passwordStrength` (lib/rules); aqui só se decide quantas barras acendem e em que tom.
 */
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, type PasswordStrength } from "@/lib/rules";
import type { Tone } from "@/components/ui/tones";

/** Dica exibida sob o campo de senha nova (cadastro e redefinição). */
export const PASSWORD_HINT =
  `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres e máximo de ${PASSWORD_MAX_BYTES} bytes ` +
  "(acentos e símbolos ocupam mais de um). Evite senhas comuns.";

export const STRENGTH_SEGMENTS = 4;

export interface StrengthView {
  /** Barras acesas de `STRENGTH_SEGMENTS`. Senha preenchida sempre acende pelo menos uma. */
  filled: number;
  tone: Extract<Tone, "danger" | "warning" | "success">;
}

export function strengthView(level: PasswordStrength): StrengthView {
  return {
    filled: Math.max(1, level),
    tone: level <= 1 ? "danger" : level === 2 ? "warning" : "success",
  };
}
