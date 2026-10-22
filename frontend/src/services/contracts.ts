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
  SignupRole,
  User,
  UserRole,
} from "@/types/domain";
import type { Decision, ItemFilters, PeriodFilter } from "@/lib/rules";
import type { ClaimFormValues, ItemFormValues, SignInValues, SignUpValues } from "@/lib/validation";

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
   * Conta nova: nada foi criado. `ticket` é um valor OPACO (a UI só o repassa a `completeGoogleSignUp`);
   * na API é o `profileToken` assinado pelo servidor, que prova o perfil verificado por poucos minutos.
   */
  | { status: "needs_role"; profile: GoogleProfile; ticket: string };

export interface GoogleSignUpInput {
  /** `ticket` recebido em `needs_role`. */
  ticket: string;
  role: SignupRole;
}

/* ---------- Serviços ---------- */

export interface AuthService {
  /** Sessão atual ou `null`. Sobrevive ao recarregamento da página (AC01.4). */
  getCurrentUser(): Promise<User | null>;
  /**
   * Cria conta (aluno/professor) com senha (8 a 72 caracteres, P29) e abre sessão.
   * `EMAIL_TAKEN` se o e-mail já existe (AC01.1).
   */
  signUp(input: SignUpValues): Promise<User>;
  /**
   * Entra com e-mail + senha (P29). E-mail inexistente, senha errada ou conta criada só pelo Google
   * lançam o MESMO erro `INVALID_CREDENTIALS` ("E-mail ou senha incorretos."), sem revelar qual (AC01.2).
   */
  signIn(input: SignInValues): Promise<User>;
  /**
   * "Entrar com Google" (P30). Recebe o ID token BRUTO (`credential`) do Google Identity Services; a
   * verificação (assinatura, `aud`, `iss`, `exp`, `email_verified`) é feita no servidor (FastAPI; no mock, pela
   * rota `/api/auth/google` do Next). Domínio fora do institucional: `FORBIDDEN_DOMAIN`.
   * Conta existente: abre sessão (`signed_in`). Conta nova: `needs_role` (nada é criado ainda) e a UI
   * pede aluno/professor e chama `completeGoogleSignUp` com o `ticket`.
   */
  signInWithGoogle(credential: string): Promise<GoogleSignInResult>;
  /**
   * Conclui o cadastro via Google (sem senha) e abre sessão, usando o `ticket` de `needs_role`.
   * `UNAUTHENTICATED` se o ticket expirou/é inválido; `FORBIDDEN_DOMAIN` fora do domínio; `EMAIL_TAKEN` se já existe conta.
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
  /** Qualquer usuário logado. Nasce Disponível. */
  create(input: ItemInput): Promise<Item>;
  /** Somente administração; item Devolvido é somente leitura. */
  update(id: string, input: ItemInput): Promise<Item>;
  /** Somente administração; item Devolvido não pode ser excluído. Remove também suas reivindicações. */
  delete(id: string): Promise<void>;
}

export interface ClaimService {
  /** Aluno/professor. Item Disponível passa a Em reivindicação. */
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
