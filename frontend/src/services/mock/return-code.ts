/**
 * Apoio do mock ao código de retirada: hash (o código em claro nunca é guardado) e as duas projeções do estado
 * (proprietário e administração). As regras (formato, tentativas, bloqueio, prazo) vivem em `lib/rules/return-code`.
 */
import {
  RETURN_CODE_MAX_ATTEMPTS,
  isReturnCodeVerified,
  returnCodeAttemptsLeft,
  returnCodeLockRemainingMs,
  returnCodeVerifiedUntil,
} from "@/lib/rules";
import type { ReturnCodeStatus } from "../contracts";
import type { ReturnCodeRecord } from "./seed";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 de `claimId:CÓDIGO` (hex). Assíncrono (Web Crypto): calcule ANTES da `store.transaction`, que é síncrona,
 * e compare os hashes dentro dela. Amarrar o hash à reivindicação faz o código de uma não valer em outra.
 */
export async function hashReturnCode(claimId: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${claimId}:${code}`));
  return toHex(new Uint8Array(digest));
}

/** Visão do proprietário: só se já gerou e quando. */
export function ownerReturnCodeStatus(record: ReturnCodeRecord | undefined): ReturnCodeStatus {
  return { issued: record !== undefined, issuedAt: record?.issuedAt ?? null };
}

/** Visão da administração: conferência, tentativas e bloqueio (nunca o código). */
export function adminReturnCodeStatus(record: ReturnCodeRecord | undefined, now: Date): ReturnCodeStatus {
  if (!record) {
    return {
      issued: false,
      issuedAt: null,
      verified: false,
      verifiedAt: null,
      verifiedUntil: null,
      attemptsLeft: RETURN_CODE_MAX_ATTEMPTS,
      lockedUntil: null,
    };
  }
  return {
    issued: true,
    issuedAt: record.issuedAt,
    verified: isReturnCodeVerified(record, now),
    verifiedAt: record.verifiedAt,
    verifiedUntil: returnCodeVerifiedUntil(record),
    attemptsLeft: returnCodeAttemptsLeft(record, now),
    lockedUntil: returnCodeLockRemainingMs(record, now) > 0 ? record.lockedUntil : null,
  };
}
