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
 * Códigos `NETWORK`, `CONFLICT` e `RATE_LIMITED` de `ServiceError` são reservados para a API; o mock só lança
 * `NETWORK` na verificação do Google (rota de servidor inacessível).
 */
import type {
  Claim,
  Item,
  PublicUser,
  ReturnRecord,
  GoogleSignupRole,
  User,
  UserRole,
} from "@/types/domain";
import type { Decision, ItemFilters, PeriodFilter } from "@/lib/rules";
import type { ClaimFormValues, ItemFormValues, ResetPasswordValues, SignInValues, SignUpValues } from "@/lib/validation";

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
 * Item como a UI o recebe: `PublicItemView` mais `storedAt` e `createdById` OPCIONAIS. Visitantes
 * não os recebem; usuários logados sempre recebem ambos (um `Item` completo é um `ItemView` válido).
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

export interface DemoProfile {
  role: UserRole;
  /** Rótulo do botão, ex.: "Entrar como aluno". */
  label: string;
  user: User;
}

/* ---------- Entradas ---------- */

/** `photo`: arquivo escolhido. Na edição, `undefined` mantém a foto atual e `null` remove. */
export type ItemInput = ItemFormValues & { photo?: File | null };
export type ClaimInput = ClaimFormValues;

/** Perfil devolvido pelo Google, JÁ verificado no servidor. */
export interface GoogleProfile {
  email: string;
  name: string;
}

export type GoogleSignInResult =
  | { status: "signed_in"; user: User }
  /**
   * Conta nova com e-mail FORA do domínio institucional: nada foi criado. A UI mostra os termos e chama
   * `signInWithGoogle(credential, { acceptedTerms: true })` OU `completeGoogleSignUp({ ticket, acceptedTerms: true })`.
   */
  | { status: "needs_terms"; profile: GoogleProfile; ticket: string }
  /**
   * Conta nova: nada foi criado. `ticket` é um valor OPACO (a UI só o repassa a `completeGoogleSignUp`);
   * na API é o `profileToken` assinado pelo servidor, que prova o perfil verificado por poucos minutos.
   */
  | { status: "needs_role"; profile: GoogleProfile; ticket: string };

export interface GoogleSignUpInput {
  /** `ticket` recebido em `needs_role` ou `needs_terms`. */
  ticket: string;
  /** Obrigatório no domínio institucional (`needs_role`); ignorado fora dele (a conta vira `external`). */
  role?: GoogleSignupRole;
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
    role: UserRole;
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
   * Cria conta (aluno/professor/comunidade externa) com senha e abre sessão. Exige `acceptedTerms: true`.
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
   */
  signIn(input: SignInValues): Promise<User>;
  /**
   * "Entrar com Google" (P30). Recebe o ID token BRUTO (`credential`) do Google Identity Services; a
   * verificação (assinatura, `aud`, `iss`, `exp`, `email_verified`) é feita no servidor (FastAPI; no mock, pela
   * rota `/api/auth/google` do Next).
   * Conta existente: abre sessão (`signed_in`). E-mail FORA do domínio institucional: cria a conta como
   * `external` (já verificada): sem `acceptedTerms` responde `needs_terms` (nada criado); com `acceptedTerms: true`
   * cria a conta e abre sessão (`signed_in`). Conta nova DENTRO do domínio: `needs_role`
   * (nada é criado ainda) e a UI pede aluno/professor e chama `completeGoogleSignUp` com o `ticket`.
   */
  signInWithGoogle(credential: string, options?: { acceptedTerms?: boolean }): Promise<GoogleSignInResult>;
  /**
   * Conclui o cadastro via Google (sem senha) e abre sessão, usando o `ticket` de `needs_role` (domínio
   * institucional: exige `role` aluno/professor + `acceptedTerms`) ou de `needs_terms` (exige só `acceptedTerms`;
   * a conta vira `external`). `VALIDATION` (`fieldErrors.role` / `fieldErrors.acceptedTerms`),
   * `UNAUTHENTICATED` se o ticket expirou/é inválido; `EMAIL_TAKEN` se já existe conta.
   */
  completeGoogleSignUp(input: GoogleSignUpInput): Promise<User>;
  /** [Somente protótipo] Entra com um dos perfis de demonstração (AC01.3). */
  signInAsDemo(role: UserRole): Promise<User>;
  /** [Somente protótipo] Perfis de entrada rápida. */
  listDemoProfiles(): Promise<DemoProfile[]>;
  signOut(): Promise<void>;
}

export interface ItemService {
  /**
   * Busca (pública, P26: funciona sem login). Nunca devolve itens Devolvidos; mais recentes primeiro
   * por padrão. Filtros combinam entre si (AC03.x). Para visitante, `storedAt` e `createdById` vêm ausentes.
   */
  list(filters?: ItemFilters): Promise<ItemView[]>;
  /**
   * Detalhe (público, P26). Visitante: sem `storedAt`/`createdById`, `createdBy: null`, `myClaims`/`claims` vazios, sem devolução e
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
  /** Aluno/professor/externo com e-mail verificado. Item Disponível passa a Em reivindicação. */
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

export interface Services {
  auth: AuthService;
  items: ItemService;
  claims: ClaimService;
  returns: ReturnService;
  /** [Somente protótipo] Uma API real pode omitir. */
  demo: DemoService;
  /**
   * Avisa quando os dados mudam (nesta aba ou, no mock, em outra aba), para a UI refazer a leitura
   * sem recarregar a página (AC04.8). Na API, que não notifica, o aviso vem após cada mudança feita por esta
   * aba e por releitura periódica leve (só com a aba visível). Devolve a função de cancelamento.
   */
  subscribe(listener: () => void): () => void;
}
