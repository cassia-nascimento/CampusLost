/**
 * Seed reproduzível do protótipo. TODOS os dados abaixo são fictícios e
 * demonstrativos (nomes, itens, locais). Datas são relativas a `now`.
 */
import type { Claim, Item, ReturnRecord, User, UserRole } from "@/types/domain";
import { addDays, addHours, toLocalDateString } from "@/lib/rules/dates";

export interface Db {
  /** Versão do formato persistido; muda junto com a chave do store. */
  version: number;
  users: User[];
  items: Item[];
  claims: Claim[];
  returns: ReturnRecord[];
}

export const DB_VERSION = 1;

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
      description: "Fones intra-auriculares brancos, com estojo de carregamento pequeno.",
      category: "Eletrônicos",
      foundLocation: "Biblioteca",
      storedAt: "Balcão da biblioteca",
      status: "available",
      createdById: "user-rafael",
    }),
    item(2, 26, 1, {
      title: "Carteira de estudante",
      description: "Carteira de estudante dentro de uma capinha transparente, encontrada no chão.",
      category: "Documentos",
      foundLocation: "Portaria",
      storedAt: "Portaria (gaveta de achados)",
      status: "available",
      createdById: "user-admin",
    }),
    item(3, 50, 2, {
      title: "Chaveiro com três chaves",
      description: "Chaveiro de borracha vermelho com três chaves, sendo uma delas de cadeado.",
      category: "Chaves",
      foundLocation: "Bloco A",
      storedAt: "Sala da administração",
      status: "under_claim",
      createdById: "user-lucas",
    }),
    item(7, 74, 3, {
      title: "Calculadora científica",
      description: "Calculadora científica preta com capa deslizante e arranhões na tampa.",
      category: "Eletrônicos",
      foundLocation: "Bloco A",
      storedAt: "Sala da administração",
      status: "under_claim",
      createdById: "user-lucas",
    }),
    item(4, 98, 4, {
      title: "Casaco azul-marinho",
      description: "Casaco de moletom azul-marinho, tamanho M, com capuz e bolso frontal.",
      category: "Roupas",
      foundLocation: "Cantina",
      storedAt: "Portaria (gaveta de achados)",
      status: "available",
      createdById: "user-beatriz",
    }),
    item(5, 122, 5, {
      title: "Notebook cinza",
      description: "Notebook cinza de 14 polegadas, sem capa, com adesivos na tampa.",
      category: "Eletrônicos",
      foundLocation: "Biblioteca",
      storedAt: "Sala da administração",
      status: "under_claim",
      createdById: "user-rafael",
    }),
    item(6, 146, 6, {
      title: "Garrafa térmica verde",
      description: "Garrafa térmica de aço verde-escuro, 500 ml, com amassado perto da tampa.",
      category: "Outros",
      foundLocation: "Cantina",
      storedAt: "Cantina (prateleira atrás do balcão)",
      status: "available",
      createdById: "user-admin",
    }),
    item(8, 194, 8, {
      title: "Guarda-chuva preto",
      description: "Guarda-chuva preto automático com cabo curvo de madeira.",
      category: "Outros",
      foundLocation: "Portaria",
      storedAt: "Portaria (gaveta de achados)",
      status: "available",
      createdById: "user-marina",
    }),
    item(10, 218, 9, {
      title: "Mochila preta",
      description: "Mochila preta com zíper azul e um chaveiro de pelúcia pendurado.",
      category: "Outros",
      foundLocation: "Bloco A",
      storedAt: "Entregue ao dono",
      status: "returned",
      createdById: "user-admin",
    }),
    item(9, 266, 11, {
      title: "Óculos de grau",
      description: "Óculos de grau com armação preta retangular, dentro de um estojo cinza.",
      category: "Outros",
      foundLocation: "Cantina",
      storedAt: "Sala da administração",
      status: "available",
      createdById: "user-rafael",
    }),
    item(11, 362, 15, {
      title: "Carregador USB-C",
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
      "Perdi no corredor do Bloco A, ontem à tarde."),
    claim(2, 3, "user-rafael", 8, "pending", null,
      "O chaveiro tem uma etiqueta de fita branca com as iniciais RL.",
      "Provavelmente caiu do meu bolso ao sair da sala 12, ontem."),
    // item-04: única reivindicação recusada -> item voltou a Disponível (AC04.6/AC04.7)
    claim(3, 4, "user-marina", 80, "rejected", 60,
      "É um casaco azul de moletom.",
      "Perdi na cantina na semana passada."),
    // item-05: uma aceita e uma recusada automaticamente (AC04.5)
    claim(4, 5, "user-marina", 100, "accepted", 40,
      "O adesivo maior na tampa é de uma banda; a tecla Esc está um pouco solta.",
      "Esqueci na mesa 4 da biblioteca, no começo da semana passada, de manhã."),
    claim(5, 5, "user-lucas", 90, "rejected", 40,
      "Notebook cinza com adesivos.",
      "Não lembro exatamente, acho que foi na biblioteca."),
    // item-07: duas pendentes, uma delas da demo aluna
    claim(6, 7, "user-marina", 30, "pending", null,
      "A capa deslizante está sem um dos cantos e tem meu sobrenome escrito a lápis por dentro.",
      "Deixei na carteira do laboratório do Bloco A, na terça à tarde."),
    claim(7, 7, "user-beatriz", 12, "pending", null,
      "Calculadora preta com arranhões.",
      "Bloco A, não sei dizer o dia."),
    // devolvidos
    claim(8, 10, "user-beatriz", 190, "accepted", 130,
      "O chaveiro de pelúcia é um gatinho cinza com um olho descosturado.",
      "Esqueci na sala 5 do Bloco A, em uma aula de manhã."),
    claim(9, 11, "user-rafael", 330, "accepted", 300,
      "O cabo tem uma fita isolante preta perto da ponta do conector.",
      "Deixei ligado em uma tomada da biblioteca, no fim da tarde."),
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

  return { version: DB_VERSION, users: USERS.map((u) => ({ ...u })), items, claims, returns };
}
