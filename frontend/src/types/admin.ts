/**
 * Tipos da administração (usuários, convites, auditoria) e do 2FA. Espelham `docs/api/API.md` §4.8 e §4.2.7.
 * Dados de demonstração no mock são fictícios.
 */
import type { Affiliation, Role } from "./domain";

/** Página de uma lista paginada (`?page=` a partir de 1; `pageSize` padrão 20, máx. 100). */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type UserStatusFilter = "active" | "disabled";

/** Usuário como a administração o vê (nunca traz hash nem segredo). */
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Vínculo pelo domínio do e-mail (não verificado). */
  affiliation: Affiliation;
  /** `password` ou `google`. */
  provider: string;
  active: boolean;
  disabledAt: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export const INVITE_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  revoked: "Revogado",
  expired: "Expirado",
};

/** Convite de administração. O token NUNCA aparece aqui (só no e-mail; no mock, em `devLink` ao criar). */
export interface AdminInvite {
  id: string;
  email: string;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  invitedById: string;
}

/** Resultado de criar convite. `devLink` existe APENAS no mock ("ambiente simulado"). */
export type CreatedInvite = AdminInvite & { devLink?: string };

/** Ações registradas na trilha (filtro `?action=` da API). */
export const AUDIT_ACTIONS = [
  "login.success",
  "login.failure",
  "login.blocked",
  "logout",
  "signup",
  "email.verify",
  "password.reset",
  "user.role_change",
  "user.disable",
  "user.enable",
  "claim.accept",
  "claim.reject",
  "return.register",
  "return_code.issue",
  "return_code.verify",
  "return_code.failure",
  "return_code.locked",
  "item.delete",
  "account.delete",
  "2fa.enable",
  "2fa.disable",
  "2fa.failure",
  "invite.create",
  "invite.revoke",
  "invite.accept",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  "login.success": "Login concluído",
  "login.failure": "Falha de login",
  "login.blocked": "Login bloqueado (muitas tentativas)",
  logout: "Saída",
  signup: "Cadastro",
  "email.verify": "E-mail confirmado",
  "password.reset": "Senha redefinida",
  "user.role_change": "Papel alterado",
  "user.disable": "Conta desativada",
  "user.enable": "Conta reativada",
  "claim.accept": "Reivindicação aceita",
  "claim.reject": "Reivindicação recusada",
  "return.register": "Devolução registrada",
  "return_code.issue": "Código de retirada gerado",
  "return_code.verify": "Código de retirada validado",
  "return_code.failure": "Código de retirada incorreto",
  "return_code.locked": "Validação do código bloqueada (muitas tentativas)",
  "item.delete": "Item excluído",
  "account.delete": "Conta excluída",
  "2fa.enable": "Verificação em duas etapas ligada",
  "2fa.disable": "Verificação em duas etapas desligada",
  "2fa.failure": "Código de duas etapas incorreto",
  "invite.create": "Convite criado",
  "invite.revoke": "Convite revogado",
  "invite.accept": "Convite aceito",
};

/** Evento da trilha de auditoria. `metadata` nunca contém senha, token, segredo TOTP nem código. */
export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  /** Sempre `null` no mock. */
  ip: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
}

/** Resposta de `setupTwoFactor`: segredo base32 (entrada manual) e URI `otpauth://` (o cliente desenha o QR). */
export interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
}

/** Códigos de recuperação (8, `xxxxx-xxxxx`), exibidos só uma vez. */
export interface TwoFactorEnabled {
  recoveryCodes: string[];
}

/** Login com 2FA ligado: nenhuma sessão ainda; a UI pede o código e chama `verifyTwoFactor`. */
export interface TwoFactorChallenge {
  status: "needs_2fa";
  challengeToken: string;
}
