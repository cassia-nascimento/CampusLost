"use client";

import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { CONTROL_CLASSES } from "./controls";
import { useFieldControl } from "./Field";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

/** Campo de texto (inclui `type="date"` e `type="email"`). Use dentro de `Field`; aceita `register()` do RHF. */
export function Input({ className, ref, ...props }: InputProps) {
  const control = useFieldControl(props);
  return <input ref={ref} {...props} {...control} className={cn(CONTROL_CLASSES, className)} />;
}
