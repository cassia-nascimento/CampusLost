import { z } from "zod";
import { isValidIsoDate } from "@/lib/rules/dates";

/** String obrigatória (ausente, `undefined` ou tipo errado → `requiredMessage`). */
export function requiredString(requiredMessage: string) {
  return z.string({ error: () => requiredMessage });
}

/** Texto com trim e limites de tamanho, mensagens em pt-BR. */
export function boundedText(label: string, min: number, max: number) {
  const required = `Informe ${label}.`;
  return requiredString(required)
    .trim()
    .min(1, required)
    .min(min, `Use pelo menos ${min} caracteres.`)
    .max(max, `Use no máximo ${max} caracteres.`);
}

export const isoDate = requiredString("Informe a data.").refine(isValidIsoDate, {
  error: "Informe uma data válida.",
});

/** Entradas vindas de selects/URL: `""` vira `undefined`. */
export function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

/** Primeira mensagem por campo (`path` com pontos). Erros sem caminho vão em `_form`. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
