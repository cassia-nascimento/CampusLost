/**
 * Vínculo derivado do DOMÍNIO do e-mail (hipótese da equipe, P30): domínio institucional -> `institutional`; qualquer
 * outro -> `external`. NÃO é verificação de vínculo: o texto do produto nunca pode afirmar que a pessoa "é aluno" ou
 * "é servidor". Reutiliza a regra de domínios do "Entrar com Google" (`isAllowedGoogleEmail`); não duplica nada.
 */
import type { Affiliation } from "@/types/domain";
import { getAllowedGoogleDomains, isAllowedGoogleEmail } from "./google-auth";

/** `institutional` se o e-mail é válido e do domínio (ou subdomínio) institucional; senão `external`. */
export function affiliationForEmail(email: string, institutionalDomains: readonly string[] = getAllowedGoogleDomains()): Affiliation {
  return isAllowedGoogleEmail(email, institutionalDomains) ? "institutional" : "external";
}
