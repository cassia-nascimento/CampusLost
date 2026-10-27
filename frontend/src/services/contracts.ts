/**
 * Contratos assíncronos dos serviços (SPEC §8).
 *
 * São o único ponto que a UI conhece. Nada aqui expõe `localStorage`, chaves ou
 * formato de persistência: trocar o mock por uma API REST (FastAPI) significa
 * apenas implementar estas interfaces e alterar `services/index.ts`.
 *
 * Convenções
 *  - O "usuário atual" é a sessão do serviço (como um token numa API real);
 *    por isso as operações não recebem o ator por parâmetro.
 *  - Falhas lançam `ServiceError` (com `code` e mensagem pt-BR). Erros de
 *    validação trazem `fieldErrors`.
 *  - Datas de calendário são `YYYY-MM-DD`; instantes são ISO 8601.
 *  - O usuário atual é o da sessão no instante da chamada (capturado antes da latência).
 *
 * Específicos do protótipo: `Services.demo` (reiniciar demonstração), `AuthService.signInAsDemo` e
 * `AuthService.listDemoProfiles`. Uma API real pode omiti-los ou implementá-los à parte
 * (por exemplo, atrás de uma flag de ambiente).
 * Código `RATE_LIMITED` de `ServiceError` é reservado para a API (o mock não limita tentativas); o mock só lança
 * `NETWORK` na verificação do Google (rota de servidor inacessível) e `CONFLICT` nas regras de 2FA/administração.
 */
import type {
  Claim,
  Item,
  PublicUser,
  ReturnRecord,
  User,
  Affiliation,
  Role,
} from "@/types/domain";
import type {
  AdminInvite,
  AdminUserRow,
  UserStatusFilter,
  AuditEntry,
  CreatedInvite,
  Page,
  TwoFactorChallenge,
  TwoFactorEnabled,
  TwoFactorSetup,
} from "@/types/admin";
import type { Decision, ItemFilters, PeriodFilter } from "@/lib/rules";
import type {
  ClaimFormValues,
  ItemFormInput,
  ResetPasswordValues,
  SignInValues,
  SignUpValues,
  UserPatchValues,
} from "@/lib/validation";

/* ---------- Visões (dados já "juntados" para a UI) ---------- */

export type ClaimWithClaimant = Claim & { claimant: User };

/** Reivindicação com o item (retrato atual) e o reivindicante. */
export type ClaimView = ClaimWithClaimant & { item: Item };

/**
 * O que o usuário atual pode fazer neste item, calculado pelo serviço com a lista COMPLETA de
 * reivindicações (a UI não recebe reivindicações alheias, mas recebe o motivo de cada bloqueio:
 * `allowed: false` traz `code` e `message` em pt-BR).
 */
export interface ItemViewerPermissions {
  /** Botão "É meu" (RF04). */
  claim: Decision;
  /** Editar (administração; item Devolvido é somente leitura). */
  edit: Decision;
  /** Excluir (idem). */
  delete: Decision;
  /** Registrar devolução (administração, com reivindicação aceita). */
  registerReturn: Decision;
}

/**
 * Item como o VISITANTE o recebe (P26): sem `storedAt` ("onde está guardado") e sem `createdById`
 * (quem registrou é dado pessoal e não é público).
 */
export type PublicItemView = Omit<Item, "storedAt" | "createdById">;

/**
 * Item como a UI o recebe: `PublicItemView` mais `storedAt` e `createdById` OPCIONAIS. Visitantes não recebem
 * nenhum dos dois; usuários logados recebem `createdById`; `storedAt` (local de guarda) é PRIVADO e só a
 * administração e quem tem reivindicação aceita neste item (aguardando devolução) o recebem; para os demais a
 * chave é ausente (mesmo criador ou reivindicante pendente/recusado). Um `Item` é um `ItemView` válido.
 */
export type ItemView = PublicItemView & { storedAt?: string; createdById?: string };

export interface ItemDetail {
  item: ItemView;
  /** Quem registrou o item. `null` para visitante (P26); usuário logado sempre recebe. */
  createdBy: PublicUser | null;
  /** Reivindicações do usuário atual neste item (mais recente primeiro). */
  myClaims: Claim[];
  /** Todas as reivindicações do item — preenchido só para a administração, senão `[]`. */
  claims: ClaimWithClaimant[];
  /** Presente quando o item foi devolvido (somente quem pode ver devoluções: administração). */
  returnRecord: ReturnRecord | null;
  /** Permissões do usuário atual sobre este item, com motivo quando negadas. */
  viewer: ItemViewerPermissions;
}

