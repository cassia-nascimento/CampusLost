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
 * Códigos `NETWORK` e `CONFLICT` de `ServiceError` são reservados para a API; o mock não os lança.
 */
import type {
  Claim,
  Item,
  PublicUser,
  ReturnRecord,
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

export interface ItemDetail {
  item: Item;
  createdBy: PublicUser;
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

/* ---------- Serviços ---------- */

export interface AuthService {
  /** Sessão atual ou `null`. Sobrevive ao recarregamento da página (AC01.4). */
  getCurrentUser(): Promise<User | null>;
  /** Cria conta (aluno/professor) e abre sessão. `EMAIL_TAKEN` se o e-mail já existe (AC01.1). */
  signUp(input: SignUpValues): Promise<User>;
  /** Entra pelo e-mail. `USER_NOT_FOUND` se não houver conta (AC01.2). Senha não existe no protótipo. */
  signIn(input: SignInValues): Promise<User>;
  /** [Somente protótipo] Entra com um dos perfis de demonstração (AC01.3). */
  signInAsDemo(role: UserRole): Promise<User>;
  /** [Somente protótipo] Perfis de entrada rápida. */
  listDemoProfiles(): Promise<DemoProfile[]>;
  signOut(): Promise<void>;
}

export interface ItemService {
  /**
   * Busca (requer login). Nunca devolve itens Devolvidos; mais recentes primeiro por padrão.
   * Filtros combinam entre si (AC03.x).
   */
  list(filters?: ItemFilters): Promise<Item[]>;
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
  /** Restaura os dados de seed (datas relativas a hoje). Mantém a sessão se o usuário ainda existir. */
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
   * sem recarregar a página (AC04.8). Devolve a função de cancelamento.
   */
  subscribe(listener: () => void): () => void;
}
