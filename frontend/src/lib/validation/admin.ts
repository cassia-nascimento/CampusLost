import { z } from "zod";
import { AFFILIATIONS, ROLES } from "@/types/domain";
import { MAX_PAGE_SIZE } from "@/types/admin";
import { boundedText, emptyToUndefined, requiredString } from "./common";
import { emailField, newPasswordField } from "./auth";

/* ---------- 2FA ---------- */

const MSG_CODE = "Informe o código de 6 dígitos.";

/** Código TOTP: 6 dígitos (espaços são ignorados). */
export const totpCodeField = requiredString(MSG_CODE)
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, MSG_CODE));

export const enableTwoFactorSchema = z.object({ code: totpCodeField });
export type EnableTwoFactorValues = z.infer<typeof enableTwoFactorSchema>;

/**
 * Desligar o 2FA: senha (exigida só de conta com senha; o serviço decide) e um código atual,
 * que pode ser TOTP ou de recuperação (por isso `code` aqui só exige preenchimento).
 */
export const disableTwoFactorSchema = z.object({
  password: z.string().max(1024, "Use no máximo 1024 caracteres.").optional(),
  code: requiredString("Informe o código.").trim().min(1, "Informe o código.").max(32, "Código inválido."),
});
export type DisableTwoFactorValues = z.infer<typeof disableTwoFactorSchema>;

/** Passo de código no login: `challengeToken` + exatamente UM entre `code` (TOTP) e `recoveryCode`. */
export const verifyTwoFactorSchema = z
  .object({
    challengeToken: requiredString("A verificação expirou. Entre novamente.").min(1, "A verificação expirou. Entre novamente."),
    code: z.string().optional(),
    recoveryCode: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const hasCode = v.code !== undefined && v.code.trim() !== "";
    const hasRecovery = v.recoveryCode !== undefined && v.recoveryCode.trim() !== "";
    if (hasCode === hasRecovery) {
      ctx.addIssue({
        code: "custom",
        path: [hasRecovery ? "recoveryCode" : "code"],
        message: hasRecovery ? "Use o código do aplicativo OU um código de recuperação." : MSG_CODE,
      });
    }
  });
export type VerifyTwoFactorValues = z.infer<typeof verifyTwoFactorSchema>;

/* ---------- usuários ---------- */

const pageField = z.preprocess(
  emptyToUndefined,
  z.coerce.number({ error: "Use um número de página válido." }).int("Use um número de página válido.").min(1, "Use um número de página válido.").optional(),
);
const pageSizeField = z.preprocess(
  emptyToUndefined,
  z.coerce.number({ error: `Use de 1 a ${MAX_PAGE_SIZE}.` }).int(`Use de 1 a ${MAX_PAGE_SIZE}.`).min(1, `Use de 1 a ${MAX_PAGE_SIZE}.`).max(MAX_PAGE_SIZE, `Use de 1 a ${MAX_PAGE_SIZE}.`).optional(),
);

export const adminUserFiltersSchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(120, "Use no máximo 120 caracteres.").optional()),
  role: z.preprocess(emptyToUndefined, z.enum(ROLES, { error: "Papel inválido." }).optional()),
  affiliation: z.preprocess(emptyToUndefined, z.enum(AFFILIATIONS, { error: "Vínculo inválido." }).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(["active", "disabled"], { error: "Use active ou disabled." }).optional()),
  page: pageField,
  pageSize: pageSizeField,
});

export const userPatchSchema = z
  .object({
    role: z.enum(ROLES, { error: "Escolha usuário ou administração." }).optional(),
    active: z.boolean({ error: "Use verdadeiro ou falso." }).optional(),
  })
  .refine((v) => v.role !== undefined || v.active !== undefined, { error: "Informe o papel e/ou o estado da conta." });
export type UserPatchValues = z.infer<typeof userPatchSchema>;

/* ---------- convites ---------- */

export const inviteSchema = z.object({ email: emailField });
export type InviteValues = z.infer<typeof inviteSchema>;

const inviteToken = requiredString("Link inválido ou incompleto.").trim().min(16, "Link inválido ou incompleto.").max(200, "Link inválido ou incompleto.");

/** Aceitar convite: token do link, nome (2-80) e senha pela política. `acceptedTerms` é opcional (a API não o grava). */
export const acceptInviteSchema = z.object({
  token: inviteToken,
  name: boundedText("seu nome", 2, 80),
  password: newPasswordField,
  acceptedTerms: z.boolean().optional(),
});
export type AcceptInviteValues = z.infer<typeof acceptInviteSchema>;

/* ---------- auditoria ---------- */

/** Só paginação (convites). */
export const pageParamsSchema = z.object({ page: pageField, pageSize: pageSizeField });

export const auditFiltersSchema = z.object({
  action: z.preprocess(emptyToUndefined, z.string().trim().max(40, "Ação inválida.").optional()),
  actor: z.preprocess(emptyToUndefined, z.string().trim().max(80, "Usuário inválido.").optional()),
  page: pageField,
  pageSize: pageSizeField,
});
