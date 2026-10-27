/**
 * Seed reproduzível do protótipo. TODOS os dados abaixo são fictícios e
 * demonstrativos (nomes, itens, locais; ver `DEMO_DATA_NOTICE`). Os locais usados
 * são apenas os do catálogo demonstrativo. Datas são relativas a `now`.
 */
import type { AuthProvider, Claim, Item, ReturnRecord, User } from "@/types/domain";
import type { DemoProfileKey } from "../contracts";
import { addDays, addHours, toLocalDateString } from "@/lib/rules/dates";

/** Aviso para a interface: todo o conteúdo do seed é fictício. */
export const DEMO_DATA_NOTICE =
  "Dados fictícios de demonstração (pessoas, itens e locais); não representam o campus real.";

/**
 * Registro de credenciais (SEPARADO de `User`; nunca sai do serviço). Em uma API real isto fica
 * no servidor. `password`: PBKDF2-SHA-256 (`salt` e `hash` em hexadecimal). `google`: sem senha.
 */
export interface CredentialRecord {
  userId: string;
  provider: AuthProvider;
  salt?: string;
  hash?: string;
  iterations?: number;
}

export type TokenKind = "verify_email" | "reset_password";

export interface TokenRecord {
  token: string;
  userId: string;
  kind: TokenKind;
  /** Instante ISO 8601 (UTC). */
  expiresAt: string;
  /** Preenchido quando o token foi usado (uso único). */
  usedAt?: string;
}

/** Metadados da conta (fora de `User`, que é o que a UI recebe): criação, desativação e exclusão (LGPD). */
export interface AccountMeta {
  userId: string;
  createdAt: string;
  /** Preenchido quando a administração desativou a conta (não entra; sessões caem). */
  disabledAt?: string;
  /** Preenchido quando a conta foi excluída/anonimizada (`DELETE /me`); some da lista de usuários. */
  deletedAt?: string;
}

/** Estado do 2FA de um usuário (segredo em claro: é um mock; o backend também guarda o segredo no banco). */
export interface TwoFactorRecord {
  userId: string;
  secret: string;
  /** Ausente = segredo pendente (após `setup`, antes de `enable`). */
  enabledAt?: string;
  /** Último passo de 30 s aceito (anti-reuso). */
  lastStep?: number;
  /** SHA-1 (hex) dos códigos de recuperação; `usedAt` quando consumido. */
  recoveryCodes: { hash: string; usedAt?: string }[];
}

export interface InviteRecord {
  id: string;
  email: string;
  /** Token do link (guardado em claro só porque é mock; a API guarda o hash). */
  token: string;
  invitedById: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  revokedAt?: string;
}

export interface AuditRecord {
  id: string;
  at: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
}

/**
 * Código de retirada de uma reivindicação aceita (um registro por reivindicação; gerar de novo o substitui).
 * Guarda SÓ o hash (SHA-256 de `claimId:CÓDIGO`); o código em claro existe apenas na resposta de `issueReturnCode`.
 */
export interface ReturnCodeRecord {
  id: string;
  claimId: string;
  itemId: string;
  codeHash: string;
  issuedAt: string;
  /** Erros seguidos desde a última conferência certa ou bloqueio (zera ao bloquear). */
  failedAttempts: number;
  lockedUntil: string | null;
  verifiedAt: string | null;
  verifiedById: string | null;
  /** Preenchido quando a conferência foi consumida pela confirmação da entrega (uso único). */
  usedAt: string | null;
}

export interface Db {
  /** Versão do formato persistido; muda junto com a chave do store. */
  version: number;
  users: User[];
  credentials: CredentialRecord[];
  /** Tokens de verificação de e-mail e de redefinição de senha (o "e-mail" é simulado). */
  tokens: TokenRecord[];
  items: Item[];
  claims: Claim[];
  returns: ReturnRecord[];
  /** Códigos de retirada (só hash). */
  returnCodes: ReturnCodeRecord[];
  accounts: AccountMeta[];
  twoFactor: TwoFactorRecord[];
  invites: InviteRecord[];
  /** Trilha de auditoria (mais antigos primeiro; limitada a `AUDIT_LIMIT`). */
  audit: AuditRecord[];
}

