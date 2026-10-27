/**
 * Textos da reivindicação de quem a enviou, por (status da reivindicação × status do item).
 * Fonte única para o aviso do detalhe do item (`ItemViewerNotices`), o próximo passo do `ClaimCard` e o
 * bloqueio de `ClaimScreen` (DESIGN §10). Função pura: só texto; quem pode fazer o quê continua sendo
 * decidido pelo serviço (`viewer.*`) e por `lib/rules`.
 */
import { formatInstantDate } from "@/lib/format";
import type { ClaimStatus, ItemStatus } from "@/types/domain";

export interface ClaimMessageInput {
  claimStatus: ClaimStatus;
  itemStatus: ItemStatus;
  /** Instante da devolução, quando a tela o conhece (hoje só a administração recebe o registro). */
  returnedAt?: string | null;
  /**
   * Local de guarda, só usado no texto da reivindicação ACEITA com o item aguardando devolução. O serviço só o
   * entrega a quem tem permissão (`canViewStoredAt`); sem ele, o texto manda procurar a administração.
   */
  storedAt?: string;
}

export interface ClaimMessages {
  /** Título do aviso no detalhe do item. */
  noticeTitle: string;
  /** Corpo do aviso no detalhe do item. */
  notice: string;
  /** Próximo passo no `ClaimCard`; `highlight` ("Aceita!") pede destaque de sucesso. */
  nextStep: { highlight?: string; text: string };
  /** Motivo do bloqueio em `ClaimScreen` para quem já tem reivindicação pendente/aceita; `null` nos demais casos. */
  blocked: string | null;
}

const ASK_ADMIN = "Se acha que foi engano, procure a administração.";

/** "Item devolvido em dd/mm/aaaa." (ou sem data, quando ela não é conhecida). */
export function returnedItemText(returnedAt?: string | null): string {
  return returnedAt ? `Item devolvido em ${formatInstantDate(returnedAt)}.` : "Item devolvido.";
}

/** Aviso do detalhe quando o item já foi devolvido (DESIGN §10: "Este item já foi devolvido em {data}."). */
export function returnedItemNotice(returnedAt?: string | null): string {
  return returnedAt ? `Este item já foi devolvido em ${formatInstantDate(returnedAt)}.` : "Este item já foi devolvido.";
}

export function getClaimMessages({ claimStatus, itemStatus, returnedAt, storedAt }: ClaimMessageInput): ClaimMessages {
  const returned = itemStatus === "returned";

  switch (claimStatus) {
    case "pending":
      return {
        noticeTitle: "Reivindicação pendente",
        notice: "Você já reivindicou este item. Acompanhe em Minhas reivindicações.",
        nextStep: { text: "Aguardando análise da administração." },
        blocked: "Você já tem uma reivindicação neste item.",
      };

    case "accepted":
      if (returned) {
        const done = returnedAt
          ? `o item foi devolvido em ${formatInstantDate(returnedAt)}`
          : "a devolução foi registrada";
        return {
          noticeTitle: "Reivindicação aceita",
          notice: `Sua reivindicação foi aceita e ${done}.`,
          nextStep: { text: returnedItemText(returnedAt) },
          blocked: null,
        };
      }
      // O local de guarda é privado: só aparece aqui, na reivindicação aceita (pendente e recusada nunca o citam).
      {
        const accepted = "Sua reivindicação foi aceita. Procure a administração para retirar o item.";
        const where = storedAt ? ` Ele está guardado em ${storedAt}.` : "";
        // Convite ao código de retirada (sem citar o local de novo): o botão do aviso leva a Minhas reivindicações.
        const notice = `${accepted}${where} Gere seu código de retirada em Minhas reivindicações.`;
        return {
          noticeTitle: "Reivindicação aceita",
          notice,
          nextStep: {
            highlight: "Aceita!",
            text: `Procure a administração para retirar o item.${where} Leve o código de retirada.`,
          },
          blocked: notice,
        };
      }

    case "rejected":
      // Com o item devolvido não há mais o que reenviar nem retirar: só informa a recusa.
      if (returned) {
        return {
          noticeTitle: "Reivindicação recusada",
          notice: "Sua reivindicação foi recusada.",
          nextStep: { text: "A administração recusou esta reivindicação." },
          blocked: null,
        };
      }
      return {
        noticeTitle: "Reivindicação recusada",
        notice: `Sua reivindicação foi recusada e não é possível enviar outra para este item. ${ASK_ADMIN}`,
        nextStep: { text: `A administração recusou esta reivindicação. Você não pode reenviar. ${ASK_ADMIN}` },
        blocked: null,
      };
  }
}
