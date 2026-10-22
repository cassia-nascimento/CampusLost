import { z } from "zod";
import { SIGNUP_ROLES } from "@/types/domain";
import { boundedText, requiredString } from "./common";

const email = requiredString("Informe seu e-mail.")
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail.")
  .max(120, "Use no máximo 120 caracteres.")
  .pipe(z.email({ error: "Esse e-mail não parece válido. Use o formato nome@exemplo.com." }));

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

/** Senha nova (cadastro). Não sofre trim: espaços fazem parte da senha. */
const newPassword = requiredString("Crie uma senha.")
  .min(1, "Crie uma senha.")
  .min(PASSWORD_MIN, `Use pelo menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, `Use no máximo ${PASSWORD_MAX} caracteres.`);

/** Senha no login: só exige preenchimento (regras de tamanho não vazam o que é válido). */
const loginPassword = requiredString("Informe sua senha.")
  .min(1, "Informe sua senha.")
  .max(PASSWORD_MAX, `Use no máximo ${PASSWORD_MAX} caracteres.`);

const signupRole = z.enum(SIGNUP_ROLES, { error: "Escolha se você é aluno ou professor." });

export const signUpSchema = z.object({
  name: boundedText("seu nome", 2, 80),
  email,
  password: newPassword,
  role: signupRole,
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({ email, password: loginPassword });
export type SignInValues = z.infer<typeof signInSchema>;

/** Passo de papel do Google (P30): só escolhe aluno/professor. */
export const googleRoleSchema = z.object({ role: signupRole });
export type GoogleRoleValues = z.infer<typeof googleRoleSchema>;

/** Conclusão do cadastro via Google: dados do perfil (já verificados no servidor) + papel. */
export const googleSignUpSchema = z.object({
  email,
  name: boundedText("seu nome", 2, 80),
  role: signupRole,
});
export type GoogleSignUpValues = z.infer<typeof googleSignUpSchema>;

/** Normaliza e-mail para comparação (trim + minúsculas). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
