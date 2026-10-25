import { z } from "zod";
import { GOOGLE_SIGNUP_ROLES, SIGNUP_ROLES } from "@/types/domain";
import {
  PASSWORD_ISSUE_MESSAGE,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordByteLength,
  passwordIssue,
} from "@/lib/rules/password";
import { boundedText, requiredString } from "./common";

const email = requiredString("Informe seu e-mail.")
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail.")
  .max(120, "Use no máximo 120 caracteres.")
  .pipe(z.email({ error: "Esse e-mail não parece válido. Use o formato nome@exemplo.com." }));

/** Campos reutilizados por outros esquemas (administração). */
export const emailField = email;

export const PASSWORD_MIN = PASSWORD_MIN_LENGTH;
export const PASSWORD_MAX = PASSWORD_MAX_BYTES;

/** Senha nova (cadastro/redefinição). Não sofre trim. Tamanho: mín. em caracteres, máx. em BYTES UTF-8. */
const newPassword = requiredString("Crie uma senha.")
  .min(1, "Crie uma senha.")
  .min(PASSWORD_MIN, `Use pelo menos ${PASSWORD_MIN} caracteres.`)
  .refine((pw) => passwordByteLength(pw) <= PASSWORD_MAX, { error: PASSWORD_ISSUE_MESSAGE.too_long })
  .refine((pw) => passwordIssue(pw) !== "common", { error: PASSWORD_ISSUE_MESSAGE.common });

export const newPasswordField = newPassword;

/** Senha no login: só exige preenchimento (regras de tamanho não vazam o que é válido). */
const loginPassword = requiredString("Informe sua senha.")
  .min(1, "Informe sua senha.")
  .refine((pw) => passwordByteLength(pw) <= PASSWORD_MAX, { error: `Use no máximo ${PASSWORD_MAX} bytes.` });

const turnstileToken = z.string().max(4096).optional();

const signupRole = z.enum(SIGNUP_ROLES, { error: "Escolha como você usa o CampusLost." });
const googleRole = z.enum(GOOGLE_SIGNUP_ROLES, { error: "Escolha se você é aluno ou professor." });

export const signUpSchema = z
  .object({
    name: boundedText("seu nome", 2, 80),
    email,
    password: newPassword,
    role: signupRole,
    acceptedTerms: z.literal(true, { error: "Aceite os termos de uso para criar a conta." }),
    /** Token do captcha (Turnstile), só quando o servidor o exige. */
    turnstileToken: turnstileToken,
  })
  .superRefine((v, ctx) => {
    const issue = passwordIssue(v.password, { email: v.email, name: v.name });
    if (issue === "same_as_email" || issue === "same_as_name") {
      ctx.addIssue({ code: "custom", path: ["password"], message: PASSWORD_ISSUE_MESSAGE[issue] });
    }
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({ email, password: loginPassword, turnstileToken });
export type SignInValues = z.infer<typeof signInSchema>;

/** Passo de papel do Google (P30): só escolhe aluno/professor. */
export const googleRoleSchema = z.object({ role: googleRole });
export type GoogleRoleValues = z.infer<typeof googleRoleSchema>;

/**
 * Conclusão do cadastro via Google: dados do perfil (já verificados no servidor) + aceite dos termos.
 * `role` só é exigido no domínio institucional (o serviço confere); fora dele a conta é `external`.
 */
export const googleSignUpSchema = z.object({
  email,
  name: boundedText("seu nome", 2, 80),
  role: googleRole.optional(),
  acceptedTerms: z.literal(true, { error: "Aceite os termos de uso para criar a conta." }),
});
export type GoogleSignUpValues = z.infer<typeof googleSignUpSchema>;

/** "Esqueci minha senha": só o e-mail. */
export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const token = requiredString("Link inválido ou incompleto.").trim().min(1, "Link inválido ou incompleto.").max(512, "Link inválido ou incompleto.");

/** Redefinição de senha: token do link + nova senha (mesma política do cadastro, sem contexto de e-mail/nome). */
export const resetPasswordSchema = z.object({ token, password: newPassword });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token });

/** Exclusão da conta: senha obrigatória só para conta por senha (o serviço decide; aqui é opcional). */
export const deleteAccountSchema = z.object({ password: z.string().max(1024).optional() });
export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;

/** Normaliza e-mail para comparação (trim + minúsculas). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
