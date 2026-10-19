"use client";

import { ChevronDown } from "lucide-react";
import type { Ref, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { CONTROL_CLASSES } from "./controls";
import { useFieldControl } from "./Field";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>;
}

/** `<select>` nativo (o seletor do sistema é mais rápido e acessível no celular), com chevron próprio. */
export function Select({ className, children, ref, ...props }: SelectProps) {
  const control = useFieldControl(props);
  return (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        {...control}
        className={cn(CONTROL_CLASSES, "appearance-none pr-10", className)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
