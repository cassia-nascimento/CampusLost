import { describe, expect, it } from "vitest";
import {
  claimSchema,
  createItemSchema,
  itemFiltersSchema,
  periodSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  validatePhotoFile,
  PHOTO_MAX_BYTES,
} from "./index";

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe("cadastro e login (AC01.1, AC01.2)", () => {
  it("aceita dados válidos e normaliza e-mail/nome", () => {
    const r = signUpSchema.parse({ name: "  Ana Souza ", email: "  ANA@Demo.Test ", role: "student" });
    expect(r).toEqual({ name: "Ana Souza", email: "ana@demo.test", role: "student" });
  });

  it("exige nome, e-mail válido e papel aluno/professor", () => {
    const r = signUpSchema.safeParse({ name: "", email: "nao-e-email", role: "admin" });
    expect(r.success).toBe(false);
    const errors = toFieldErrors(r.error!);
    expect(errors.name).toBe("Informe seu nome.");
    expect(errors.email).toBe("Informe um e-mail válido.");
    expect(errors.role).toBe("Escolha se você é aluno ou professor.");
  });

  it("campos ausentes têm mensagem de obrigatório em pt-BR", () => {
    const errors = toFieldErrors(signUpSchema.safeParse({}).error!);
    expect(errors).toEqual({
      name: "Informe seu nome.",
      email: "Informe o e-mail.",
      role: "Escolha se você é aluno ou professor.",
    });
  });

  it("e-mail vazio no login", () => {
    expect(toFieldErrors(signInSchema.safeParse({ email: "  " }).error!)).toEqual({ email: "Informe o e-mail." });
  });
});

describe("item (AC02.1, AC02.2)", () => {
  const schema = createItemSchema(() => "2026-10-19");
  const valid = {
    title: "Casaco azul",
    description: "Casaco azul-marinho com capuz.",
    category: "Roupas",
    foundLocation: "Cantina",
    foundDate: "2026-10-19",
    storedAt: "Portaria",
  };

  it("aceita item válido, inclusive com data de hoje", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("rejeita data futura", () => {
    const r = schema.safeParse({ ...valid, foundDate: "2026-10-20" });
    expect(toFieldErrors(r.error!)).toEqual({ foundDate: "A data não pode ser futura." });
  });

  it("rejeita data inexistente ou em formato errado", () => {
    expect(toFieldErrors(schema.safeParse({ ...valid, foundDate: "2026-02-31" }).error!).foundDate).toBe("Informe uma data válida.");
    expect(toFieldErrors(schema.safeParse({ ...valid, foundDate: "" }).error!).foundDate).toBe("Informe uma data válida.");
  });

  it("limites de tamanho", () => {
    const errors = toFieldErrors(
      schema.safeParse({
        ...valid,
        title: "ab",
        description: "curta",
        storedAt: "x".repeat(121),
      }).error!,
    );
    expect(errors.title).toBe("Use pelo menos 3 caracteres.");
    expect(errors.description).toBe("Use pelo menos 10 caracteres.");
    expect(errors.storedAt).toBe("Use no máximo 120 caracteres.");
    expect(schema.safeParse({ ...valid, title: "t".repeat(81) }).success).toBe(false);
    expect(schema.safeParse({ ...valid, description: "d".repeat(501) }).success).toBe(false);
  });

  it("espaços em branco não contam como conteúdo", () => {
    expect(toFieldErrors(schema.safeParse({ ...valid, title: "     " }).error!).title).toBe("Informe um título.");
  });

  it("categoria e local devem estar nas listas demonstrativas", () => {
    const errors = toFieldErrors(schema.safeParse({ ...valid, category: "Joias", foundLocation: "Lua" }).error!);
    expect(errors.category).toBe("Escolha uma categoria.");
    expect(errors.foundLocation).toBe("Escolha o local onde foi encontrado.");
  });

  it("valida arquivo de foto (formato e tamanho)", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validatePhotoFile({ type: "image/png", size: PHOTO_MAX_BYTES })).toBeNull();
    expect(validatePhotoFile({ type: "image/gif", size: 1000 })).toMatch(/Formato/);
    expect(validatePhotoFile({ type: "application/pdf", size: 1000 })).toMatch(/Formato/);
    expect(validatePhotoFile({ type: "image/jpeg", size: PHOTO_MAX_BYTES + 1 })).toMatch(/máximo/);
    expect(validatePhotoFile({ type: "image/jpeg", size: 0 })).toMatch(/vazio/);
  });
});

describe("reivindicação (P7)", () => {
  it("exige as duas perguntas", () => {
    const errors = toFieldErrors(claimSchema.safeParse({ proofDetails: "", lostWhereWhen: "" }).error!);
    expect(errors.proofDetails).toBe("Informe os detalhes que só o dono saberia.");
    expect(errors.lostWhereWhen).toBe("Informe onde e quando você perdeu o item.");
  });

  it("aceita respostas válidas e aplica trim", () => {
    const r = claimSchema.parse({ proofDetails: "  Tem um adesivo azul.  ", lostWhereWhen: " Bloco A, ontem " });
    expect(r).toEqual({ proofDetails: "Tem um adesivo azul.", lostWhereWhen: "Bloco A, ontem" });
  });

  it("limites máximos", () => {
    expect(claimSchema.safeParse({ proofDetails: "x".repeat(501), lostWhereWhen: "Bloco A" }).success).toBe(false);
    expect(claimSchema.safeParse({ proofDetails: "x".repeat(20), lostWhereWhen: "y".repeat(301) }).success).toBe(false);
  });
});

describe("filtros", () => {
  it("valores vazios viram indefinidos", () => {
    const r = itemFiltersSchema.parse({ category: "", location: "", from: "", to: "", status: "", sort: "" });
    expect(r).toEqual({});
  });

  it("aceita combinação válida", () => {
    const r = itemFiltersSchema.parse({ category: "Chaves", location: "Bloco A", from: "2026-10-01", to: "2026-10-19" });
    expect(r).toMatchObject({ category: "Chaves", location: "Bloco A" });
  });

  it("rejeita categoria desconhecida e período invertido", () => {
    expect(itemFiltersSchema.safeParse({ category: "Joias" }).success).toBe(false);
    const r = itemFiltersSchema.safeParse({ from: "2026-10-19", to: "2026-10-01" });
    expect(toFieldErrors(r.error!).to).toMatch(/posterior/);
    expect(messages(periodSchema.safeParse({ from: "x" }))).toContain("Informe uma data válida.");
  });

  it("não aceita status Devolvido na busca", () => {
    expect(itemFiltersSchema.safeParse({ status: "returned" }).success).toBe(false);
  });
});
