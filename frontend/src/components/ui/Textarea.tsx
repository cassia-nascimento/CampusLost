"use client";

import type { Ref, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { CONTROL_CLASSES } from "./controls";
import { useFieldControl } from "./Field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
  /**
   * Comprimento atual (ex.: `watch("campo").length`). Junto com `maxLength`, mostra o contador
   * "n/máx" a partir de 80 % do limite.
   */
  currentLength?: number;
}

export function Textarea({ className, currentLength, ref, ...props }: TextareaProps) {
  const control = useFieldControl(props);
  const max = props.maxLength;
  const showCounter = max !== undefined && currentLength !== undefined && currentLength >= max * 0.8;
  return (
    <div>
      <textarea
        ref={ref}
        {...props}
        {...control}
        className={cn(CONTROL_CLASSES, "min-h-28 resize-y py-3", className)}
      />
      {showCounter ? (
        <p className="mt-1 text-right text-meta text-ink-subtle tabular">
          {currentLength}/{max}
        </p>
      ) : null}
    </div>
  );
}