export interface ReturnView extends ReturnRecord {
  item: Item;
  returnedTo: User;
  registeredBy: PublicUser;
}

/** Perfis de entrada rápida: usuário com e-mail institucional, usuário externo e administração. */
export const DEMO_PROFILE_KEYS = ["user", "admin"] as const;
export type DemoProfileKey = (typeof DEMO_PROFILE_KEYS)[number];

export interface DemoProfile {
  key: DemoProfileKey;
  /** Rótulo do botão, ex.: "Usuário (e-mail institucional)". */
  label: string;
  user: User;
}

/* ---------- Entradas ---------- */

/** `photo`: arquivo escolhido. Na edição, `undefined` mantém a foto atual e `null` remove. */
export type ItemInput = ItemFormInput & { photo?: File | null };
export type ClaimInput = ClaimFormValues;

/** Perfil devolvido pelo Google, JÁ verificado no servidor. */
export interface GoogleProfile {
  email: string;
  name: string;
}

/** Resultado de `signIn`: sessão aberta ou, com 2FA ligado, desafio (nenhuma sessão ainda). */
export type SignInResult = { status: "signed_in"; user: User } | TwoFactorChallenge;

export type GoogleSignInResult =
  | { status: "signed_in"; user: User }
  /** Conta com 2FA ligado: nenhuma sessão ainda. A UI pede o código e chama `verifyTwoFactor`. */
  | TwoFactorChallenge
  /**
   * Conta nova (qualquer domínio): nada foi criado. A UI mostra os termos e chama
   * `signInWithGoogle(credential, { acceptedTerms: true })` OU `completeGoogleSignUp({ ticket, acceptedTerms: true })`.
   * `ticket` é um valor OPACO (a UI só o repassa); na API é o `profileToken` assinado pelo servidor, que prova o
   * perfil verificado por poucos minutos. O vínculo (institucional/externo) sai do domínio do e-mail.
   */
  | { status: "needs_terms"; profile: GoogleProfile; ticket: string };

export interface GoogleSignUpInput {
  /** `ticket` recebido em `needs_terms`. */
  ticket: string;
  /** Aceite dos termos de uso (sempre obrigatório). */
  acceptedTerms: boolean;
}

/** Confirmação para excluir a conta: `password` (conta com senha) ou `credential` (ID token Google recente, conta só-Google). */
export interface DeleteAccountConfirmation {
  password?: string;
  credential?: string;
}

/**
 * Resultado de "enviar e-mail" (verificação, redefinição). Em API real é sempre `{}`.
 * `devLink` existe APENAS no mock ("ambiente simulado"): o link que iria no e-mail, para a UI exibir.
 */
export interface EmailDispatch {
  devLink?: string;
}

/** Uma mensagem de e-mail simulada pendente (só mock). */
export interface SimulatedEmail {
  kind: "verify_email" | "reset_password";
  devLink: string;
}

/** Cópia dos dados pessoais do usuário atual (LGPD: GET /me/export; mesmo formato do backend `campuslost-export-v1`). */
export interface MyDataExport {
  format: string;
  exportedAt: string;
  account: {
    id: string;
    name: string;
    email: string;
    role: Role;
    /** Vínculo pelo domínio do e-mail (não verificado). */
    affiliation: Affiliation;
    /** `password` ou `google`. */
    provider: string;
    createdAt: string | null;
    emailVerifiedAt: string | null;
    termsAcceptedAt: string | null;
    termsVersion: string | null;
  };
  /** Itens registrados por ele. */
  itemsRegistered: Item[];
  claims: (Claim & { itemTitle: string | null })[];
  returns: (ReturnRecord & { role: "returnedTo" | "registeredBy" })[];
  /** Sessões (só a API; o mock devolve `[]`). */
  sessions: { id: string; createdAt: string | null; expiresAt: string | null; revokedAt: string | null }[];
}

/* ---------- Serviços ---------- */

