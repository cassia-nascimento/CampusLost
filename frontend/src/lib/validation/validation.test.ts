import { describe, expect, it } from "vitest";
import { PASSWORD_ISSUE_MESSAGE, isOtherCategory } from "@/lib/rules";
import {
  claimSchema,
  createItemSchema,
  itemFiltersSchema,
  periodSchema,
  googleSignUpSchema,
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  deleteAccountSchema,
  toFieldErrors,
  validatePhotoFile,
  PHOTO_MAX_BYTES,
  CLAIM_PROOF_MAX,
  CLAIM_WHERE_WHEN_MAX,
  ITEM_DESCRIPTION_MAX,
  ITEM_STORED_AT_MAX,
  ITEM_LOCATION_MAX,
  ITEM_CATEGORY_OTHER_MAX,
  ITEM_TITLE_MAX,
} from "./index";

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe("cadastro e login (AC01.1, AC01.2)", () => {
  const valid = { name: "Ana Souza", email: "ana@demo.test", password: "uma senha longa 1", acceptedTerms: true };

  it("aceita dados válidos e normaliza e-mail/nome", () => {
    const r = signUpSchema.parse({ ...valid, name: "  Ana Souza ", email: "  ANA@Demo.Test ", password: " senha de teste 123 " });
    expect(r).toEqual({ ...valid, password: " senha de teste 123 " });
  });

  it("aceita só os papéis de usuário e administração", () => {
    for (const role of ["student", "teacher", "external"]) expect(signUpSchema.safeParse({ ...valid, role }).success).toBe(true);
  });

  it("exige nome e e-mail válido; um `role` enviado é ignorado (nunca cria admin)", () => {
    expect(signUpSchema.parse({ ...valid, role: "admin" })).not.toHaveProperty("role");
    expect(Object.keys(signUpSchema.parse({ ...valid, role: "admin", affiliation: "institutional" })).sort()).toEqual(["acceptedTerms", "email", "name", "password"]);
    const r = signUpSchema.safeParse({ name: "", email: "nao-e-email" });
    expect(r.success).toBe(false);
    const errors = toFieldErrors(r.error!);
    expect(errors.name).toBe("Informe seu nome.");
    expect(errors.email).toBe("Esse e-mail não parece válido. Use o formato nome@exemplo.com.");
    expect(errors.role).toBeUndefined();
  });

  it("termos: acceptedTerms precisa ser true", () => {
    for (const acceptedTerms of [false, undefined, "true", 1]) {
      const r = signUpSchema.safeParse({ ...valid, acceptedTerms });
      expect(r.success).toBe(false);
      expect(toFieldErrors(r.error!).acceptedTerms).toBe("Aceite os termos de uso para criar a conta.");
    }
  });

  it("senha: obrigatória, mín. 10 caracteres, máx. 72 BYTES, sem trim", () => {
    const err = (password: unknown) => toFieldErrors(signUpSchema.safeParse({ ...valid, password }).error!).password;
    expect(err(undefined)).toBe("Crie uma senha.");
    expect(err("")).toBe("Crie uma senha.");
    expect(err("123456789")).toBe("Use pelo menos 10 caracteres.");
    expect(err("a".repeat(73))).toBe(PASSWORD_ISSUE_MESSAGE.too_long);
    expect(signUpSchema.safeParse({ ...valid, password: "a".repeat(72) }).success).toBe(true);
    // 37 x "é" = 37 caracteres, 74 bytes
    expect(err("é".repeat(37))).toBe(PASSWORD_ISSUE_MESSAGE.too_long);
    expect(signUpSchema.safeParse({ ...valid, password: "é".repeat(36) }).success).toBe(true); // 72 bytes
    expect(signUpSchema.safeParse({ ...valid, password: " ".repeat(10) }).success).toBe(true); // espaços contam
  });

  it("senha: recusa senhas comuns (sem diferenciar caixa) e igual ao e-mail/nome", () => {
    const err = (over: object) => toFieldErrors(signUpSchema.safeParse({ ...valid, ...over }).error!).password;
    expect(err({ password: "Password123" })).toBe(PASSWORD_ISSUE_MESSAGE.common);
    expect(err({ password: "1234567890" })).toBe(PASSWORD_ISSUE_MESSAGE.common);
    expect(err({ password: "ana@demo.test" })).toBe(PASSWORD_ISSUE_MESSAGE.same_as_email);
    expect(err({ password: "ANA@DEMO.TEST" })).toBe(PASSWORD_ISSUE_MESSAGE.same_as_email);
    expect(err({ name: "Maria da Silva", password: "Maria da Silva" })).toBe(PASSWORD_ISSUE_MESSAGE.same_as_name);
    expect(err({ name: "José Conceição", password: "josé conceição" })).toBe(PASSWORD_ISSUE_MESSAGE.same_as_name);
  });

  it("campos ausentes têm mensagem de obrigatório em pt-BR", () => {
    const errors = toFieldErrors(signUpSchema.safeParse({}).error!);
    expect(errors).toEqual({
      name: "Informe seu nome.",
      email: "Informe seu e-mail.",
      password: "Crie uma senha.",
      acceptedTerms: "Aceite os termos de uso para criar a conta.",
    });
  });

  it("esqueci/redefinir/verificar: e-mail, token e a mesma política de senha", () => {
    expect(forgotPasswordSchema.parse({ email: " A@B.co " })).toEqual({ email: "a@b.co" });
    expect(forgotPasswordSchema.safeParse({ email: "x" }).success).toBe(false);
    expect(resetPasswordSchema.parse({ token: " abc ", password: "uma senha longa 1" })).toEqual({ token: "abc", password: "uma senha longa 1" });
    const e = toFieldErrors(resetPasswordSchema.safeParse({ token: "", password: "curta" }).error!);
    expect(e).toEqual({ token: "Link inválido ou incompleto.", password: "Use pelo menos 10 caracteres." });
    expect(toFieldErrors(resetPasswordSchema.safeParse({ token: "t", password: "senha12345" }).error!).password).toBe(PASSWORD_ISSUE_MESSAGE.common);
    expect(verifyEmailSchema.safeParse({ token: "" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({}).success).toBe(true);
  });

  it("e-mail e senha vazios no login", () => {
    expect(toFieldErrors(signInSchema.safeParse({ email: "  " }).error!)).toEqual({
      email: "Informe seu e-mail.",
      password: "Informe sua senha.",
    });
    expect(signInSchema.safeParse({ email: "A@b.co", password: "x" }).data).toEqual({ email: "a@b.co", password: "x" });
  });

  it("cadastro via Google: só perfil e aceite dos termos (sem papel)", () => {
    expect(googleSignUpSchema.safeParse({ email: "A@undb.edu.br", name: "Ana", role: "admin", acceptedTerms: true }).data).toEqual({
      email: "a@undb.edu.br",
      name: "Ana",
      acceptedTerms: true,
    });
    expect(googleSignUpSchema.safeParse({ email: "a@undb.edu.br", name: "Ana", acceptedTerms: false }).success).toBe(false);
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
    expect(toFieldErrors(r.error!)).toEqual({ foundDate: "A data não pode ser no futuro." });
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

  it("categoria deve estar na lista demonstrativa", () => {
    const errors = toFieldErrors(schema.safeParse({ ...valid, category: "Joias" }).error!);
    expect(errors.category).toBe("Escolha uma categoria.");
  });

  describe("local encontrado (texto livre, 3–120)", () => {
    it("aceita texto livre, inclusive o exemplo longo, e apara espaços", () => {
      const example = "Bloco C, segundo andar, próximo ao laboratório 04";
      expect(schema.parse({ ...valid, foundLocation: example }).foundLocation).toBe(example);
      expect(schema.parse({ ...valid, foundLocation: "  Lua  " }).foundLocation).toBe("Lua");
      expect(schema.safeParse({ ...valid, foundLocation: "l".repeat(ITEM_LOCATION_MAX) }).success).toBe(true);
    });

    it("mensagens: vazio, só espaços, ausente, curto e longo", () => {
      const msg = (foundLocation: unknown) => toFieldErrors(schema.safeParse({ ...valid, foundLocation }).error!).foundLocation;
      expect(msg("")).toBe("Informe o local onde foi encontrado.");
      expect(msg("     ")).toBe("Informe o local onde foi encontrado.");
      expect(msg(undefined)).toBe("Informe o local onde foi encontrado.");
      expect(msg("ab")).toBe("Use pelo menos 3 caracteres.");
      expect(msg("l".repeat(ITEM_LOCATION_MAX + 1))).toBe("Use no máximo 120 caracteres.");
    });
  });

  describe("categoria Outros e categoryOther", () => {
    it("Outros exige categoryOther (3–40, com trim)", () => {
      const msg = (categoryOther: unknown) =>
        toFieldErrors(schema.safeParse({ ...valid, category: "Outros", categoryOther }).error!).categoryOther;
      expect(msg(undefined)).toBe("Especifique a categoria.");
      expect(msg(null)).toBe("Especifique a categoria.");
      expect(msg("")).toBe("Especifique a categoria.");
      expect(msg("    ")).toBe("Especifique a categoria.");
      expect(msg("ab")).toBe("Use pelo menos 3 caracteres.");
      expect(msg("c".repeat(ITEM_CATEGORY_OTHER_MAX + 1))).toBe("Use no máximo 40 caracteres.");
      expect(schema.parse({ ...valid, category: "Outros", categoryOther: "  Mochila escolar " }).categoryOther).toBe("Mochila escolar");
      expect(schema.safeParse({ ...valid, category: "Outros", categoryOther: "c".repeat(ITEM_CATEGORY_OTHER_MAX) }).success).toBe(true);
    });

    it("categoria predefinida descarta categoryOther (trocar de Outros não deixa dado inconsistente)", () => {
      expect(schema.parse({ ...valid, category: "Roupas", categoryOther: "Mochila escolar" }).categoryOther).toBeNull();
      expect(schema.parse({ ...valid, category: "Roupas" }).categoryOther).toBeNull();
      // texto que deixou de valer não gera erro
      expect(schema.safeParse({ ...valid, category: "Roupas", categoryOther: "x" }).success).toBe(true);
    });

    it("o erro de categoryOther aparece junto dos demais", () => {
      const errors = toFieldErrors(schema.safeParse({ ...valid, title: "", category: "Outros" }).error!);
      expect(Object.keys(errors).sort()).toEqual(["categoryOther", "title"]);
    });

    it("isOtherCategory só vale para Outros", () => {
      expect(isOtherCategory("Outros")).toBe(true);
      expect(isOtherCategory("Roupas")).toBe(false);
      expect(isOtherCategory("")).toBe(false);
      expect(isOtherCategory(undefined)).toBe(false);
    });
  });

  describe("storedAt obrigatório", () => {
    it("vazio, só espaços, null ou ausente são recusados com a mensagem de obrigatório", () => {
      for (const storedAt of ["", "   ", null, undefined]) {
        const result = schema.safeParse({ ...valid, storedAt });
        expect(result.success).toBe(false);
        expect(toFieldErrors(result.error!).storedAt).toBe("Informe onde o item está guardado.");
      }
      const { storedAt: _s, ...without } = valid;
      void _s;
      expect(toFieldErrors(schema.safeParse(without).error!).storedAt).toBe("Informe onde o item está guardado.");
    });

    it("apara e exige 3–120 caracteres", () => {
      expect(schema.parse({ ...valid, storedAt: "  Armário 2 " }).storedAt).toBe("Armário 2");
      expect(toFieldErrors(schema.safeParse({ ...valid, storedAt: "ab" }).error!).storedAt).toBe("Use pelo menos 3 caracteres.");
      expect(toFieldErrors(schema.safeParse({ ...valid, storedAt: "  ab  " }).error!).storedAt).toBe("Use pelo menos 3 caracteres.");
      expect(toFieldErrors(schema.safeParse({ ...valid, storedAt: "x".repeat(121) }).error!).storedAt).toBe("Use no máximo 120 caracteres.");
      expect(schema.safeParse({ ...valid, storedAt: "abc" }).success).toBe(true);
      expect(schema.safeParse({ ...valid, storedAt: "x".repeat(120) }).success).toBe(true);
    });
  });

  it("valida arquivo de foto (formato e tamanho)", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validatePhotoFile({ type: "image/png", size: PHOTO_MAX_BYTES })).toBeNull();
    expect(validatePhotoFile({ type: "image/gif", size: 1000 })).toMatch(/Formato/);
    expect(validatePhotoFile({ type: "application/pdf", size: 1000 })).toMatch(/Formato/);
    expect(validatePhotoFile({ type: "image/jpeg", size: PHOTO_MAX_BYTES + 1 })).toBe("A foto passa de 10 MB. Escolha uma menor.");
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

  it("mensagens pt-BR nos valores inválidos (I3)", () => {
    const errors = toFieldErrors(
      itemFiltersSchema.safeParse({ category: "Joias", location: "l".repeat(121), status: "returned", sort: "random" }).error!,
    );
    expect(errors).toEqual({
      category: "Categoria inválida.",
      location: "Use no máximo 120 caracteres.",
      status: "Situação inválida.",
      sort: "Ordenação inválida.",
    });
  });

  it("local do filtro é texto livre (apara; vazio vira sem filtro)", () => {
    expect(itemFiltersSchema.parse({ location: "  Lua  " }).location).toBe("Lua");
    expect(itemFiltersSchema.parse({ location: "   " }).location).toBeUndefined();
  });

  it("não aceita status Devolvido na busca", () => {
    expect(itemFiltersSchema.safeParse({ status: "returned" }).success).toBe(false);
  });
});

describe("limites exportados (usados nos maxLength dos formulários)", () => {
  it("coincidem com o que os schemas aceitam e recusam", () => {
    const schema = createItemSchema(() => "2026-10-19");
    const valid = {
      title: "Casaco azul",
      description: "Casaco azul-marinho com capuz.",
      category: "Roupas",
      foundLocation: "Cantina",
      foundDate: "2026-10-19",
      storedAt: "Portaria",
    };
    expect([ITEM_TITLE_MAX, ITEM_DESCRIPTION_MAX, ITEM_STORED_AT_MAX, ITEM_LOCATION_MAX, ITEM_CATEGORY_OTHER_MAX]).toEqual([80, 500, 120, 120, 40]);
    expect(schema.safeParse({ ...valid, title: "t".repeat(ITEM_TITLE_MAX) }).success).toBe(true);
    expect(schema.safeParse({ ...valid, title: "t".repeat(ITEM_TITLE_MAX + 1) }).success).toBe(false);
    expect(schema.safeParse({ ...valid, description: "d".repeat(ITEM_DESCRIPTION_MAX) }).success).toBe(true);
    expect(schema.safeParse({ ...valid, storedAt: "s".repeat(ITEM_STORED_AT_MAX) }).success).toBe(true);
    expect(schema.safeParse({ ...valid, storedAt: "s".repeat(ITEM_STORED_AT_MAX + 1) }).success).toBe(false);
    expect([CLAIM_PROOF_MAX, CLAIM_WHERE_WHEN_MAX]).toEqual([500, 300]);
    expect(claimSchema.safeParse({ proofDetails: "x".repeat(CLAIM_PROOF_MAX), lostWhereWhen: "y".repeat(CLAIM_WHERE_WHEN_MAX) }).success).toBe(true);
    expect(claimSchema.safeParse({ proofDetails: "x".repeat(CLAIM_PROOF_MAX), lostWhereWhen: "y".repeat(CLAIM_WHERE_WHEN_MAX + 1) }).success).toBe(false);
  });
});
