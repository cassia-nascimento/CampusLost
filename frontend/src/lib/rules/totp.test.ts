import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  hmacSha1,
  hotp,
  newRecoveryCodes,
  newTotpSecret,
  normalizeRecoveryCode,
  otpauthUri,
  sha1Hex,
  toHex,
  totpCode,
  totpStep,
  verifyTotp,
} from "./totp";

const enc = (text: string) => new TextEncoder().encode(text);
/** Chave de teste do RFC 6238 (SHA-1): ASCII "12345678901234567890". */
const RFC_KEY = enc("12345678901234567890");
const RFC_SECRET = base32Encode(RFC_KEY);

describe("SHA-1 e HMAC-SHA1 (RFC 3174 / RFC 2202)", () => {
  it("vetores do SHA-1", () => {
    expect(sha1Hex("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(sha1Hex("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(sha1Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("84983e441c3bd26ebaae4aa1f95129e5e54670f1");
    expect(sha1Hex("a".repeat(1000))).toBe("291e9a6c66994949b57ba5e650361e98fc36b1ba");
  });

  it("vetores do HMAC-SHA1 (inclui chave maior que o bloco)", () => {
    expect(toHex(hmacSha1(new Uint8Array(20).fill(0x0b), enc("Hi There")))).toBe("b617318655057264e28bc0b6fb378c8ef146be00");
    expect(toHex(hmacSha1(enc("Jefe"), enc("what do ya want for nothing?")))).toBe("effcdf6ae5eb2fa2d27416d5f184df9c259a7c79");
    expect(toHex(hmacSha1(new Uint8Array(80).fill(0xaa), enc("Test Using Larger Than Block-Size Key - Hash Key First")))).toBe(
      "aa4ae5e15272d00e95705637ce8a3b55ed402112",
    );
  });
});

describe("Base32 (RFC 4648)", () => {
  it("vetores e ida e volta", () => {
    expect(base32Encode(enc("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Encode(enc("f"))).toBe("MY");
    expect(new TextDecoder().decode(base32Decode("mzxw6ytboi")!)).toBe("foobar");
    expect(new TextDecoder().decode(base32Decode("MZXW 6YTB OI======")!)).toBe("foobar");
    expect(base32Decode("1!?")).toBeNull();
    const bytes = Uint8Array.from({ length: 20 }, (_, i) => i * 13);
    expect(Array.from(base32Decode(base32Encode(bytes))!)).toEqual(Array.from(bytes));
  });

  it("segredo novo: 20 bytes -> 32 caracteres base32 sem padding", () => {
    const secret = newTotpSecret(new Uint8Array(32).fill(7));
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });
});

describe("TOTP (RFC 6238, apêndice B, SHA-1, 8 dígitos)", () => {
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  it.each(vectors)("t=%i -> %s", (seconds, expected) => {
    expect(hotp(RFC_KEY, totpStep(new Date(seconds * 1000)), 8)).toBe(expected);
  });

  it("6 dígitos são os 6 últimos do valor de 8 (t=59 -> 287082)", () => {
    expect(totpCode(RFC_SECRET, new Date(59_000))).toBe("287082");
    expect(totpCode("1!?", new Date(59_000))).toBeNull();
  });

  it("HOTP (RFC 4226, apêndice D): contadores 0 a 3", () => {
    expect([0, 1, 2, 3].map((c) => hotp(RFC_KEY, c))).toEqual(["755224", "287082", "359152", "969429"]);
  });
});

describe("verifyTotp: janela de ±1 passo e anti-reuso", () => {
  const at = (seconds: number) => new Date(seconds * 1000);
  // passo 1 = [30, 60); o código de t=59 vale para o passo 1
  const code = "287082";

  it("aceita o passo atual, o anterior e o seguinte; rejeita o resto", () => {
    expect(verifyTotp(RFC_SECRET, code, at(59))).toBe(1);
    expect(verifyTotp(RFC_SECRET, code, at(89))).toBe(1); // um passo depois
    expect(verifyTotp(RFC_SECRET, code, at(30 - 1))).toBe(1); // um passo antes (passo 0)
    expect(verifyTotp(RFC_SECRET, code, at(120))).toBeNull(); // dois passos depois
    expect(verifyTotp(RFC_SECRET, "000000", at(59))).toBeNull();
  });

  it("não reaceita passo já usado (lastStep) e aceita um passo mais novo", () => {
    expect(verifyTotp(RFC_SECRET, code, at(59), 1)).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, at(59), 0)).toBe(1);
    expect(verifyTotp(RFC_SECRET, code, at(59), null)).toBe(1);
  });

  it("formato: só 6 dígitos (espaços são ignorados)", () => {
    expect(verifyTotp(RFC_SECRET, "287 082", at(59))).toBe(1);
    expect(verifyTotp(RFC_SECRET, "28708", at(59))).toBeNull();
    expect(verifyTotp(RFC_SECRET, "2870822", at(59))).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", at(59))).toBeNull();
    expect(verifyTotp(RFC_SECRET, 287082, at(59))).toBeNull();
    expect(verifyTotp("1!?", code, at(59))).toBeNull();
  });
});

describe("otpauth e códigos de recuperação", () => {
  it("URI otpauth igual à do backend", () => {
    expect(otpauthUri("ABC234", "ana@demo.test")).toBe(
      "otpauth://totp/CampusLost%3Aana%40demo.test?secret=ABC234&issuer=CampusLost&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("8 códigos xxxxx-xxxxx sem caracteres ambíguos", () => {
    const codes = newRecoveryCodes(Uint8Array.from({ length: 80 }, (_, i) => (i * 37 + 11) % 256));
    expect(codes).toHaveLength(8);
    for (const c of codes) expect(c).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{5}-[abcdefghjkmnpqrstuvwxyz23456789]{5}$/);
    expect(new Set(codes).size).toBe(8);
  });

  it("normaliza maiúsculas, espaços e hífen ausente; recusa formato inválido", () => {
    expect(normalizeRecoveryCode(" ABCDE-FGHJK ")).toBe("abcde-fghjk");
    expect(normalizeRecoveryCode("abcdefghjk")).toBe("abcde-fghjk");
    expect(normalizeRecoveryCode("abc")).toBeNull();
    expect(normalizeRecoveryCode("abcd!-fghjk")).toBeNull();
    expect(normalizeRecoveryCode(42)).toBeNull();
  });
});
