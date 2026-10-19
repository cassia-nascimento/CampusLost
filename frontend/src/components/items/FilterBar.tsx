"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import { DEMO_CATEGORIES, DEMO_LOCATIONS } from "@/types/catalog";
import { CatalogNote } from "./CatalogNote";
import {
  DATE_FILTER_DEBOUNCE_MS,
  EMPTY_FILTERS,
  filtersToSearch,
  getActiveChips,
  periodError,
  type FilterValues,
} from "./search-params";

export interface FilterBarProps {
  /** Filtros aplicados agora (vêm da URL). */
  value: FilterValues;
  /** Aplica novos filtros (o pai atualiza a URL). Nunca é chamado com período inválido. */
  onChange: (next: FilterValues) => void;
  /** Contagem de resultados ("12 itens"), anunciada de forma educada. Vazio enquanto carrega. */
  resultLabel?: string;
}

interface FieldsProps {
  values: FilterValues;
  /** `debounce`: o campo é uma data (aplicação adiada no desktop). */
  onPatch: (patch: Partial<FilterValues>, options?: { debounce?: boolean }) => void;
  periodMessage: string | null;
  /** Selects ocupam a linha toda (folha de filtros no celular). */
  wideSelects?: boolean;
  /** Foco inicial no primeiro campo (folha de filtros). */
  autoFocusFirst?: boolean;
}

/** Os quatro campos, iguais no painel do desktop e na folha do celular. */
function FilterFields({ values, onPatch, periodMessage, wideSelects, autoFocusFirst }: FieldsProps) {
  return (
    <>
      <Field label="Categoria" className={cn(wideSelects && "col-span-2")}>
        <Select
          value={values.category}
          onChange={(event) => onPatch({ category: event.target.value })}
          data-autofocus={autoFocusFirst ? true : undefined}
        >
          <option value="">Todas</option>
          {DEMO_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Local" className={cn(wideSelects && "col-span-2")}>
        <Select value={values.location} onChange={(event) => onPatch({ location: event.target.value })}>
          <option value="">Todos</option>
          {DEMO_LOCATIONS.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Encontrado de">
        <Input
          type="date"
          value={values.from}
          onChange={(event) => onPatch({ from: event.target.value }, { debounce: true })}
        />
      </Field>
      <Field label="Encontrado até" error={periodMessage ?? undefined}>
        <Input
          type="date"
          value={values.to}
          onChange={(event) => onPatch({ to: event.target.value }, { debounce: true })}
        />
      </Field>
    </>
  );
}

/**
 * Filtros da busca (DESIGN §6.11): categoria, local e período (data em que foi encontrado), combináveis.
 *
 * - `md` e acima: campos em linha, aplicados ao mudar (sem botão), com "Limpar filtros".
 * - Abaixo de `md`: botão "Filtros (n)" que abre a folha (`Dialog variant="sheet"`) com [Aplicar] e
 *   [Limpar]; filtros ativos viram chips removíveis.
 *
 * É controlado pela URL (`value`/`onChange`): não guarda filtros aplicados por conta própria.
 */
export function FilterBar({ value, onChange, resultLabel }: FilterBarProps) {
  const activeChips = getActiveChips(value);
  const hasFilters = activeChips.length > 0;

  /* ---- Desktop: rascunho local para mostrar o que a pessoa digitou mesmo quando o período é inválido ---- */
  const valueKey = filtersToSearch(value);
  const [draft, setDraft] = useState(value);
  const [syncedKey, setSyncedKey] = useState(valueKey);
  if (valueKey !== syncedKey) {
    // A URL mudou (chip removido, limpar, voltar do navegador): o rascunho acompanha.
    setSyncedKey(valueKey);
    setDraft(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function patchDesktop(patch: Partial<FilterValues>, options?: { debounce?: boolean }) {
    const next = { ...draft, ...patch };
    setDraft(next);
    clearTimeout(timer.current);
    if (periodError(next)) return; // mostra o erro e não aplica
    if (options?.debounce) timer.current = setTimeout(() => onChange(next), DATE_FILTER_DEBOUNCE_MS);
    else onChange(next);
  }

  function clearAll() {
    clearTimeout(timer.current);
    setDraft(EMPTY_FILTERS);
    onChange(EMPTY_FILTERS);
  }

  /* ---- Celular: folha com rascunho próprio, aplicado em [Aplicar] ---- */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState(value);
  const sheetPeriodMessage = periodError(sheetDraft);

  function openSheet() {
    setSheetDraft(value);
    setSheetOpen(true);
  }

  function applySheet() {
    if (sheetPeriodMessage) return;
    onChange(sheetDraft);
    setSheetOpen(false);
  }

  function clearSheet() {
    onChange(EMPTY_FILTERS);
    setSheetOpen(false);
  }

  const count = (
    <p aria-live="polite" className="text-meta text-ink-subtle tabular">
      {resultLabel}
    </p>
  );

  return (
    <section aria-label="Filtros da busca" className="mb-5">
      {/* ≥ 768 px */}
      <div className="hidden md:block">
        <div className="grid gap-x-4 gap-y-2 md:grid-cols-2 lg:grid-cols-4">
          <FilterFields values={draft} onPatch={patchDesktop} periodMessage={periodError(draft)} />
        </div>
        <div className="mt-1 flex min-h-11 items-center justify-between gap-4">
          <CatalogNote />
          <div className="flex shrink-0 items-center gap-4">
            {hasFilters ? (
              <Button variant="ghost" icon={X} onClick={clearAll}>
                Limpar filtros
              </Button>
            ) : null}
            {count}
          </div>
        </div>
      </div>

      {/* < 768 px */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" icon={SlidersHorizontal} onClick={openSheet}>
            {hasFilters ? `Filtros (${activeChips.length})` : "Filtros"}
          </Button>
          {count}
        </div>
        {hasFilters ? (
          <ul aria-label="Filtros ativos" className="mt-3 flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  aria-label={`Remover filtro: ${chip.label}`}
                  onClick={() => onChange({ ...value, [chip.key]: "" })}
                  className="touch-target inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface pr-2.5 pl-3.5 text-meta font-semibold text-ink hover:bg-primary-soft active:bg-primary-softer"
                >
                  {chip.label}
                  <X aria-hidden="true" className="size-4 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtros"
        variant="sheet"
        actions={
          <>
            <Button variant="ghost" size="lg" width="mobile-full" onClick={clearSheet}>
              Limpar
            </Button>
            <Button size="lg" width="mobile-full" onClick={applySheet}>
              Aplicar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <FilterFields
            values={sheetDraft}
            onPatch={(patch) => setSheetDraft((current) => ({ ...current, ...patch }))}
            periodMessage={sheetPeriodMessage}
            wideSelects
            autoFocusFirst
          />
          <CatalogNote className="col-span-2" />
        </div>
      </Dialog>
    </section>
  );
}
