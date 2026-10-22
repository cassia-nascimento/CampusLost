import { ServiceError } from "@/types/domain";
import type { GoogleProfile } from "../contracts";

const FORBIDDEN_DOMAIN = "Use o e-mail institucional da UNDB.";
const GENERIC_ERROR = "Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.";
const NETWORK_ERROR = "Sem conexão com o servidor. Confira sua internet e tente de novo.";
const EXPIRED_TICKET = "Sua verificação do Google expirou. Entre com o Google novamente.";

/** Verifica o ID token do Google e devolve o perfil. Lança `ServiceError`. */
export type GoogleCredentialVerifier = (credential: string) => Promise<GoogleProfile>;

/** Padrão do mock: a rota de servidor `/api/auth/google` do Next confere o token e devolve só `{ email, name }`. */
export const verifyGoogleCredentialViaRoute: GoogleCredentialVerifier = async (credential) => {
  let response: Response;
  try {
    response = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
  } catch (cause) {
    throw new ServiceError("NETWORK", NETWORK_ERROR, { cause });
  }
  if (response.status === 403) throw new ServiceError("FORBIDDEN_DOMAIN", FORBIDDEN_DOMAIN);
  if (!response.ok) throw new ServiceError("UNAUTHENTICATED", GENERIC_ERROR);
  try {
    const data = (await response.json()) as Partial<GoogleProfile>;
    if (typeof data.email === "string" && typeof data.name === "string") return { email: data.email, name: data.name };
  } catch {
    // cai no erro genérico abaixo
  }
  throw new ServiceError("UNAUTHENTICATED", GENERIC_ERROR);
};

/**
 * `ticket` do mock: o próprio perfil (JSON em base64url). É OPACO para a UI, mas NÃO é assinado, então
 * qualquer um poderia forjá-lo. Aceitável só porque o mock é uma demonstração sem servidor; na API o
 * `ticket` é o `profileToken` assinado pelo backend.
 */
export function encodeGoogleTicket(profile: GoogleProfile): string {
  const bytes = new TextEncoder().encode(JSON.stringify(profile));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeGoogleTicket(ticket: string): GoogleProfile {
  try {
    const base64 = String(ticket).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as Partial<GoogleProfile>;
    if (typeof data.email === "string" && typeof data.name === "string") return { email: data.email, name: data.name };
  } catch {
    // inválido
  }
  throw new ServiceError("UNAUTHENTICATED", EXPIRED_TICKET);
}
