import { isAllowedGoogleEmail } from "@/lib/rules";

/** Emissores aceitos de um ID token do Google. */
export const GOOGLE_ISSUERS: readonly string[] = ["accounts.google.com", "https://accounts.google.com"];

export type ClaimsFailure = "invalid_token" | "forbidden_domain";

export type ClaimsResult =
  | { ok: true; profile: { email: string; name: string } }
  | { ok: false; reason: ClaimsFailure };

function isTrue(value: unknown): boolean {
  // O endpoint tokeninfo devolve booleanos como texto ("true").
  return value === true || value === "true";
}

/**
 * Valida as claims devolvidas pelo `tokeninfo` do Google (a assinatura já foi checada por ele).
 * Função pura: `nowSeconds` e `allowedDomains` entram por parâmetro. Nunca lança.
 */
export function validateGoogleClaims(
  claims: unknown,
  options: { clientId: string; allowedDomains: readonly string[]; nowSeconds: number },
): ClaimsResult {
  const invalid: ClaimsResult = { ok: false, reason: "invalid_token" };
  if (typeof claims !== "object" || claims === null) return invalid;
  const c = claims as Record<string, unknown>;

  if (!options.clientId || c.aud !== options.clientId) return invalid;
  if (typeof c.iss !== "string" || !GOOGLE_ISSUERS.includes(c.iss)) return invalid;

  const exp = Number(c.exp);
  if (!Number.isFinite(exp) || exp <= options.nowSeconds) return invalid;

  if (!isTrue(c.email_verified)) return invalid;
  if (typeof c.email !== "string" || c.email.trim() === "") return invalid;

  const email = c.email.trim().toLowerCase();
  if (!isAllowedGoogleEmail(email, options.allowedDomains)) return { ok: false, reason: "forbidden_domain" };

  const name = typeof c.name === "string" && c.name.trim() !== "" ? c.name.trim() : email.split("@")[0];
  return { ok: true, profile: { email, name } };
}
