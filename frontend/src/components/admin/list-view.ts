/** Apresentação de listas paginadas e da trilha de auditoria da administração. Funções puras. */
import { AUDIT_ACTION_LABEL, type AuditAction, type AuditEntry, type Page } from "@/types/admin";

/** "21–40 de 135" (ou "0 de 0"). */
export function pageRange(page: Pick<Page<unknown>, "page" | "pageSize" | "total" | "items">): string {
  if (page.total === 0 || page.items.length === 0) return `0 de ${page.total}`;
  const first = (page.page - 1) * page.pageSize + 1;
  return `${first}–${first + page.items.length - 1} de ${page.total}`;
}

export function auditActionLabel(action: string): string {
  return Object.hasOwn(AUDIT_ACTION_LABEL, action) ? AUDIT_ACTION_LABEL[action as AuditAction] : action;
}

/** Ex.: "item · item-04". `null` quando o evento não tem alvo. */
export function describeAuditTarget(entry: Pick<AuditEntry, "targetType" | "targetId">): string | null {
  const parts = [entry.targetType, entry.targetId].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Pares "chave: valor" dos detalhes; vazio sem metadados. */
export function auditMetadataPairs(metadata: AuditEntry["metadata"]): { key: string; value: string }[] {
  if (!metadata) return [];
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: value === null ? "—" : typeof value === "boolean" ? (value ? "sim" : "não") : String(value),
  }));
}

/** Quem fez: nome, ou "Sistema" quando não há autor. */
export function auditActorName(entry: Pick<AuditEntry, "actorId" | "actorName">): string {
  return entry.actorName ?? (entry.actorId ? "Usuário removido" : "Sistema ou visitante");
}
