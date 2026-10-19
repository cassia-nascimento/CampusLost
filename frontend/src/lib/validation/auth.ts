import { z } from "zod";
import { SIGNUP_ROLES } from "@/types/domain";
import { boundedText, requiredString } from "./common";

const email = requiredString("Informe o e-mail.")
  .trim()
  .toLowerCase()
  .min(1, "Informe o e-mail.")
  .max(120, "Use no máximo 120 caracteres.")
  .pipe(z.email({ error: "Informe um e-mail válido." }));

export const signUpSchema = z.object({
  name: boundedText("seu nome", 2, 80),
  email,
  role: z.enum(SIGNUP_ROLES, { error: "Escolha se você é aluno ou professor." }),
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({ email });
export type SignInValues = z.infer<typeof signInSchema>;

/** Normaliza e-mail para comparação (trim + minúsculas). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
