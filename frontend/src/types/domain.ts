/**
 * Modelo de domínio do CampusLost (SPEC §3).
 * Identificadores em inglês; os rótulos em português vivem nas constantes `*_LABEL`.
 */

/** Papel de acesso: só `user` e `admin`. A administração nunca é escolhida no cadastro (convite ou seed). */
export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];
/** Nomes antigos (`USER_ROLES`/`UserRole`) mantidos como apelidos para não quebrar importações. */
export const USER_ROLES = ROLES;
export type UserRole = Role;

/**
 * Vínculo: `institutional` (e-mail de um domínio institucional) ou `external`. Derivado SÓ do domínio do e-mail na
 * criação da conta e gravado; o vínculo NÃO é verificado (ninguém comprova ser aluno, professor ou servidor).
 */
export const AFFILIATIONS = ["institutional", "external"] as const;
export type Affiliation = (typeof AFFILIATIONS)[number];

export const AFFILIATION_LABEL: Record<Affiliation, string> = {
  institutional: "E-mail institucional",
  external: "Externo",
};

/** Aviso a exibir junto do vínculo: ele não é uma verificação. */
export const AFFILIATION_NOTICE =
  "O vínculo é definido apenas pelo domínio do e-mail informado; não verificamos se a pessoa é aluno, professor ou servidor.";

export const ITEM_STATUSES = ["available", "under_claim", "returned"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const CLAIM_STATUSES = ["pending", "accepted", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const ROLE_LABEL: Record<UserRole, string> = {
  user: "Usuário",
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
  role: Role;
  /** Vínculo pelo domínio do e-mail (`institutional` | `external`), gravado na criação. Não é verificação. */
  affiliation: Affiliation;
  /** E-mail confirmado. Conta por senha nasce `false`; Google nasce `true`. */
  emailVerified: boolean;
  /**
   * `true` se a conta tem senha (define qual confirmação pedir ao excluir: senha ou, só-Google, nova credencial
   * do Google). Opcional: a API só o envia quando o backend o expõe; ausente = a UI assume conta com senha.
   */
  hasPassword?: boolean;
  /**
   * Verificação em duas etapas (TOTP) ligada. Opcional: a API só o envia quando o backend o expõe; ausente =
   * a UI trata como desligada e confirma pelo resultado de `setupTwoFactor`/`enableTwoFactor`.
   */
  twoFactorEnabled?: boolean;
}

/** Dados de um usuário que qualquer pessoa logada pode ver (sem e-mail). */
export type PublicUser = Pick<User, "id" | "name" | "role">;

export interface Item {
  id: string;
  title: string;
  /** Descrição pública. */
  description: string;
  category: string;
  /** Especificação da categoria; só existe quando `category === "Outros"` (a opção "Outro"), senão `null`. */
  categoryOther: string | null;
  /** Local onde foi encontrado: texto livre (3–120 caracteres). */
  foundLocation: string;
  /** Data em que foi encontrado, `YYYY-MM-DD` (calendário local). */
  foundDate: string;
  /**
   * Onde o item está guardado agora (opcional). PRIVADO: só a administração o recebe; para os demais a chave é
   * AUSENTE (`undefined`). `null` = administração sem local informado.
   */
  storedAt?: string | null;
  /**
   * Foto do item. Aceita um data URL (`data:image/jpeg;base64,...`, itens criados pelo usuário no mock), um
   * caminho público `/seed/<slug>.svg|webp` (imagens demonstrativas do seed, P27) OU, em modo API, a URL absoluta de
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
  /** Conta desativada pela administração tentou entrar (ou concluir o 2FA). */
  | "ACCOUNT_DISABLED"
  /** Administração sem 2FA ligado chamou uma operação de `/admin/*` (usuários, convites, auditoria). */
  | "TWO_FACTOR_REQUIRED"
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
