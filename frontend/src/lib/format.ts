/**
 * Formatação de datas e contagens em pt-BR (DESIGN §10).
 *
 * - Datas de calendário chegam como `YYYY-MM-DD` e são tratadas SEM fuso (sem `new Date("YYYY-MM-DD")`,
 *   que interpreta como UTC e pode mostrar o dia anterior).
 * - Instantes ISO 8601 são convertidos para o fuso local do navegador.
 * - Relativas só até 7 dias ("hoje", "ontem", "há 3 dias"); depois, `dd/mm/aaaa`.
 */
import { localDateOfInstant, toLocalDateString } from "@/lib/rules";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Limite (em dias) para usar a forma relativa. */
export const RELATIVE_DAYS_LIMIT = 7;

function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** `YYYY-MM-DD` → `dd/mm/aaaa`. Valor fora do formato é devolvido como veio. */
export function formatDate(isoDate: string): string {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  return `${String(parts.d).padStart(2, "0")}/${String(parts.m).padStart(2, "0")}/${String(parts.y).padStart(4, "0")}`;
}

/** Instante ISO → `dd/mm/aaaa` no fuso local. */
export function formatInstantDate(isoInstant: string): string {
  return formatDate(localDateOfInstant(isoInstant));
}

/** Instante ISO → `hh:mm` no fuso local. */
export function formatTime(isoInstant: string): string {
  const date = new Date(isoInstant);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Instante ISO → `dd/mm/aaaa às hh:mm`. */
export function formatDateTime(isoInstant: string): string {
  return `${formatInstantDate(isoInstant)} às ${formatTime(isoInstant)}`;
}

/** Diferença em dias de calendário (today − date); positivo = no passado. */
function diffInDays(isoDate: string, todayIso: string): number | null {
  const a = parseIsoDate(isoDate);
  const b = parseIsoDate(todayIso);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / MS_PER_DAY);
}

/**
 * `YYYY-MM-DD` → "hoje" | "ontem" | "há N dias" (até 7 dias) | `dd/mm/aaaa`.
 * Datas futuras mostram a data completa. `now` é injetável para testes.
 */
export function formatRelativeDate(isoDate: string, now: Date = new Date()): string {
  const diff = diffInDays(isoDate, toLocalDateString(now));
  if (diff === null || diff < 0 || diff > RELATIVE_DAYS_LIMIT) return formatDate(isoDate);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  return `há ${diff} dias`;
}

/** Instante ISO → forma relativa pelo dia local. */
export function formatRelativeInstant(isoInstant: string, now: Date = new Date()): string {
  return formatRelativeDate(localDateOfInstant(isoInstant), now);
}

/** "1 item" / "12 itens". */
export function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Primeira letra do nome, maiúscula (avatar do menu da conta). */
export function getInitial(name: string): string {
  const letter = name.trim().charAt(0);
  return letter ? letter.toLocaleUpperCase("pt-BR") : "?";
}
