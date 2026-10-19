import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { formatInstantDate } from "@/lib/format";
import type { ItemDetail } from "@/services";
import type { Claim } from "@/types/domain";

const MY_CLAIMS_HREF = "/minhas-reivindicacoes";

function MyClaimNotice({ claim, detail }: { claim: Claim; detail: ItemDetail }) {
  const { item } = detail;
  const returned = item.status === "returned";
  const action = (
    <LinkButton href={MY_CLAIMS_HREF} variant="secondary">
      Ver minha reivindicação
    </LinkButton>
  );

  switch (claim.status) {
    case "pending":
      return (
        <Notice tone="info" title="Reivindicação pendente" action={action}>
          Você já reivindicou este item. Acompanhe em Minhas reivindicações.
        </Notice>
      );
    case "accepted":
      return (
        <Notice tone="success" title="Reivindicação aceita" action={action}>
          {returned
            ? "Sua reivindicação foi aceita e a devolução foi registrada."
            : `Sua reivindicação foi aceita. Procure a administração para retirar o item. Ele está guardado em ${item.storedAt}.`}
        </Notice>
      );
    case "rejected":
      return (
        <Notice tone="danger" title="Reivindicação recusada" action={action}>
          {returned
            ? "Sua reivindicação foi recusada."
            : "Sua reivindicação foi recusada e não é possível enviar outra para este item. Se acha que foi engano, procure a administração."}
        </Notice>
      );
  }
}

/**
 * Avisos do detalhe (DESIGN §9.4), sempre a partir do que o serviço decidiu (`detail.viewer`) e do estado
 * do item: devolvido (somente leitura), a reivindicação da própria pessoa ou o motivo de não poder
 * reivindicar. Não decide permissão nenhuma — só explica.
 */
export function ItemViewerNotices({ detail }: { detail: ItemDetail }) {
  const { item, myClaims, viewer, returnRecord } = detail;
  const myClaim = myClaims[0]; // a mais recente
  const returned = item.status === "returned";

  return (
    <>
      {returned ? (
        <Notice tone="neutral" title="Item devolvido">
          {returnRecord
            ? `Este item já foi devolvido em ${formatInstantDate(returnRecord.returnedAt)}.`
            : "Este item já foi devolvido."}{" "}
          Ele não aparece mais na busca e fica somente para leitura.
        </Notice>
      ) : null}

      {myClaim ? (
        <MyClaimNotice claim={myClaim} detail={detail} />
      ) : !viewer.claim.allowed && !returned ? (
        <Notice tone={viewer.claim.code === "FORBIDDEN" ? "neutral" : "info"}>{viewer.claim.message}</Notice>
      ) : null}
    </>
  );
}
