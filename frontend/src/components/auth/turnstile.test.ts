import { describe, expect, it } from "vitest";
import { isSubmitBlocked, readSiteKey } from "./turnstile";

describe("Turnstile (lógica pura)", () => {
  it("chave vazia ou ausente desliga o captcha", () => {
    expect(readSiteKey(undefined)).toBeUndefined();
    expect(readSiteKey("   ")).toBeUndefined();
    expect(readSiteKey(" 0x4AAA ")).toBe("0x4AAA");
  });

  it("bloqueia o envio só com widget ativo e sem token", () => {
    expect(isSubmitBlocked(undefined, undefined)).toBe(false);
    expect(isSubmitBlocked("0x4AAA", undefined)).toBe(true);
    expect(isSubmitBlocked("0x4AAA", "tok")).toBe(false);
  });
});
