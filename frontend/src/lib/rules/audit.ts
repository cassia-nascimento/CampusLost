/**
 * Regras puras da trilha de auditoria. Regra de ouro (igual ao backend): NUNCA gravar senha, token, segredo TOTP
 * nem código. `cleanAuditMetadata` descarta chaves de nome sensível e limita o tamanho dos valores.
 */

import { sha1Hex } from "./totp";

const SENSITIVE_PARTS = ["password", "senha", "token", "secret", "segredo", "code", "codigo", "hash", "credential", "cookie"];
const MAX_VALUE_LENGTH = 200;

export type AuditMetadata = Record<string, string | number | boolean | null>;

export function cleanAuditMetadata(meta: Record<string, unknown> | null | undefined): AuditMetadata | null {
  if (!meta) return null;
  const out: AuditMetadata = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_PARTS.some((part) => lower.includes(part))) continue;
    if (typeof value === "boolean" || typeof value === "number" || value === null) out[key] = value;
    else if (value !== undefined) out[key] = String(value).slice(0, MAX_VALUE_LENGTH);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Referência estável de 12 hexadecimais para um e-mail digitado, sem guardar o texto (que pode ser uma senha
 * digitada no campo errado). SHA-1 truncado (o backend usa SHA-256): basta para correlacionar eventos no mock.
 */
export function emailFingerprint(email: string): string {
  return sha1Hex(email.trim().toLowerCase()).slice(0, 12);
}