/** O mock guarda só os eventos mais recentes (cota do `localStorage`). */
export const AUDIT_LIMIT = 500;

/**
 * v2: o seed ganhou fotos ilustrativas (`/seed/*.svg|webp`, P27). v3: login por senha e Google (P29/P30;
 * `credentials` no banco). Subir a versão troca a chave do armazenamento e faz navegadores com o
 * seed antigo receberem o novo (o antigo é removido).
 * v4: papel `external`, `emailVerified` no usuário, política de senha nova (senha demo `demonstracao123`) e `tokens`
 * (verificação de e-mail e redefinição de senha).
 * v6: papéis `user`/`admin` e `affiliation` (vínculo pelo domínio do e-mail). Contas antigas do mock NÃO são migradas:
 * o banco v5 é descartado e o seed novo o substitui.
 * v7: o seed trocou a "Carteira de estudante" por "Boné bege" e 9 dos 11 itens passaram a usar fotos reais
 * (`/seed/*.webp`). O banco v6 é descartado.
 * v8: `categoryOther` nos itens ("Outros" traz a especificação), `foundLocation` virou texto livre e `storedAt` é
 * opcional/privado (só a administração o recebe). O banco v7 é descartado.
 * v9: `returnCodes` (código de retirada: só o hash; a entrega exige a conferência). O banco v8 é descartado.
 * v10: as fotos de `mochila` e `carregador` substituíram as ilustrações SVG; o banco v9 é descartado.
 * v5: administração (`accounts`, `invites`, `audit`) e 2FA (`twoFactor`); papel/estado de conta desativada.
 */
export const DB_VERSION = 10;

/** Contas isentas da exigência de 2FA em `/admin/*` (a conta demo, como o backend em `DEMO_MODE`). */
export const TWO_FACTOR_EXEMPT_USER_IDS: readonly string[] = ["user-admin"];

/** Senha de demonstração das 6 contas `@demo.test` (P29). NÃO é segredo: é dado fictício. */
export const DEMO_PASSWORD = "demonstracao123";

/** Hashes PBKDF2-SHA-256 (100k iterações) de `DEMO_PASSWORD`, precomputados e determinísticos (conferidos em teste). */
const DEMO_CREDENTIALS: CredentialRecord[] = [
  ["user-marina", "3fff9fae49ecea9354070a3ad2aa49c6d1d38a298336d2f4c31633d295a59e5e"],
  ["user-rafael", "37c390b1bfa623cd78676781a0fa10b28928df5c51b6578b6ac03bc9dddb6b51"],
  ["user-admin", "51f297ece5cd5fedd2564cbba926d8a6974482a15279f2df024867dd1419ccd1"],
  ["user-lucas", "be246cdb8005c9c6ba46f884b7e1116c58e9a47cea6062c1acbdc492be5c26ba"],
  ["user-beatriz", "7392898bbac067c5c06c8381aa72b9528ce5d4971891b90b22dea1aa8a41d6e1"],
  ["user-externo", "548252f8c2434e07164f50b0d2703049cd40c49b00d252eecd6800f488304ffd"],
].map(([userId, hash]) => ({
  userId,
  provider: "password" as const,
  // sal fixo por usuário só no seed (reprodutível); contas novas usam sal aleatório
  salt: demoSalt(userId),
  hash,
  iterations: 100_000,
}));