export interface AuthService {
  /** Sessão atual ou `null`. Sobrevive ao recarregamento da página (AC01.4). */
  getCurrentUser(): Promise<User | null>;
  /**
   * Cria conta com senha e abre sessão. NÃO há campo de papel: a conta nasce `user` (um `role` enviado é ignorado) e o
   * vínculo (`institutional`/`externo`) é derivado do DOMÍNIO do e-mail, sem verificação. Exige `acceptedTerms: true`.
   * Política de senha: mín. 10 caracteres, máx. 72 bytes UTF-8, fora da lista de comuns, diferente de e-mail/nome.
   * A conta nasce NÃO verificada (`emailVerified: false`): não cadastra item nem reivindica até verificar
   * (`EMAIL_NOT_VERIFIED`). `EMAIL_TAKEN` se o e-mail já existe (AC01.1).
   */
  signUp(input: SignUpValues): Promise<User>;
  /**
   * Confirma o e-mail pelo token do link (POST /auth/verify-email, responde `{verified:true}`). Não exige
   * sessão; depois, releia `getCurrentUser()` para ver `emailVerified`. `TOKEN_INVALID` (a API usa um código só
   * para inválido/expirado; o mock também pode lançar `TOKEN_EXPIRED` — trate os dois igual).
   */
  verifyEmail(token: string): Promise<void>;
  /** Reenvia o e-mail de verificação ao usuário atual (POST /auth/resend-verification). Já verificado: sem efeito. */
  resendVerification(turnstileToken?: string): Promise<EmailDispatch>;
  /** Pede o link de redefinição (POST /auth/forgot-password). Sempre "sucesso", exista a conta ou não. */
  forgotPassword(email: string, turnstileToken?: string): Promise<EmailDispatch>;
  /** Define a nova senha com o token do link (POST /auth/reset-password). `TOKEN_INVALID` / `TOKEN_EXPIRED` / `VALIDATION`. */
  resetPassword(token: ResetPasswordValues["token"], password: ResetPasswordValues["password"]): Promise<void>;
  /** Exporta os dados do usuário atual (GET /me/export). */
  exportMyData(): Promise<MyDataExport>;
  /**
   * Anonimiza a conta do usuário atual e encerra a sessão (DELETE /me): o nome vira "Usuário removido", o e-mail
   * é liberado, os itens ficam, reivindicações em aberto são encerradas e seus textos apagados. Confirmação:
   * `password` (conta com senha) ou `credential` (ID token Google recente, conta só-Google); errada =
   * `INVALID_CREDENTIALS`. A única conta de administração não pode ser excluída (`CONFLICT`).
   */
  deleteMyAccount(confirmation?: DeleteAccountConfirmation): Promise<void>;
  /**
   * [Somente mock] E-mail simulado mais recente ainda pendente de verificação do usuário atual, para a UI
   * mostrar a caixa "ambiente simulado" mesmo após recarregar. Na API não existe.
   */
  peekSimulatedEmail?(): Promise<SimulatedEmail | null>;
  /**
   * Entra com e-mail + senha (P29). E-mail inexistente, senha errada ou conta criada só pelo Google
   * lançam o MESMO erro `INVALID_CREDENTIALS` ("E-mail ou senha incorretos."), sem revelar qual (AC01.2).
   * Conta desativada (e senha certa): `ACCOUNT_DISABLED`. Conta com 2FA ligado: `{ status: "needs_2fa",
   * challengeToken }` e NENHUMA sessão; a UI pede o código e chama `verifyTwoFactor`.
   */
  signIn(input: SignInValues): Promise<SignInResult>;
  /**
   * Conclui o login do 2FA (POST /auth/2fa/verify): `challengeToken` + `code` (6 dígitos do aplicativo) OU
   * `recoveryCode` (`xxxxx-xxxxx`, uso único). Código errado: `INVALID_CREDENTIALS` com `fieldErrors.code`;
   * desafio expirado (5 min) ou inválido: `UNAUTHENTICATED` (a UI volta ao login); conta desativada:
   * `ACCOUNT_DISABLED`. Abre a sessão e devolve o usuário.
   */
  verifyTwoFactor(input: { challengeToken: string; code?: string; recoveryCode?: string }): Promise<User>;
  /**
   * Gera um segredo novo, ainda INATIVO (POST /auth/2fa/setup); chamar de novo troca o pendente. A UI desenha
   * o QR a partir de `otpauthUri` e mostra `secret` para digitação manual. `CONFLICT` se o 2FA já está ligado.
   */
  setupTwoFactor(): Promise<TwoFactorSetup>;
  /**
   * Confere o primeiro código e liga o 2FA (POST /auth/2fa/enable). Devolve os códigos de recuperação, que
   * aparecem SÓ desta vez. Código errado: `VALIDATION` com `fieldErrors.code`; `CONFLICT` sem `setup` prévio
   * ou já ligado. Depois, releia o usuário (`twoFactorEnabled`).
   */
  enableTwoFactor(code: string): Promise<TwoFactorEnabled>;
  /**
   * Desliga o 2FA (POST /auth/2fa/disable). `password` é exigida só de conta com senha; `code` aceita um TOTP
   * atual OU um código de recuperação. Falha: `INVALID_CREDENTIALS` (`fieldErrors.password`), 2FA continua ligado.
   */
  disableTwoFactor(input: { password?: string; code: string }): Promise<void>;
  /**
   * Aceita o convite de administração (POST /auth/accept-invite): cria uma conta `admin` com e-mail verificado e
   * SEM 2FA (o `/admin/*` exigirá ativá-lo: `TWO_FACTOR_REQUIRED`) e abre a sessão. `TOKEN_INVALID` (usado,
   * revogado, expirado ou desconhecido), `VALIDATION` (nome/senha), `EMAIL_TAKEN`. `acceptedTerms` é aceito
   * mas ignorado: o convite não apresenta os termos.
   */
  acceptInvite(input: { token: string; name: string; password: string; acceptedTerms?: boolean }): Promise<User>;
  /**
   * "Entrar com Google" (P30). Recebe o ID token BRUTO (`credential`) do Google Identity Services; a
   * verificação (assinatura, `aud`, `iss`, `exp`, `email_verified`) é feita no servidor (FastAPI; no mock, pela
   * rota `/api/auth/google` do Next).
   * Conta existente: abre sessão (`signed_in`) ou pede o 2FA (`needs_2fa`). Conta nova (qualquer domínio): sem
   * `acceptedTerms` responde `needs_terms` (nada criado; a UI mostra os termos e chama `completeGoogleSignUp` com o
   * `ticket`); com `acceptedTerms: true` cria a conta (`user`, já verificada) e abre sessão (`signed_in`).
   */
  signInWithGoogle(credential: string, options?: { acceptedTerms?: boolean }): Promise<GoogleSignInResult>;
  /**
   * Conclui o cadastro via Google (sem senha) e abre sessão, com o `ticket` de `needs_terms` e `acceptedTerms`.
   * `VALIDATION` (`fieldErrors.acceptedTerms`),
   * `UNAUTHENTICATED` se o ticket expirou/é inválido; `EMAIL_TAKEN` se já existe conta.
   */
  completeGoogleSignUp(input: GoogleSignUpInput): Promise<User>;
  /** [Somente protótipo] Entra com um dos perfis de demonstração (AC01.3). */
  signInAsDemo(profile: DemoProfileKey): Promise<User>;
  /** [Somente protótipo] Perfis de entrada rápida. */
  listDemoProfiles(): Promise<DemoProfile[]>;
  signOut(): Promise<void>;
}

