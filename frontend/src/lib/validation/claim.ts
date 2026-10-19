import { z } from "zod";
import { boundedText } from "./common";

/** Limites de tamanho das respostas; os `maxLength` do formulário usam estas constantes. */
export const CLAIM_PROOF_MAX = 500;
export const CLAIM_WHERE_WHEN_MAX = 300;

/** Reivindicação (RF04 / P7): duas perguntas obrigatórias. */
export const claimSchema = z.object({
  proofDetails: boundedText("os detalhes que só o dono saberia", 10, CLAIM_PROOF_MAX),
  lostWhereWhen: boundedText("onde e quando você perdeu o item", 5, CLAIM_WHERE_WHEN_MAX),
});
export type ClaimFormValues = z.infer<typeof claimSchema>;
