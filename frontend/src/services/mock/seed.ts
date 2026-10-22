/**
 * Seed reproduzível do protótipo. TODOS os dados abaixo são fictícios e
 * demonstrativos (nomes, itens, locais; ver `DEMO_DATA_NOTICE`). Os locais usados
 * são apenas os do catálogo demonstrativo. Datas são relativas a `now`.
 */
import type { AuthProvider, Claim, Item, ReturnRecord, User, UserRole } from "@/types/domain";
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

export interface Db {
  /** Versão do formato persistido; muda junto com a chave do store. */
  version: number;
  users: User[];
  credentials: CredentialRecord[];
  items: Item[];
  claims: Claim[];
  returns: ReturnRecord[];
}

/**
 * v2: o seed ganhou fotos ilustrativas (`/seed/*.svg`, P27). v3: login por senha e Google (P29/P30;
 * `credentials` no banco). Subir a versão troca a chave do armazenamento e faz navegadores com o
 * seed antigo receberem o novo (o antigo é removido).
 */
export const DB_VERSION = 3;

/** Senha de demonstração das 5 contas `@demo.test` (P29). NÃO é segredo: é dado fictício. */
export const DEMO_PASSWORD = "demo12345";

/** Hashes PBKDF2-SHA-256 (100k iterações) de `DEMO_PASSWORD`, precomputados e determinísticos (conferidos em teste). */
const DEMO_CREDENTIALS: CredentialRecord[] = [
  ["user-marina", "2d71da00f3c7893f8974e8d965ea415c6812a50b0d38292f1ae398fe0fee1af4"],
  ["user-rafael", "3f72ca3aa59882bbe9687058cce02dd2175c1b8467bd61229d9c411288f920c3"],
  ["user-admin", "bb09f06fe05f62800ad57b83932bfb076bda344a0b1a5a81f03d5dd95f4ec801"],
  ["user-lucas", "d7e8e9bd3a8d417026e58d88df5c84cb162de557bb581b6688fe6c7a0cb08a17"],
  ["user-beatriz", "453ae177f84d5256eef00a206d1ab6baf93797759306cca193ee224561bb2ca1"],
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
export const DEMO_PROFILE_IDS: Readonly<Record<UserRole, string>> = {
  student: "user-marina",
  teacher: "user-rafael",
  admin: "user-admin",
};

export const DEMO_PROFILE_LABELS: Readonly<Record<UserRole, string>> = {
  student: "Entrar como aluno",
  teacher: "Entrar como professor",
  admin: "Entrar como administração",
};

const USERS: User[] = [
  { id: "user-marina", name: "Marina Alves", email: "marina@demo.test", role: "student" },
  { id: "user-rafael", name: "Rafael Lima", email: "rafael@demo.test", role: "teacher" },
  { id: "user-admin", name: "Administração Demo", email: "admin@demo.test", role: "admin" },
  // Usuários de apoio (autores de reivindicações); não aparecem como perfis de demonstração.
  { id: "user-lucas", name: "Lucas Prado", email: "lucas@demo.test", role: "student" },
  { id: "user-beatriz", name: "Beatriz Nunes", email: "beatriz@demo.test", role: "student" },
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
      photoDataUrl: "/seed/fones-de-ouvido.svg",
      description: "Fones intra-auriculares brancos, com estojo de carregamento pequeno.",
      category: "Eletrônicos",
      foundLocation: "Biblioteca",
      storedAt: "Biblioteca",
      status: "available",
      createdById: "user-rafael",
    }),
    item(2, 26, 1, {
      title: "Carteira de estudante",
      photoDataUrl: "/seed/carteira-de-estudante.svg",
      description: "Carteira de estudante dentro de uma capinha transparente, encontrada no chão.",
      category: "Documentos",
      foundLocation: "Portaria",
      storedAt: "Portaria",
      status: "available",
      createdById: "user-admin",
    }),
    item(3, 50, 2, {
      title: "Chaveiro com três chaves",
      photoDataUrl: "/seed/chaveiro.svg",
      description: "Chaveiro de borracha vermelho com três chaves, sendo uma delas de cadeado.",
      category: "Chaves",
      foundLocation: "Bloco A",
      storedAt: "Portaria",
      status: "under_claim",
      createdById: "user-lucas",
    }),
    item(7, 74, 3, {
      title: "Calculadora científica",
      photoDataUrl: "/seed/calculadora.svg",
      description: "Calculadora científica preta com capa deslizante e arranhões na tampa.",
      category: "Eletrônicos",
      foundLocation: "Bloco A",
      storedAt: "Portaria",
      status: "under_claim",
      createdById: "user-lucas",
    }),
    item(4, 98, 4, {
      title: "Casaco azul-marinho",
      photoDataUrl: "/seed/casaco.svg",
      description: "Casaco de moletom azul-marinho, tamanho M, com capuz e bolso frontal.",
      category: "Roupas",
      foundLocation: "Cantina",
      storedAt: "Portaria",
      status: "available",
      createdById: "user-beatriz",
    }),
    item(5, 122, 5, {
      title: "Notebook cinza",
      photoDataUrl: "/seed/notebook.svg",
      description: "Notebook cinza de 14 polegadas, sem capa, com adesivos na tampa.",
      category: "Eletrônicos",
      foundLocation: "Biblioteca",
      storedAt: "Portaria",
      status: "under_claim",
      createdById: "user-rafael",
    }),
    item(6, 146, 6, {
      title: "Garrafa térmica verde",
      photoDataUrl: "/seed/garrafa-termica.svg",
      description: "Garrafa térmica de aço verde-escuro, 500 ml, com amassado perto da tampa.",
      category: "Outros",
      foundLocation: "Cantina",
      storedAt: "Cantina",
      status: "available",
      createdById: "user-admin",
    }),
    item(8, 194, 8, {
      title: "Guarda-chuva preto",
      photoDataUrl: "/seed/guarda-chuva.svg",
      description: "Guarda-chuva preto automático com cabo curvo de madeira.",
      category: "Outros",
      foundLocation: "Portaria",
      storedAt: "Portaria",
      status: "available",
      createdById: "user-marina",
    }),
    item(10, 218, 9, {
      title: "Mochila preta",
      photoDataUrl: "/seed/mochila.svg",
      description: "Mochila preta com zíper azul e um chaveiro de pelúcia pendurado.",
      category: "Outros",
      foundLocation: "Bloco A",
      storedAt: "Entregue ao dono",
      status: "returned",
      createdById: "user-admin",
    }),
    item(9, 266, 11, {
      title: "Óculos de grau",
      photoDataUrl: "/seed/oculos.svg",
      description: "Óculos de grau com armação preta retangular, dentro de um estojo cinza.",
      category: "Outros",
      foundLocation: "Cantina",
      storedAt: "Portaria",
      status: "available",
      createdById: "user-rafael",
    }),
    item(11, 362, 15, {
      title: "Carregador USB-C",
      photoDataUrl: "/seed/carregador.svg",
      description: "Carregador de parede branco com cabo USB-C de 1 metro enrolado.",
      category: "Eletrônicos",
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

  return { version: DB_VERSION, users: USERS.map((u) => ({ ...u })),
    credentials: DEMO_CREDENTIALS.map((c) => ({ ...c })),
    items, claims, returns };
}