export interface ItemService {
  /**
   * Busca (pública, P26: funciona sem login). Nunca devolve itens Devolvidos; mais recentes primeiro
   * por padrão. Filtros combinam entre si (AC03.x). `storedAt` só vem para a administração e para quem tem reivindicação aceita no item aguardando devolução; visitante também não recebe `createdById`.
   */
  list(filters?: ItemFilters): Promise<ItemView[]>;
  /**
   * Detalhe (público, P26). Sem `storedAt` para quem não tem permissão (administração ou reivindicante aceito); visitante: sem `createdById`, `createdBy: null`, `myClaims`/`claims` vazios, sem devolução e
   * `viewer.*` negado com `UNAUTHENTICATED`; item Devolvido é `NOT_FOUND` para ele.
   */
  get(id: string): Promise<ItemDetail>;
  /** Usuário logado com e-mail verificado (`EMAIL_NOT_VERIFIED`). Nasce Disponível. */
  create(input: ItemInput): Promise<Item>;
  /** Somente administração; item Devolvido é somente leitura. */
  update(id: string, input: ItemInput): Promise<Item>;
  /** Somente administração; item Devolvido não pode ser excluído. Remove também suas reivindicações. */
  delete(id: string): Promise<void>;
}

export interface ClaimService {
  /** Usuário (`user`) com e-mail verificado. Item Disponível passa a Em reivindicação. */
  create(itemId: string, input: ClaimInput): Promise<Claim>;
  /** Reivindicações do usuário atual, mais recentes primeiro. */
  listMine(): Promise<ClaimView[]>;
  /** Administração: pendentes, da mais antiga para a mais nova. */
  listPending(): Promise<ClaimView[]>;
  /** Administração: todas as reivindicações de um item, mais antigas primeiro. */
  listByItem(itemId: string): Promise<ClaimView[]>;
  /** Administração, ou o próprio reivindicante. */
  get(claimId: string): Promise<ClaimView>;
  /** Administração. Recusa automaticamente as demais; item continua Em reivindicação. */
  accept(claimId: string): Promise<ClaimDecisionResult>;
  /** Administração. Se não restar reivindicação ativa, o item volta a Disponível. */
  reject(claimId: string): Promise<ClaimDecisionResult>;
}

