/**
 * Filtros da busca (`/itens`) ⇄ parâmetros da URL (RF03, AC03.3).
 *
 * A URL é a fonte de verdade dos filtros: assim o botão voltar do navegador devolve a pessoa à
 * mesma busca depois de abrir um item. Funções puras (testadas em `search-params.test.ts`).
 *
 * Parâmetros: `categoria`, `local`, `de` e `ate` (datas `YYYY-MM-DD`, sobre a data em que o item
 * foi encontrado — SPEC P11). `local` é texto livre (trim, máx. 120; "contém", sem caixa nem acentos). Valores inválidos ou desconhecidos na URL são ignorados em vez de
 * quebrar a tela (a URL pode ter sido digitada ou vir de uma lista de categorias antiga).
 */
import { formatDate } from "@/lib/format";
import { isValidIsoDate, type ItemFilters } from "@/lib/rules";
import { ITEM_LOCATION_MAX, periodSchema } from "@/lib/validation";
import { DEMO_CATEGORIES } from "@/types/catalog";

/** Valores dos campos de filtro; `""` = sem filtro (é o que `<select>` e `<input>` entregam). */
export interface FilterValues {
  category: string;
  location: string;
  from: string;
  to: string;
}

export const EMPTY_FILTERS: FilterValues = { category: "", location: "", from: "", to: "" };

const PARAM_NAMES: Record<keyof FilterValues, string> = {
  category: "categoria",
  location: "local",
  from: "de",
  to: "ate",
};

/** O que `URLSearchParams` e `ReadonlyURLSearchParams` (Next) têm em comum. */
export interface ParamReader {
  get(name: string): string | null;
}

function pickOf(options: readonly string[], value: string | null): string {
  return value !== null && options.includes(value) ? value : "";
}

/** Texto livre (local): aparado e limitado a `ITEM_LOCATION_MAX`; vazio = sem filtro. */
function pickText(value: string | null): string {
  return (value ?? "").trim().slice(0, ITEM_LOCATION_MAX);
}

function pickDate(value: string | null): string {
  return value !== null && isValidIsoDate(value) ? value : "";
}

/** Tempo sem digitar nas datas antes de aplicar o filtro (digitar o ano gera valores intermediários). */
export const DATE_FILTER_DEBOUNCE_MS = 450;

/** Mensagem de erro do período (data final antes da inicial) ou `null`. Reusa a regra do schema de validação. */
export function periodError(values: Pick<FilterValues, "from" | "to">): string | null {
  const result = periodSchema.safeParse({ from: values.from, to: values.to });
  return result.success ? null : (result.error.issues[0]?.message ?? "Período inválido.");
}

/** Lê os filtros da URL, descartando o que não for válido. Período invertido: ignora a data final. */
export function parseFilterParams(params: ParamReader): FilterValues {
  const values: FilterValues = {
    category: pickOf(DEMO_CATEGORIES, params.get(PARAM_NAMES.category)),
    location: pickText(params.get(PARAM_NAMES.location)),
    from: pickDate(params.get(PARAM_NAMES.from)),
    to: pickDate(params.get(PARAM_NAMES.to)),
  };
  return periodError(values) ? { ...values, to: "" } : values;
}

/** `?categoria=...&de=...` ou `""` quando não há filtro (URL limpa). */
export function filtersToSearch(values: FilterValues): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(PARAM_NAMES) as (keyof FilterValues)[]) {
    const text = key === "location" ? values[key].trim() : values[key];
    if (text) params.set(PARAM_NAMES[key], text);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Filtros no formato do serviço (`services.items.list`): só os campos preenchidos. */
export function toItemFilters(values: FilterValues): ItemFilters {
  const filters: ItemFilters = {};
  if (values.category) filters.category = values.category;
  if (values.location.trim()) filters.location = values.location.trim();
  if (values.from) filters.from = values.from;
  if (values.to) filters.to = values.to;
  return filters;
}

export interface FilterChip {
  key: keyof FilterValues;
  label: string;
}

/** Filtros ativos como rótulos removíveis (chips no celular; também o contador do botão "Filtros"). */
export function getActiveChips(values: FilterValues): FilterChip[] {
  const chips: FilterChip[] = [];
  if (values.category) chips.push({ key: "category", label: values.category });
  if (values.location.trim()) chips.push({ key: "location", label: `Local: ${values.location.trim()}` });
  if (values.from) chips.push({ key: "from", label: `A partir de ${formatDate(values.from)}` });
  if (values.to) chips.push({ key: "to", label: `Até ${formatDate(values.to)}` });
  return chips;
}
