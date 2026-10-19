import { ServiceError, type ServiceErrorCode } from "@/types/domain";

/** Resultado de uma verificação de permissão/regra, com motivo apresentável. */
export type Decision =
  | { allowed: true }
  | { allowed: false; code: ServiceErrorCode; message: string };

export const ALLOW: Decision = { allowed: true };

export function deny(code: ServiceErrorCode, message: string): Decision {
  return { allowed: false, code, message };
}

/** Lança `ServiceError` quando a decisão nega. */
export function assertAllowed(decision: Decision): void {
  if (!decision.allowed) throw new ServiceError(decision.code, decision.message);
}
