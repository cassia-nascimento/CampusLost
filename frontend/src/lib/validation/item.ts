import { z } from "zod";
import { DEMO_CATEGORIES, DEMO_LOCATIONS } from "@/types/catalog";
import { toLocalDateString, isFutureDate } from "@/lib/rules/dates";
import { boundedText, emptyToUndefined, isoDate } from "./common";

/** Limites de tamanho dos textos do item; os `maxLength` dos formulários usam estas constantes. */
export const ITEM_TITLE_MAX = 80;
export const ITEM_DESCRIPTION_MAX = 500;
export const ITEM_STORED_AT_MAX = 120;

/**
 * Schema do item (RF02). A data não pode ser futura: `getToday` devolve o dia local de referência.
 * Os valores de categoria/local vêm do módulo de dados demonstrativos.
 */
export function createItemSchema(getToday: () => string = () => toLocalDateString(new Date())) {
  return z.object({
    title: boundedText("um título", 3, ITEM_TITLE_MAX),
    description: boundedText("uma descrição", 10, ITEM_DESCRIPTION_MAX),
    category: z.enum(DEMO_CATEGORIES, { error: "Escolha uma categoria." }),
    foundLocation: z.enum(DEMO_LOCATIONS, { error: "Escolha o local onde foi encontrado." }),
    foundDate: isoDate.refine((d) => !isFutureDate(d, getToday()), {
      error: "A data não pode ser no futuro.",
    }),
    storedAt: boundedText("onde o item está guardado", 3, ITEM_STORED_AT_MAX),
  });
}
export const itemSchema = createItemSchema();
export type ItemFormValues = z.infer<typeof itemSchema>;

const optionalDate = z.preprocess(emptyToUndefined, isoDate.optional());

function periodRefinement<T extends { from?: string; to?: string }>(v: T, ctx: z.RefinementCtx) {
  if (v.from && v.to && v.from > v.to) {
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: "A data final deve ser igual ou posterior à inicial.",
    });
  }
}

/** Filtros da busca (RF03). Valores vazios (`""`) são ignorados. */
export const itemFiltersSchema = z
  .object({
    category: z.preprocess(
      emptyToUndefined,
      z.enum(DEMO_CATEGORIES, { error: "Categoria inválida." }).optional(),
    ),
    location: z.preprocess(
      emptyToUndefined,
      z.enum(DEMO_LOCATIONS, { error: "Local inválido." }).optional(),
    ),
    from: optionalDate,
    to: optionalDate,
    status: z.preprocess(
      emptyToUndefined,
      z.enum(["available", "under_claim"], { error: "Situação inválida." }).optional(),
    ),
    sort: z.preprocess(
      emptyToUndefined,
      z.enum(["registered", "found"], { error: "Ordenação inválida." }).optional(),
    ),
  })
  .superRefine(periodRefinement);
export type ItemFiltersValues = z.infer<typeof itemFiltersSchema>;

/** Período da listagem de devoluções (RF05). */
export const periodSchema = z
  .object({ from: optionalDate, to: optionalDate })
  .superRefine(periodRefinement);
export type PeriodValues = z.infer<typeof periodSchema>;

