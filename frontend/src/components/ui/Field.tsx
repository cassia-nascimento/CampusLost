"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Props de acessibilidade que o `Field` entrega ao controle (id, aria-describedby, aria-invalid). */
export function useFieldControl(own: { id?: string; "aria-describedby"?: string }) {
  const field = useContext(FieldContext);
  const describedBy = [own["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  return {
    id: own.id ?? field?.id,
    "aria-describedby": describedBy,
    "aria-invalid": field?.invalid ? true : undefined,
  } as const;
}

export interface FieldProps {
  label: string;
  /** Marca "(opcional)" ao lado do rótulo; não há asterisco (DESIGN §6.3). */
  optional?: boolean;
  /** Texto de ajuda, abaixo do rótulo. */
  hint?: ReactNode;
  /** Mensagem de erro; a região `aria-live` existe sempre, para o anúncio funcionar. */
  error?: string;
  /** Um único controle: Input, Select, Textarea ou FileInput. */
  children: ReactNode;
  className?: string;
}

/** Rótulo + ajuda + controle + erro, com `label for` e `aria-describedby` ligados (DESIGN §6.3). */
export function Field({ label, optional, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-meta font-semibold text-ink">
          {label}
          {optional ? <span className="font-normal text-ink-subtle"> (opcional)</span> : null}
        </label>
        {hint ? (
          <p id={hintId} className="text-meta text-ink-muted">
            {hint}
          </p>
        ) : null}
        {children}
        <div id={errorId} aria-live="polite">
          {error ? (
            <p className="flex items-start gap-1.5 text-meta text-danger-fg">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
        </div>
      </div>
    </FieldContext>
  );
}
