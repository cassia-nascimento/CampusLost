/** Regras de apresentação do 2FA em `/conta`. Funções puras. */
import { checkAdminTwoFactor } from "@/lib/rules";
import type { User } from "@/types/domain";

/** Motivos que levam a `/conta` pedindo o 2FA (`?motivo=`). */
export type AccountReason = "2fa" | "convite";

export const ACCOUNT_TWO_FACTOR_PATH = "/conta?motivo=2fa";
export const ACCOUNT_INVITE_PATH = "/conta?motivo=convite";

export function parseAccountReason(raw: string | null | undefined): AccountReason | null {
  return raw === "2fa" || raw === "convite" ? raw : null;
}

/** Administração sem 2FA ligado: `/admin/usuarios`, `/admin/convites` e `/admin/auditoria` ficam barrados. */
export function adminNeedsTwoFactor(user: Pick<User, "role" | "twoFactorEnabled">): boolean {
  return user.role === "admin" && !checkAdminTwoFactor(user, { exempt: false }).allowed;
}

/**
 * O que a tela mostra como "2FA ligado". O dado do usuário vale quando o servidor o envia; se não enviar
 * (`undefined`), vale o que esta tela acabou de fazer (ligar ou desligar), e sem isso, desligado.
 */
export function effectiveTwoFactor(fromUser: boolean | undefined, fromThisScreen: boolean | null): boolean {
  return fromUser ?? fromThisScreen ?? false;
}

/** Segredo em grupos de 4 para digitar com menos erro (`ABCD EFGH …`). */
export function formatSecret(secret: string): string {
  return secret.replace(/\s/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

export function recoveryCodesFileName(day: string): string {
  return `campuslost-codigos-de-recuperacao${/^\d{4}-\d{2}-\d{2}$/.test(day) ? `-${day}` : ""}.txt`;
}

/** Conteúdo do arquivo "Baixar": cabeçalho de aviso + um código por linha. */
export function serializeRecoveryCodes(codes: readonly string[], email: string): string {
  return [
    "CampusLost - códigos de recuperação da verificação em duas etapas",
    `Conta: ${email}`,
    "",
    "Cada código vale uma única vez. Guarde este arquivo em lugar seguro e não o compartilhe.",
    "",
    ...codes,
    "",
  ].join("\n");
}
