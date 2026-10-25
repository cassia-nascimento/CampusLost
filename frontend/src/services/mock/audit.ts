import { cleanAuditMetadata } from "@/lib/rules";
import type { AuditAction } from "@/types/admin";
import type { MockContext } from "./context";
import { AUDIT_LIMIT, type Db } from "./seed";

export interface AuditInput {
  actorId: string | null;
  action: AuditAction;
  target?: [type: string, id: string];
  /** Só dados não sensíveis: chaves como password/token/secret/code são descartadas por `cleanAuditMetadata`. */
  metadata?: Record<string, unknown>;
}

/** Registra o evento DENTRO da transação em curso (atômico com a mudança auditada). */
export function recordAudit(ctx: MockContext, db: Db, input: AuditInput): void {
  db.audit.push({
    id: ctx.newId("audit"),
    at: ctx.now().toISOString(),
    actorId: input.actorId,
    action: input.action,
    targetType: input.target?.[0] ?? null,
    targetId: input.target?.[1] ?? null,
    metadata: cleanAuditMetadata(input.metadata),
  });
  if (db.audit.length > AUDIT_LIMIT) db.audit.splice(0, db.audit.length - AUDIT_LIMIT);
}

/**
 * Registra um evento de falha (login, 2FA) numa transação própria, ANTES de o chamador lançar o erro
 * (uma transação que lança não grava). Falha ao gravar (cota) é ignorada: o erro original é o que importa.
 */
export function recordAuditSafely(ctx: MockContext, input: AuditInput): void {
  try {
    ctx.store.transaction((db) => recordAudit(ctx, db, input));
  } catch {
    /* auditoria é melhor-esforço no mock */
  }
}
