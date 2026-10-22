"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type Ref } from "react";
import { Input } from "@/components/ui/Input";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  ref?: Ref<HTMLInputElement>;
}

/** Campo de senha com botão mostrar/ocultar (alvo de 44 px, `aria-pressed`). Use dentro de `Field`; aceita `register()`. */
export function PasswordInput({ ref, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? "text" : "password"} autoCapitalize="none" spellCheck={false} className="pr-12" {...props} />
      <button
        type="button"
        aria-pressed={visible}
        aria-label="Mostrar senha"
        onClick={() => setVisible((v) => !v)}
        className="touch-target absolute inset-y-0 right-0 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink"
      >
        <Icon aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
