import { z } from "zod";
import { boundedText } from "./common";

/** Reivindicação (RF04 / P7): duas perguntas obrigatórias. */
export const claimSchema = z.object({
  proofDetails: boundedText("os detalhes que só o dono saberia", 10, 500),
  lostWhereWhen: boundedText("onde e quando você perdeu o item", 5, 300),
});
export type ClaimFormValues = z.infer<typeof claimSchema>;