/** Sal determinístico das contas de demonstração: UTF-8 de `campuslost-demo-salt:<id>` em hexadecimal. */
export function demoSalt(userId: string): string {
  return Array.from(new TextEncoder().encode(`campuslost-demo-salt:${userId}`), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Perfis de entrada rápida (AC01.3). Os demais usuários do seed existem, mas não são atalhos. */
export const DEMO_PROFILE_IDS: Readonly<Record<DemoProfileKey, string>> = {
  user: "user-marina",
  admin: "user-admin",
};

export const DEMO_PROFILE_LABELS: Readonly<Record<DemoProfileKey, string>> = {
  user: "Usuário",
  admin: "Administração",
};

const USERS: User[] = [
  { id: "user-marina", name: "Marina Alves", email: "marina@demo.test", role: "user", affiliation: "institutional", emailVerified: true, hasPassword: true },
  { id: "user-rafael", name: "Rafael Lima", email: "rafael@demo.test", role: "user", affiliation: "institutional", emailVerified: true, hasPassword: true },
  { id: "user-admin", name: "Administração Demo", email: "admin@demo.test", role: "admin", affiliation: "institutional", emailVerified: true, hasPassword: true },
  { id: "user-externo", name: "Camila Torres", email: "externo@demo.test", role: "user", affiliation: "external", emailVerified: true, hasPassword: true },
  // Usuários de apoio (autores de reivindicações); não aparecem como perfis de demonstração.
  { id: "user-lucas", name: "Lucas Prado", email: "lucas@demo.test", role: "user", affiliation: "institutional", emailVerified: true, hasPassword: true },
  { id: "user-beatriz", name: "Beatriz Nunes", email: "beatriz@demo.test", role: "user", affiliation: "institutional", emailVerified: true, hasPassword: true },
  // Conta desativada (só Google): aparece na administração com status "desativada".
  { id: "user-tiago", name: "Tiago Rocha", email: "tiago@demo.test", role: "user", affiliation: "institutional", emailVerified: true, hasPassword: false },
];

export function buildSeed(now: Date): Db {
  const day = (daysAgo: number) => toLocalDateString(addDays(now, -daysAgo));
  const at = (hoursAgo: number) => addHours(now, -hoursAgo).toISOString();

  const item = (
    n: number,
    createdHoursAgo: number,
    foundDaysAgo: number,
    rest: Omit<Item, "id" | "createdAt" | "foundDate">,
  ): Item => ({
    id: `item-${String(n).padStart(2, "0")}`,
    createdAt: at(createdHoursAgo),
    foundDate: day(foundDaysAgo),
    ...rest,
  });

  const items: Item[] = [
    item(1, 3, 0, {
      title: "Fones de ouvido sem fio",
      photoDataUrl: "/seed/fones-de-ouvido.webp",
      description: "Fones intra-auriculares brancos, com estojo de carregamento pequeno.",
      category: "Eletrônicos",
      categoryOther: null,
      foundLocation: "Biblioteca",
      storedAt: "Biblioteca",
      status: "available",
      createdById: "user-rafael",
    }),
    item(2, 26, 1, {
      title: "Boné bege",
      photoDataUrl: "/seed/bone.webp",
      description: "Boné bege com um bordado verde na frente, encontrado no pátio.",
      category: "Roupas",
      categoryOther: null,
      foundLocation: "Portaria",
      storedAt: "Portaria",
      status: "available",
      createdById: "user-admin",
    }),
    item(3, 50, 2, {
      title: "Chaveiro com três chaves",
      photoDataUrl: "/seed/chaveiro.webp",
      description: "Chaveiro de borracha vermelho com três chaves, sendo uma delas de cadeado.",
      category: "Chaves",
      categoryOther: null,
      foundLocation: "Bloco A",
      storedAt: "Portaria",
      status: "under_claim",
      createdById: "user-lucas",
    }),
    item(7, 74, 3, {
      title: "Calculadora científica",
      photoDataUrl: "/seed/calculadora.webp",
      description: "Calculadora científica preta com capa deslizante e arranhões na tampa.",
      category: "Eletrônicos",
      categoryOther: null,
      foundLocation: "Bloco A",
      storedAt: "Portaria",
      status: "under_claim",
      createdById: "user-lucas",
    }),
    item(4, 98, 4, {
      title: "Casaco azul-marinho",
      photoDataUrl: "/seed/casaco.webp",
      description: "Casaco de moletom azul-marinho, tamanho M, com capuz e bolso frontal.",
      category: "Roupas",
      categoryOther: null,
      foundLocation: "Cantina",
      storedAt: "Portaria",
      status: "available",
      createdById: "user-beatriz",
    }),
    item(5, 122, 5, {
      title: "Notebook cinza",
      photoDataUrl: "/seed/notebook.webp",
      description: "Notebook cinza de 14 polegadas, sem capa, com adesivos na tampa.",
      category: "Eletrônicos",
      categoryOther: null,
      foundLocation: "Biblioteca",
      storedAt: "Portaria",
      status: "under_claim",
      createdById: "user-rafael",
    }),
    item(6, 146, 6, {
      title: "Garrafa térmica verde",
      photoDataUrl: "/seed/garrafa-termica.webp",
      description: "Garrafa térmica de aço verde-escuro, 500 ml, com amassado perto da tampa.",
      category: "Outros",
      categoryOther: "Garrafa térmica",
      foundLocation: "Cantina",
      storedAt: "Cantina",
      status: "available",
      createdById: "user-admin",
    }),
    item(8, 194, 8, {
      title: "Guarda-chuva preto",
      photoDataUrl: "/seed/guarda-chuva.webp",
      description: "Guarda-chuva preto automático com cabo curvo de madeira.",
      category: "Outros",
      categoryOther: "Guarda-chuva",
      foundLocation: "Portaria",
      storedAt: "Portaria",
      status: "available",
      createdById: "user-marina",
    }),
    item(10, 218, 9, {
      title: "Mochila preta",
      photoDataUrl: "/seed/mochila.webp",
      description: "Mochila preta com zíper azul e um chaveiro de pelúcia pendurado.",
      category: "Outros",
      categoryOther: "Mochila escolar",
      foundLocation: "Bloco A",
      storedAt: "Entregue ao dono",
      status: "returned",
      createdById: "user-admin",
    }),
    item(9, 266, 11, {
      title: "Óculos de grau",
      photoDataUrl: "/seed/oculos.webp",
      description: "Óculos de grau com armação preta retangular, dentro de um estojo cinza.",
      category: "Outros",
      categoryOther: "Óculos de grau",
      foundLocation: "Cantina",
      storedAt: "Portaria",
      status: "available",
      createdById: "user-rafael",
    }),
    item(11, 362, 15, {
      title: "Carregador USB-C",
      photoDataUrl: "/seed/carregador.webp",
      description: "Carregador de parede branco com cabo USB-C de 1 metro enrolado.",
      category: "Eletrônicos",
      categoryOther: null,
      foundLocation: "Biblioteca",
      storedAt: "Entregue ao dono",
      status: "returned",
      createdById: "user-admin",
    }),
  ];

  const claim = (
    n: number,
    itemN: number,
    claimantId: string,
    createdHoursAgo: number,
    status: Claim["status"],
    reviewedHoursAgo: number | null,
    proofDetails: string,
    lostWhereWhen: string,
  ): Claim => ({
    id: `claim-${String(n).padStart(2, "0")}`,
    itemId: `item-${String(itemN).padStart(2, "0")}`,
    claimantId,
    proofDetails,
    lostWhereWhen,
    status,
    createdAt: at(createdHoursAgo),
    ...(reviewedHoursAgo === null ? {} : { reviewedAt: at(reviewedHoursAgo) }),
  });

  const claims: Claim[] = [
    // item-03: duas pendentes (usuários diferentes, AC04.3)
    claim(1, 3, "user-beatriz", 20, "pending", null,
      "Uma das chaves é de um cadeado de armário e tem um risco de esmalte azul.",
      "Perdi no Bloco A, ontem à tarde."),
    claim(2, 3, "user-rafael", 8, "pending", null,
      "O chaveiro tem uma etiqueta de fita branca com as iniciais RL.",
      "Provavelmente caiu do meu bolso no Bloco A, ontem."),
    // item-04: única reivindicação recusada -> item voltou a Disponível (AC04.6/AC04.7)
    claim(3, 4, "user-marina", 80, "rejected", 60,
      "É um casaco azul de moletom.",
      "Perdi na Cantina na semana passada."),
    // item-05: uma aceita e uma recusada automaticamente (AC04.5)
    claim(4, 5, "user-marina", 100, "accepted", 40,
      "O adesivo maior na tampa é de uma banda; a tecla Esc está um pouco solta.",
      "Esqueci na Biblioteca, no começo da semana passada, de manhã."),
    claim(5, 5, "user-lucas", 90, "rejected", 40,
      "Notebook cinza com adesivos.",
      "Não lembro exatamente, acho que foi na biblioteca."),
    // item-07: duas pendentes, uma delas da demo aluna
    claim(6, 7, "user-marina", 30, "pending", null,
      "A capa deslizante está sem um dos cantos e tem meu sobrenome escrito a lápis por dentro.",
      "Deixei no Bloco A, na terça à tarde."),
    claim(7, 7, "user-beatriz", 12, "pending", null,
      "Calculadora preta com arranhões.",
      "Bloco A, não sei dizer o dia."),
    // devolvidos
    claim(8, 10, "user-beatriz", 190, "accepted", 130,
      "O chaveiro de pelúcia é um gatinho cinza com um olho descosturado.",
      "Esqueci no Bloco A, em uma aula de manhã."),
    claim(9, 11, "user-rafael", 330, "accepted", 300,
      "O cabo tem uma fita isolante preta perto da ponta do conector.",
      "Deixei ligado na Biblioteca, no fim da tarde."),
  ];

  const returns: ReturnRecord[] = [
    {
      id: "return-01",
      itemId: "item-10",
      claimId: "claim-08",
      returnedToId: "user-beatriz",
      registeredById: "user-admin",
      returnedAt: at(120),
    },
    {
      id: "return-02",
      itemId: "item-11",
      claimId: "claim-09",
      returnedToId: "user-rafael",
      registeredById: "user-admin",
      returnedAt: at(288),
    },
  ];

  const accounts: AccountMeta[] = USERS.map((u, i) => ({
    userId: u.id,
    createdAt: at(24 * (60 - i * 4)),
    ...(u.id === "user-tiago" ? { disabledAt: at(24 * 3) } : {}),
  }));

  const invites: InviteRecord[] = [
    // Convites antigos só para a tela mostrar estados diferentes (o pendente nasce quando a demo cria um).
    { id: "invite-01", email: "coordenacao@demo.test", token: "seed-invite-expired-0000000000000001", invitedById: "user-admin", createdAt: at(24 * 6), expiresAt: at(24 * 4) },
    { id: "invite-02", email: "secretaria@demo.test", token: "seed-invite-revoked-0000000000000002", invitedById: "user-admin", createdAt: at(30), expiresAt: at(-18), revokedAt: at(20) },
  ];

  const event = (
    n: number,
    hoursAgo: number,
    actorId: string | null,
    action: string,
    target: [string, string] | null,
    metadata: AuditRecord["metadata"] = null,
  ): AuditRecord => ({
    id: `audit-${String(n).padStart(2, "0")}`,
    at: at(hoursAgo),
    actorId,
    action,
    targetType: target ? target[0] : null,
    targetId: target ? target[1] : null,
    metadata,
  });
  const audit: AuditRecord[] = [
    event(1, 290, "user-admin", "return.register", ["item", "item-11"], { returnId: "return-02", claimId: "claim-09" }),
    event(2, 130, "user-admin", "return.register", ["item", "item-10"], { returnId: "return-01", claimId: "claim-08" }),
    event(3, 72, null, "login.failure", null, { method: "password", emailRef: "0a1b2c3d4e5f" }),
    event(4, 72, "user-admin", "user.disable", ["user", "user-tiago"]),
    event(5, 40, "user-admin", "claim.accept", ["claim", "claim-04"], { itemId: "item-05", autoRejected: 1 }),
    event(6, 30, "user-admin", "invite.create", ["invite", "invite-02"], { emailRef: "5f4e3d2c1b0a" }),
    event(7, 20, "user-admin", "invite.revoke", ["invite", "invite-02"]),
    event(8, 2, "user-admin", "login.success", ["user", "user-admin"], { method: "demo" }),
  ];

  return { version: DB_VERSION, users: USERS.map((u) => ({ ...u })),
    credentials: [...DEMO_CREDENTIALS.map((c) => ({ ...c })), { userId: "user-tiago", provider: "google" as const }],
    tokens: [],
    items, claims, returns, returnCodes: [],
    accounts, twoFactor: [], invites, audit };
}
