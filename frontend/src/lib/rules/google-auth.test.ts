import { describe, expect, it } from "vitest";
import {
  DEFAULT_GOOGLE_ALLOWED_DOMAINS,
  getAllowedGoogleDomains,
  isAllowedGoogleEmail,
  parseAllowedDomains,
} from "./google-auth";

const D = ["undb.edu.br"];

describe("isAllowedGoogleEmail (P30)", () => {
  it.each([
    "ana@undb.edu.br",
    "  ANA.Silva@UNDB.EDU.BR  ",
    "ana+tag@undb.edu.br",
    "ana@alunos.undb.edu.br",
    "ana@undb.edu.br\n", // trim
    "ana@a.b.undb.edu.br",
  ])("aceita %j", (email) => expect(isAllowedGoogleEmail(email, D)).toBe(true));

  it.each([
    "",
    "   ",
    "ana",
    "@undb.edu.br",
    "ana@",
    "ana@undb.edu.br.evil.com",
    "ana@evilundb.edu.br",
    "ana@evil-undb.edu.br",
    "ana@xundb.edu.br",
    "ana@undb.edu.br@evil.com",
    "undb.edu.br@evil.com",
    "ana@evil.com@undb.edu.br",
    "ana@@undb.edu.br",
    "ana@.undb.edu.br",
    "ana@undb.edu.br.",
    "ana@undb..edu.br",
    "ana@-undb.edu.br",
    "ana @undb.edu.br",
    "ana\n@undb.edu.br",
    "ana@undb.edu.br\n.evil.com",
    "ana@undb.edu.br, b@evil.com",
    "ana@edu.br",
    "ana@br",
    "ana@undb.edu.bs",
    "ana@undb.edu.br:8080",
    "ana@ünd b.edu.br",
    "ana@undb․edu.br",
    "ana@gmail.com",
    "Ana <ana@undb.edu.br>",
  ])("recusa %j", (email) => expect(isAllowedGoogleEmail(email, D)).toBe(false));

  it("sem domínios permitidos, recusa tudo; domínios inválidos na lista são ignorados", () => {
    expect(isAllowedGoogleEmail("a@undb.edu.br", [])).toBe(false);
    expect(isAllowedGoogleEmail("a@com", ["com"])).toBe(false);
    expect(isAllowedGoogleEmail("a@x.com", [""])).toBe(false);
  });

  it("aceita qualquer domínio da lista e normaliza a lista (caixa, @ inicial)", () => {
    expect(isAllowedGoogleEmail("a@outra.edu.br", ["undb.edu.br", " @Outra.edu.br "])).toBe(true);
    expect(isAllowedGoogleEmail("a@terceira.edu.br", ["undb.edu.br", "outra.edu.br"])).toBe(false);
  });

  it("entrada que não é string é recusada", () => {
    expect(isAllowedGoogleEmail(undefined as never, D)).toBe(false);
    expect(isAllowedGoogleEmail(null as never, D)).toBe(false);
  });
});

describe("parseAllowedDomains", () => {
  it("padrão undb.edu.br quando ausente, vazio ou sem domínio válido", () => {
    expect(DEFAULT_GOOGLE_ALLOWED_DOMAINS).toEqual(["undb.edu.br"]);
    expect(parseAllowedDomains()).toEqual(["undb.edu.br"]);
    expect(parseAllowedDomains("")).toEqual(["undb.edu.br"]);
    expect(parseAllowedDomains(" , ,")).toEqual(["undb.edu.br"]);
    expect(parseAllowedDomains("lixo, a b.c")).toEqual(["undb.edu.br"]);
  });

  it("lista separada por vírgula, normalizada, sem repetidos nem inválidos", () => {
    expect(parseAllowedDomains(" UNDB.edu.br , @outra.edu.br,undb.edu.br, x ")).toEqual(["undb.edu.br", "outra.edu.br"]);
  });

  it("o padrão devolvido é uma cópia", () => {
    parseAllowedDomains().push("x.com");
    expect(parseAllowedDomains()).toEqual(["undb.edu.br"]);
  });

  it("getAllowedGoogleDomains lê a variável de ambiente (padrão sem ela)", () => {
    const old = process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS;
    try {
      delete process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS;
      expect(getAllowedGoogleDomains()).toEqual(["undb.edu.br"]);
      process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS = "a.edu.br,b.edu.br";
      expect(getAllowedGoogleDomains()).toEqual(["a.edu.br", "b.edu.br"]);
    } finally {
      if (old === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS;
      else process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS = old;
    }
  });
});
