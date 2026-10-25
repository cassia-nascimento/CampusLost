import type { Claim, Item, User } from "@/types/domain";

export const NOW = new Date(2026, 9, 19, 10, 0, 0); // 19/10/2026 10:00 local

export const student: User = { id: "u-student", name: "Aluno Teste", email: "aluno@demo.test", role: "student", emailVerified: true };
export const otherStudent: User = { id: "u-other", name: "Outro Aluno", email: "outro@demo.test", role: "student", emailVerified: true };
export const teacher: User = { id: "u-teacher", name: "Professor Teste", email: "prof@demo.test", role: "teacher", emailVerified: true };
export const admin: User = { id: "u-admin", name: "Admin Teste", email: "admin@demo.test", role: "admin", emailVerified: true };

export function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-x",
    title: "Item de teste",
    description: "Descrição pública do item de teste.",
    category: "Outros",
    foundLocation: "Bloco A",
    foundDate: "2026-10-18",
    storedAt: "Portaria",
    status: "available",
    createdById: "u-admin",
    createdAt: "2026-10-18T12:00:00.000Z",
    ...overrides,
  };
}

export function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "claim-x",
    itemId: "item-x",
    claimantId: student.id,
    proofDetails: "Detalhes que só o dono saberia.",
    lostWhereWhen: "Bloco A, ontem.",
    status: "pending",
    createdAt: "2026-10-18T13:00:00.000Z",
    ...overrides,
  };
}

export const externalUser: User = { id: "u-external", name: "Visitante Externo", email: "externo@demo.test", role: "external", emailVerified: true };
export const unverified: User = { id: "u-unverified", name: "Sem Verificar", email: "novo@demo.test", role: "student", emailVerified: false };
