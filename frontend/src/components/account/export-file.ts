/** Arquivo de "Baixar meus dados" (LGPD): nome e conteúdo. Funções puras. */
import type { MyDataExport } from "@/services";

export function exportFileName(exportedAt: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(exportedAt)?.[0];
  return `campuslost-meus-dados${day ? `-${day}` : ""}.json`;
}

export function serializeExport(data: MyDataExport): string {
  return JSON.stringify(data, null, 2);
}
