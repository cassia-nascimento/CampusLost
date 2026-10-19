"use client";

import { Check, CircleAlert } from "lucide-react";
import { createContext, useContext, useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

interface GroupContextValue {
  invalid: boolean;
}

const GroupContext = createContext<GroupContextValue>({ invalid: false });

export interface RadioGroupProps {
  /** Pergunta do grupo (vira o `<legend>`). */
  legend: string;
  hint?: ReactNode;
  /** Mensagem de erro; a região `aria-live` existe sempre, para o anúncio funcionar. */
  error?: string;
  /** Os `RadioCard`s (mesmo `name`; com react-hook-form, `{...register("campo")}` em cada um). */
  children: ReactNode;
  className?: string;
}

/** Grupo de opções exclusivas: `<fieldset>` + `<legend>`, ajuda e erro ligados por `aria-describedby` (DESIGN §6.3). */
export function RadioGroup({ legend, hint, error, children, className }: RadioGroupProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset role="radiogroup" aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <legend className="text-meta font-semibold text-ink">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-meta text-ink-muted">
          {hint}
        </p>
      ) : null}
      <GroupContext value={{ invalid: Boolean(error) }}>
        <div className="mt-1.5 grid gap-3 sm:grid-cols-2">{children}</div>
      </GroupContext>
      <div id={errorId} aria-live="polite">
        {error ? (
          <p className="flex items-start gap-1.5 text-meta text-danger-fg">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}

export interface RadioCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "children"> {
  label: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Opção de 48 px com rádio nativo (teclado e leitor de tela funcionam como o esperado). Selecionada =
 * borda de 2 px `primary` + fundo `primary-soft` + ícone de visto: nunca só cor (DESIGN §6.3).
 */
export function RadioCard({ label, className, ref, ...props }: RadioCardProps) {
  const group = useContext(GroupContext);
  return (
    <label
      className={cn(
        "group relative flex touch-target-lg cursor-pointer items-center gap-3 rounded-md border bg-surface px-3.5 py-2",
        "text-body font-semibold text-ink transition-colors",
        group.invalid ? "border-danger-border" : "border-line-strong hover:border-ink-muted",
        "has-checked:border-primary has-checked:bg-primary-soft has-checked:shadow-[inset_0_0_0_1px_var(--color-primary)]",
        "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
        "has-disabled:cursor-not-allowed has-disabled:bg-disabled-bg has-disabled:text-disabled-fg",
        className,
      )}
    >
      <input ref={ref} type="radio" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong bg-surface text-on-primary group-has-checked:border-primary group-has-checked:bg-primary"
      >
        <Check className="size-4 opacity-0 group-has-checked:opacity-100" />
      </span>
      {label}
    </label>
  );
}
