"use client";

import { Check, CircleAlert } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "children"> {
  /** Texto do rótulo; pode conter um link (ele não marca a caixa). */
  label: ReactNode;
  /** Mensagem de erro; a região `aria-live` existe sempre, para o anúncio funcionar. */
  error?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Caixa de seleção com alvo de 44 px (a linha inteira é o rótulo), caixa nativa para teclado e leitor de tela e
 * erro ligado por `aria-describedby`. Marcada = fundo `primary` + visto: nunca só cor (DESIGN §6.3). Aceita `register()`.
 */
export function Checkbox({ label, error, className, ref, ...props }: CheckboxProps) {
  const errorId = `${useId()}-error`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        className={cn(
          "group flex touch-target cursor-pointer items-start gap-3 rounded-md py-2.5 text-body text-ink",
          "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
          "has-disabled:cursor-not-allowed has-disabled:text-disabled-fg",
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border-[1.5px] bg-surface text-on-primary",
            error ? "border-danger-border" : "border-line-strong",
            "group-has-checked:border-primary group-has-checked:bg-primary",
          )}
        >
          <Check className="size-4 opacity-0 group-has-checked:opacity-100" />
        </span>
        <span className="min-w-0">{label}</span>
      </label>
      <div id={errorId} aria-live="polite">
        {error ? (
          <p className="flex items-start gap-1.5 text-meta text-danger-fg">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
