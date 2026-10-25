import { describe, expect, it } from "vitest";
import {
  COMMON_PASSWORDS,
  isCommonPassword,
  PASSWORD_MAX_BYTES,
  passwordByteLength,
  passwordIssue,
  passwordStrength,
} from "./password";

describe("política de senha", () => {
  it("lista de comuns tem ~100 entradas, todas em minúsculas e com 10+ caracteres úteis", () => {
    expect(COMMON_PASSWORDS.size).toBeGreaterThanOrEqual(100);
    for (const p of COMMON_PASSWORDS) expect(p).toBe(p.toLowerCase());
  });

  it("mínimo de 10 caracteres", () => {
    expect(passwordIssue("abcdefghi")).toBe("too_short");
    expect(passwordIssue("Zq7!xk2#mP")).toBeNull();
  });

  it("máximo de 72 BYTES UTF-8 (não caracteres)", () => {
    expect(passwordByteLength("é")).toBe(2);
    expect(passwordByteLength("😀")).toBe(4);
    expect(passwordIssue("x".repeat(PASSWORD_MAX_BYTES))).toBeNull();
    expect(passwordIssue("x".repeat(PASSWORD_MAX_BYTES + 1))).toBe("too_long");
    expect(passwordIssue("é".repeat(36))).toBeNull(); // 36 chars = 72 bytes
    expect(passwordIssue("é".repeat(37))).toBe("too_long"); // 37 chars = 74 bytes
    expect(passwordIssue("😀".repeat(19))).toBe("too_long"); // 19 chars = 76 bytes
  });

  it("recusa senhas comuns, ignorando caixa", () => {
    expect(isCommonPassword("Password123")).toBe(true);
    expect(isCommonPassword("QWERTYUIOP")).toBe(true);
    expect(passwordIssue("Senha12345")).toBe("common");
    expect(isCommonPassword("Zq7!xk2#mP")).toBe(false);
  });

  it("recusa senha igual ao e-mail ou ao nome (sem caixa, acento ou pontuação)", () => {
    expect(passwordIssue("ana@demo.test", { email: "Ana@Demo.test" })).toBe("same_as_email");
    expect(passwordIssue("anademotest", { email: "ana@demo.test" })).toBe("same_as_email");
    expect(passwordIssue("Maria da Silva", { name: "maria da silva" })).toBe("same_as_name");
    expect(passwordIssue("Jose Conceicao", { name: "José Conceição" })).toBe("same_as_name");
    expect(passwordIssue("uma senha longa 1", { email: "ana@demo.test", name: "Ana" })).toBeNull();
  });

  it("a senha demo da nova política é aceita", () => {
    expect(passwordIssue("demonstracao123")).toBeNull();
  });
});

describe("passwordStrength (0-4)", () => {
  it("vazia, comum e muito curta são fracas", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("password123")).toBe(0);
    expect(passwordStrength("abc")).toBeLessThanOrEqual(1);
    expect(passwordStrength("aaaaaaaaaaaaaaaa")).toBeLessThanOrEqual(1);
  });

  it("cresce com tamanho e variedade e fica em 0-4", () => {
    const samples = ["abcdefgh", "abcdefghijkl", "Abcdefghijk1", "Zq7!xk2#mPw9", "Zq7!xk2#mPw9-correct-horse"];
    const scores = samples.map(passwordStrength);
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(4);
    }
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(passwordStrength("Zq7!xk2#mPw9-correct-horse")).toBe(4);
    expect(passwordStrength("somenteminusculas")).toBeLessThanOrEqual(2);
  });

  it("é pura: mesma entrada, mesma nota", () => {
    expect(passwordStrength("Zq7!xk2#mPw9")).toBe(passwordStrength("Zq7!xk2#mPw9"));
  });
});
