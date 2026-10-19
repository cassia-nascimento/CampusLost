/** Utilitários de data puros. Nenhum acessa o relógio: a data de referência vem por parâmetro. */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` no calendário local de `date`. */
export function toLocalDateString(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `true` para `YYYY-MM-DD` que existe no calendário (rejeita 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(y, m - 1, d);
  return (
    probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d
  );
}

/** Soma `days` (pode ser negativo) preservando a hora local. */
export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

/** Data local (`YYYY-MM-DD`) de um instante ISO. */
export function localDateOfInstant(isoInstant: string): string {
  return toLocalDateString(new Date(isoInstant));
}

/** Compara `YYYY-MM-DD` lexicograficamente: `date` é posterior a `today`? */
export function isFutureDate(date: string, today: string): boolean {
  return date > today;
}
