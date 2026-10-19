/**
 * Aplica à tela de análise o resultado de aceitar/recusar assim que o serviço responde, sem esperar a
 * releitura (que leva a latência de duas leituras). É só uma projeção do que o serviço já decidiu: a
 * releitura que vem a seguir substitui este estado pelo oficial. As permissões vêm de `lib/rules`.
 */
import { canDeleteItem, canEditItem, canRegisterReturn } from "@/lib/rules";
import type { ClaimDecisionResult, ClaimView, ItemDetail } from "@/services";
import type { User } from "@/types/domain";

export interface ReviewState {
  claim: ClaimView;
  detail: ItemDetail;
}

export function applyDecision(actor: User | null, state: ReviewState, result: ClaimDecisionResult): ReviewState {
  const { claim: decided, item, autoRejectedIds } = result;
  const claims = state.detail.claims.map((c) => {
    if (c.id === decided.id) return { ...c, ...decided };
    if (autoRejectedIds.includes(c.id)) return { ...c, status: "rejected" as const, reviewedAt: decided.reviewedAt };
    return c;
  });

  return {
    claim: { ...state.claim, ...decided, item },
    detail: {
      ...state.detail,
      item,
      claims,
      viewer: {
        ...state.detail.viewer,
        edit: canEditItem(actor, item),
        delete: canDeleteItem(actor, item),
        registerReturn: canRegisterReturn(actor, item, claims),
      },
    },
  };
}
