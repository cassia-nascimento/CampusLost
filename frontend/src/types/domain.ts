/**
 * Modelo de domínio do CampusLost (SPEC §3).
 * Identificadores em inglês; os rótulos em português vivem nas constantes `*_LABEL`.
 */

export const USER_ROLES = ["student", "teacher", "external", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Papéis que podem ser escolhidos no cadastro (administração só existe por seed). */
export const SIGNUP_ROLES = ["student", "teacher", "external"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

/** Papéis escolhíveis no passo do Google (domínio institucional): comunidade externa entra direto, sem escolher. */
export const GOOGLE_SIGNUP_ROLES = ["student", "teacher"] as const;
export type GoogleSignupRole = (typeof GOOGLE_SIGNUP_ROLES)[number];

export const ITEM_STATUSES = ["available", "under_claim", "returned"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const CLAIM_STATUSES = ["pending", "accepted", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const ROLE_LABEL: Record<UserRole, string> = {
  student: "Aluno",
  teacher: "Professor",
  external: "Comunidade externa",
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

/** Como a conta autentica. Vive FORA de `User` (registro de credenciais do banco; P29/P30). */
export const AUTH_PROVIDERS = ["password", "google"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** E-mail confirmado. Conta por senha nasce `false`; Google nasce `true`. */
  emailVerified: boolean;
  /**
   * `true` se a conta tem senha (define qual confirmação pedir ao excluir: senha ou, só-Google, nova credencial
   * do Google). Opcional: a API só o envia quando o backend o expõe; ausente = a UI assume conta com senha.
   */
  hasPassword?: boolean;
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
  /**
   * Foto do item. Aceita um data URL (`data:image/jpeg;base64,...`, itens criados pelo usuário no mock), um
   * caminho público `/seed/<slug>.svg` (ilustrações do seed, P27) OU, em modo API, a URL absoluta de
   * `/uploads/...` (a API devolve `photoUrl` relativo; o cliente aplica o prefixo). Nome do campo histórico.
   */
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
  /** Ação que exige e-mail verificado (cadastrar item, reivindicar). */
  | "EMAIL_NOT_VERIFIED"
  /** Token de verificação/redefinição inexistente ou já usado. */
  | "TOKEN_INVALID"
  /** Token de verificação/redefinição expirado. */
  | "TOKEN_EXPIRED"
  /** Token inválido ou expirado, como a API o nomeia. O cliente REST o normaliza para `TOKEN_INVALID`. */
  | "INVALID_TOKEN"
  /** Cabeçalho anti-CSRF ausente/origem recusada (só na API). */
  | "CSRF_FAILED"
  /** Captcha (Turnstile) ausente ou recusado (só na API, quando ligado). */
  | "CAPTCHA_FAILED"
  /** E-mail inexistente OU senha errada (mensagem única, P29). */
  | "INVALID_CREDENTIALS"
  /** Login com Google fora do(s) domínio(s) institucional(is) permitido(s) (P30). */
  | "FORBIDDEN_DOMAIN"
  | "PHOTO_INVALID"
  | "STORAGE_FULL"
  /** Muitas tentativas de login (HTTP 429, só na API). */
  | "RATE_LIMITED"
  /** Reservado para a API REST (sem rede / timeout). O mock nunca o lança. */
  | "NETWORK"
  /** Reservado para a API REST (HTTP 409: o recurso mudou desde a leitura). O mock nunca o lança. */
  | "CONFLICT"
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
