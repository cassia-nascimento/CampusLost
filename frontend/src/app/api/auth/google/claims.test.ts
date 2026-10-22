import { describe, expect, it } from "vitest";
import { validateGoogleClaims } from "./claims";

const CLIENT_ID = "client-123.apps.googleusercontent.com";
const NOW = 1_800_000_000;
const options = { clientId: CLIENT_ID, allowedDomains: ["undb.edu.br"], nowSeconds: NOW };

const valid = {
  aud: CLIENT_ID,
  iss: "https://accounts.google.com",
  exp: String(NOW + 600),
  email_verified: "true",
  email: "Maria@undb.edu.br",
  name: "Maria Exemplo",
};

describe("validateGoogleClaims", () => {
  it("aceita claims válidas e normaliza o e-mail", () => {
    expect(validateGoogleClaims(valid, options)).toEqual({
      ok: true,
      profile: { email: "maria@undb.edu.br", name: "Maria Exemplo" },
    });
  });

  it("aceita iss sem esquema e email_verified booleano", () => {
    const result = validateGoogleClaims({ ...valid, iss: "accounts.google.com", email_verified: true }, options);
    expect(result.ok).toBe(true);
  });

  it("usa a parte local do e-mail quando não há nome", () => {
    const result = validateGoogleClaims({ ...valid, name: undefined }, options);
    expect(result).toEqual({ ok: true, profile: { email: "maria@undb.edu.br", name: "maria" } });
  });

  it.each([
    ["aud errado", { aud: "outro" }],
    ["iss errado", { iss: "https://evil.example" }],
    ["token expirado", { exp: String(NOW - 1) }],
    ["exp igual a agora", { exp: String(NOW) }],
    ["exp inválido", { exp: "abc" }],
    ["e-mail não verificado", { email_verified: "false" }],
    ["email_verified ausente", { email_verified: undefined }],
    ["e-mail ausente", { email: undefined }],
    ["aud ausente", { aud: undefined }],
  ])("rejeita %s como token inválido", (_label, patch) => {
    expect(validateGoogleClaims({ ...valid, ...patch }, options)).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejeita domínio fora do institucional", () => {
    expect(validateGoogleClaims({ ...valid, email: "x@gmail.com" }, options)).toEqual({
      ok: false,
      reason: "forbidden_domain",
    });
    expect(validateGoogleClaims({ ...valid, email: "x@undb.edu.br.evil.com" }, options)).toEqual({
      ok: false,
      reason: "forbidden_domain",
    });
  });

  it("rejeita corpo que não é objeto e Client ID vazio", () => {
    expect(validateGoogleClaims(null, options).ok).toBe(false);
    expect(validateGoogleClaims("x", options).ok).toBe(false);
    expect(validateGoogleClaims(valid, { ...options, clientId: "" }).ok).toBe(false);
  });
});
