import { z } from "zod";
import { DEMO_CATEGORIES, isOtherCategory } from "@/types/catalog";
import { toLocalDateString, isFutureDate } from "@/lib/rules/dates";
import { boundedText, emptyToUndefined, isoDate } from "./common";

/** Limites de tamanho dos textos do item; os `maxLength` dos formulários usam estas constantes. */
export const ITEM_TITLE_MAX = 80;
export const ITEM_DESCRIPTION_MAX = 500;
export const ITEM_STORED_AT_MAX = 120;
/** Local onde foi encontrado (texto livre) e filtro de local da busca. */
export const ITEM_LOCATION_MAX = 120;
/** "Especifique a categoria" (só com a categoria "Outros"). */
export const ITEM_CATEGORY_OTHER_MIN = 3;
export const ITEM_CATEGORY_OTHER_MAX = 40;

/** Texto opcional: ausente/`null`/só espaços vira `null`; senão é aparado. */
const emptyToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Schema do item (RF02). A data não pode ser futura: `getToday` devolve o dia local de referência.
 * - `category` é uma das categorias demonstrativas; "Outros" é a opção "Outro" e exige `categoryOther`
 *   (3–40). Com outra categoria, `categoryOther` é descartado (`null`), sem deixar dado inconsistente.
 * - `foundLocation` é texto livre (3–120). `storedAt` é OBRIGATÓRIO (aparado, 3–120; vazio -> "Informe onde o item está guardado.").
 */
export function createItemSchema(getToday: () => string = () => toLocalDateString(new Date())) {
  return z
    .object({
      title: boundedText("um título", 3, ITEM_TITLE_MAX),
      description: boundedText("uma descrição", 10, ITEM_DESCRIPTION_MAX),
      category: z.enum(DEMO_CATEGORIES, { error: "Escolha uma categoria." }),
      categoryOther: z.string().nullish().transform(emptyToNull),
      foundLocation: boundedText("o local onde foi encontrado", 3, ITEM_LOCATION_MAX),
      foundDate: isoDate.refine((d) => !isFutureDate(d, getToday()), {
        error: "A data não pode ser no futuro.",
      }),
      storedAt: boundedText("onde o item está guardado", 3, ITEM_STORED_AT_MAX),
    })
    .superRefine((v, ctx) => {
      if (!isOtherCategory(v.category)) return;
      const issue = (message: string) => ctx.addIssue({ code: "custom", path: ["categoryOther"], message });
      if (v.categoryOther === null) issue("Especifique a categoria.");
      else if (v.categoryOther.length < ITEM_CATEGORY_OTHER_MIN) issue(`Use pelo menos ${ITEM_CATEGORY_OTHER_MIN} caracteres.`);
      else if (v.categoryOther.length > ITEM_CATEGORY_OTHER_MAX) issue(`Use no máximo ${ITEM_CATEGORY_OTHER_MAX} caracteres.`);
    })
    .transform((v) => ({ ...v, categoryOther: isOtherCategory(v.category) ? v.categoryOther : null }));
}
export const itemSchema = createItemSchema();
/** Valores validados (saída do schema): `categoryOther` é `string | null`; `storedAt` é `string`. */
export type ItemFormValues = z.output<typeof itemSchema>;
/** O que o formulário/serviço aceita: `categoryOther` pode ser `""`, `null` ou ausente. */
export type ItemFormInput = z.input<typeof itemSchema>;

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
    // Texto livre ("contém", sem caixa/acentos). Vazio = sem filtro.
    location: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: "Local inválido." })
        .trim()
        .max(ITEM_LOCATION_MAX, `Use no máximo ${ITEM_LOCATION_MAX} caracteres.`)
        .optional(),
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

