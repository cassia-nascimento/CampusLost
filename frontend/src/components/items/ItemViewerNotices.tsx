import { getClaimMessages, returnedItemNotice } from "@/components/claims/claim-messages";
import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Tone } from "@/components/ui/tones";
import type { ItemDetail } from "@/services";
import type { Claim, ClaimStatus } from "@/types/domain";

const MY_CLAIMS_HREF = "/minhas-reivindicacoes";

const CLAIM_NOTICE_TONE: Record<ClaimStatus, Tone> = { pending: "info", accepted: "success", rejected: "danger" };

function MyClaimNotice({ claim, detail }: { claim: Claim; detail: ItemDetail }) {
  const { item, returnRecord } = detail;
  const message = getClaimMessages({
    claimStatus: claim.status,
    itemStatus: item.status,
    storedAt: item.storedAt,
    returnedAt: returnRecord?.returnedAt,
  });
  return (
    <Notice
      tone={CLAIM_NOTICE_TONE[claim.status]}
      title={message.noticeTitle}
      action={
        <LinkButton href={MY_CLAIMS_HREF} variant="secondary">
          Ver minha reivindicação
        </LinkButton>
      }
    >
      {message.notice}
    </Notice>
  );
}

/**
 * Avisos do detalhe (DESIGN §9.4), sempre a partir do que o serviço decidiu (`detail.viewer`) e do estado
 * do item: devolvido (somente leitura), a reivindicação da própria pessoa ou o motivo de não poder
 * reivindicar. Não decide permissão nenhuma — só explica. Os textos da reivindicação vêm de `claim-messages`.
 */
export function ItemViewerNotices({ detail }: { detail: ItemDetail }) {
  const { item, myClaims, viewer, returnRecord } = detail;
  const myClaim = myClaims[0]; // a mais recente
  const returned = item.status === "returned";

  return (
    <>
      {returned ? (
        <Notice tone="neutral" title="Item devolvido">
          {returnedItemNotice(returnRecord?.returnedAt)} Ele não aparece mais na busca e fica somente para leitura.
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