export interface ClaimDecisionResult {
  claim: Claim;
  item: Item;
  /** Reivindicações recusadas automaticamente por causa do aceite. */
  autoRejectedIds: string[];
}

export interface ReturnService {
  /**
   * Administração. Exige reivindicação aceita; item → Devolvido. A devolução não é desfeita.
   * O destinatário é o autor da reivindicação aceita.
   */
  register(itemId: string): Promise<ReturnView>;
  /** Administração. Período sobre a data da devolução; mais recentes primeiro. Sem exportação. */
  list(period?: PeriodFilter): Promise<ReturnView[]>;
}

/**
 * Os dados da demonstração sobrevivem a recarregar a página (`durable`) ou se perdem ao recarregar
 * (`volatile`: o navegador não oferece onde guardá-los).
 */
export type DemoPersistence = "durable" | "volatile";

/** [Somente protótipo] */
export interface DemoService {
  /** Restaura os dados de seed (datas relativas a hoje). Mantém a sessão se o usuário ainda existir. Na API: `NOT_FOUND` se o servidor não está em modo de demonstração. */
  reset(): Promise<void>;
  /**
   * Se os dados desta demonstração serão guardados ou se serão perdidos ao recarregar (a UI avisa no
   * segundo caso). Síncrono e sem custo: só consulta o que a implementação já sabe.
   */
  persistence(): DemoPersistence;
}

/** Filtros de `AdminService.listUsers`. `status`: `active` | `disabled`. */
export interface ListUsersFilters {
  q?: string;
  role?: Role;
  affiliation?: Affiliation;
  status?: UserStatusFilter;
  page?: number;
  pageSize?: number;
}
export interface ListAuditFilters {
  action?: string;
  actor?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Administração (`/admin/*`, API.md §4.8). Exige papel `admin` (`FORBIDDEN`) E 2FA ligado
 * (`TWO_FACTOR_REQUIRED`; no mock, a conta demo da administração é isenta, como o backend em `DEMO_MODE`).
 * Listas paginadas: `page` a partir de 1, `pageSize` 1-100 (padrão 20); parâmetro inválido = `VALIDATION`.
 */
export interface AdminService {
  /** `q` (trecho de nome ou e-mail), `role` (user|admin), `affiliation`, `status`. Mais recentes primeiro. Contas excluídas (LGPD) não aparecem. */
  listUsers(filters?: ListUsersFilters): Promise<Page<AdminUserRow>>;
  /**
   * PATCH /admin/users/{id}: `role` e/ou `active`. `CONFLICT` ao mexer na própria conta ou ao rebaixar/desativar o
   * último admin ativo; `NOT_FOUND`; `VALIDATION`. Desativar derruba as sessões da pessoa na hora.
   */
  updateUser(id: string, patch: UserPatchValues): Promise<AdminUserRow>;
  /**
   * Cria um convite de uso único (48 h). Um novo convite para o mesmo e-mail revoga o anterior. `EMAIL_TAKEN` se já
   * há conta. O token só vai no e-mail: a API não o devolve; o mock devolve o link simulado em `devLink`.
   */
  createInvite(email: string): Promise<CreatedInvite>;
  /** Mais recentes primeiro; `status` ∈ pending | accepted | revoked | expired. */
  listInvites(filters?: { page?: number; pageSize?: number }): Promise<Page<AdminInvite>>;
  /** Revoga (idempotente). `NOT_FOUND`; `CONFLICT` se já foi aceito. */
  revokeInvite(id: string): Promise<void>;
  /** Trilha de auditoria, mais recentes primeiro. Filtros: `action` (exato), `actor` (id do usuário). Sem dados sensíveis. */
  listAuditLog(filters?: ListAuditFilters): Promise<Page<AuditEntry>>;
}

export interface Services {
  auth: AuthService;
  items: ItemService;
  claims: ClaimService;
  returns: ReturnService;
  admin: AdminService;
  /** [Somente protótipo] Uma API real pode omitir. */
  demo: DemoService;
  /**
   * Avisa quando os dados mudam (nesta aba ou, no mock, em outra aba), para a UI refazer a leitura
   * sem recarregar a página (AC04.8). Na API, que não notifica, o aviso vem após cada mudança feita por esta
   * aba e por releitura periódica leve (só com a aba visível). Devolve a função de cancelamento.
   */
  subscribe(listener: () => void): () => void;
}
