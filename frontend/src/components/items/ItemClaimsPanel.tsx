import { withOrigin } from "@/components/layout/navigation";
import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ClaimStatusBadge } from "@/components/ui/StatusBadge";
import { formatInstantDate } from "@/lib/format";
import type { Decision } from "@/lib/rules";
import type { ClaimWithClaimant } from "@/services";

export interface ItemClaimsPanelProps {
  /** `detail.claims`: todas as reivindicações do item (só a administração as recebe). */
  claims: ClaimWithClaimant[];
  /** `detail.viewer.registerReturn`: decide se o aviso de "falta registrar a devolução" aparece. */
  registerReturn: Decision;
}

/** Link para a análise levando o item como origem: o voltar da análise retorna a este item (não ao painel). */
const reviewHref = (claim: ClaimWithClaimant) => withOrigin(`/admin/reivindicacoes/${claim.id}`, `/itens/${claim.itemId}`);

/**
 * Reivindicações do item para a administração (DESIGN §9.4). A análise (aceitar/recusar) e o registro da
 * devolução acontecem em `/admin/reivindicacoes/[id]`; aqui só há links para lá.
 */
export function ItemClaimsPanel({ claims, registerReturn }: ItemClaimsPanelProps) {
  const accepted = claims.find((claim) => claim.status === "accepted");

  return (
    <section aria-labelledby="claims-heading" className="flex flex-col gap-4">
      <h2 id="claims-heading" className="text-h3">
        Reivindicações deste item ({claims.length})
      </h2>

      {accepted && registerReturn.allowed ? (
        <Notice
          tone="success"
          title="Pronto para devolução"
          action={
            <LinkButton href={reviewHref(accepted)} variant="secondary">
              Registrar devolução
            </LinkButton>
          }
        >
          A reivindicação de {accepted.claimant.name} foi aceita. Falta registrar a devolução.
        </Notice>
      ) : null}

      {claims.length === 0 ? (
        <p className="text-body text-ink-muted">Nenhuma reivindicação neste item ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold">{claim.claimant.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ClaimStatusBadge status={claim.status} />
                  <span className="text-meta text-ink-subtle">Enviada em {formatInstantDate(claim.createdAt)}</span>
                </div>
              </div>
              <LinkButton
                href={reviewHref(claim)}
                variant="secondary"
                aria-label={`${claim.status === "pending" ? "Analisar" : "Ver"} reivindicação de ${claim.claimant.name}`}
              >
                {claim.status === "pending" ? "Analisar" : "Ver"}
              </LinkButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
