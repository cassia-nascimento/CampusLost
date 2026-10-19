/**
 * Modelo de domínio do CampusLost (SPEC §3).
 * Identificadores em inglês; os rótulos em português vivem nas constantes `*_LABEL`.
 */

export const USER_ROLES = ["student", "teacher", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Papéis que podem ser escolhidos no cadastro (administração só existe por seed). */
export const SIGNUP_ROLES = ["student", "teacher"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const ITEM_STATUSES = ["available", "under_claim", "returned"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const CLAIM_STATUSES = ["pending", "accepted", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const ROLE_LABEL: Record<UserRole, string> = {
  student: "Aluno",
  teacher: "Professor",
  admin: "Administração",
};

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  available: "Disponível",
  under_claim: "Em reivindicação",
  returned: "Devolvido",
};

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: "Pendente",
  accepted: "Aceita",
  rejected: "Recusada",
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Dados de um usuário que qualquer pessoa logada pode ver (sem e-mail). */
export type PublicUser = Pick<User, "id" | "name" | "role">;

export interface Item {
  id: string;
  title: string;
  /** Descrição pública. */
  description: string;
  category: string;
  foundLocation: string;
  /** Data em que foi encontrado, `YYYY-MM-DD` (calendário local). */
  foundDate: string;
  /** Onde o item está guardado agora. */
  storedAt: string;
  photoDataUrl?: string;
  status: ItemStatus;
  createdById: string;
  /** Instante ISO 8601 (UTC). */
  createdAt: string;
}

export interface Claim {
  id: string;
  itemId: string;
  claimantId: string;
  /** Detalhes que só o dono saberia. */
  proofDetails: string;
  /** Onde e quando perdeu. */
  lostWhereWhen: string;
  status: ClaimStatus;
  createdAt: string;
  reviewedAt?: string;
}

export interface ReturnRecord {
  id: string;
  itemId: string;
  claimId: string;
  returnedToId: string;
  registeredById: string;
  returnedAt: string;
}

/* ---------- Erros ---------- */

export type ServiceErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_TRANSITION"
  | "DUPLICATE_CLAIM"
  | "CLAIM_BLOCKED"
  | "ITEM_RETURNED"
  | "EMAIL_TAKEN"
  | "USER_NOT_FOUND"
  | "PHOTO_INVALID"
  | "STORAGE_FULL"
  | "UNEXPECTED";

/** Erro tipado dos serviços. `message` já é texto pt-BR apresentável ao usuário. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  /** Mensagens por campo (apenas `VALIDATION`, e `EMAIL_TAKEN` → `email`). */
  readonly fieldErrors?: Readonly<Record<string, string>>;

  constructor(
    code: ServiceErrorCode,
    message: string,
    options?: { fieldErrors?: Record<string, string>; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ServiceError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
  }
}

export function isServiceError(value: unknown): value is ServiceError {
  return value instanceof ServiceError;
}
