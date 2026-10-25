"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentProps, MouseEvent, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-quiet";
export type ButtonSize = "md" | "lg";
/** `mobile-full`: largura total até `sm`, automática a partir daí (formulários e barras de ação). */
export type ButtonWidth = "auto" | "full" | "mobile-full";

const BASE =
  "group/btn relative inline-flex items-center justify-center rounded-md px-4 text-body font-semibold select-none " +
  "transition-[background-color,border-color,color,box-shadow,translate,scale] duration-150 ease-standard " +
  "disabled:cursor-not-allowed motion-safe:not-disabled:active:scale-[0.98]";

/** Elevação sutil ao passar o mouse (só em dispositivos com hover; nunca em botão desabilitado nem com movimento reduzido). */
const LIFT = "motion-safe:not-disabled:hover:-translate-y-px motion-safe:not-disabled:active:translate-y-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed not-disabled:hover:shadow-raised " +
    LIFT + " disabled:bg-disabled-bg disabled:text-disabled-fg",
  secondary:
    "border-[1.5px] border-primary bg-surface text-primary hover:bg-primary-soft active:bg-primary-softer " +
    "not-disabled:hover:shadow-card " + LIFT + " " +
    "disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-fg",
  ghost:
    "bg-transparent text-primary hover:bg-primary-soft active:bg-primary-softer " +
    "disabled:bg-transparent disabled:text-disabled-fg",
  danger:
    "bg-danger-solid text-on-danger hover:bg-danger-solid-hover active:bg-danger-solid-hover " +
    "not-disabled:hover:shadow-raised " + LIFT + " disabled:bg-disabled-bg disabled:text-disabled-fg",
  "danger-quiet":
    "border-[1.5px] border-danger-border bg-surface text-danger-fg hover:bg-danger-bg active:bg-danger-bg " +
    "disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-fg",
};

const SIZES: Record<ButtonSize, string> = {
  md: "touch-target",
  lg: "touch-target-lg px-5",
};

const WIDTHS: Record<ButtonWidth, string> = {
  auto: "",
  full: "w-full",
  "mobile-full": "w-full sm:w-auto",
};

/** Classes de botão, também usadas por `LinkButton`. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  width = "auto",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  width?: ButtonWidth;
  className?: string;
} = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], WIDTHS[width], className);
}

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  width?: ButtonWidth;
  /** Ícone de 20 px à esquerda do rótulo. */
  icon?: LucideIcon;
}

/** Rótulo empilhado na célula única de uma grade (ver `Button`). */
function Label({
  icon: Icon,
  hidden,
  children,
}: {
  icon?: LucideIcon;
  hidden: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn("col-start-1 row-start-1 inline-flex items-center justify-center gap-2", hidden && "invisible")}
      aria-hidden={hidden || undefined}
    >
      {Icon ? <Icon aria-hidden="true" className="size-5 shrink-0" /> : null}
      {children}
    </span>
  );
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">, StyleProps {
  className?: string;
  ref?: Ref<HTMLButtonElement>;
  /**
   * Enviando: mostra o spinner, ignora cliques, marca `aria-busy` e preserva a largura.
   * Para indisponibilidade por permissão ou status NÃO use `disabled`: mostre o motivo em texto (DESIGN §6.1).
   */
  loading?: boolean;
  /** Rótulo no estado `loading` (gerúndio, ex.: "Salvando…"). Padrão: o próprio rótulo. */
  loadingText?: string;
}

export function Button({
  variant,
  size,
  width,
  icon,
  loading = false,
  loadingText,
  className,
  type = "button",
  children,
  onClick,
  ref,
  ...props
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      // Sem `disabled`: o foco não se perde. Também impede o envio do formulário.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, width, className })}
      onClick={handleClick}
      {...props}
    >
      {/* Os dois rótulos ocupam a mesma célula: a largura é a do maior e não salta ao carregar. */}
      <span className="grid">
        <Label icon={icon} hidden={loading}>
          {children}
        </Label>
        <Label hidden={!loading}>
          <Spinner />
          {loadingText ?? children}
        </Label>
      </span>
    </button>
  );
}

/** Link com aparência de botão (navegação, não ação). */
export function LinkButton({
  variant,
  size,
  width,
  icon: Icon,
  className,
  children,
  ...props
}: StyleProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonStyles({ variant, size, width, className: cn("gap-2 no-underline", className) })} {...props}>
      {Icon ? <Icon aria-hidden="true" className="size-5 shrink-0" /> : null}
      {children}
    </Link>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "aria-label"> {
  /** Nome acessível (obrigatório: não há texto visível). */
  label: string;
  icon: LucideIcon;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Botão só de ícone, alvo de 44 × 44 px. */
export function IconButton({ label, icon: Icon, className, type = "button", ref, ...props }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "touch-target inline-flex items-center justify-center rounded-md text-ink transition-colors",
        "hover:bg-primary-soft active:bg-primary-softer disabled:cursor-not-allowed disabled:text-disabled-fg",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}
