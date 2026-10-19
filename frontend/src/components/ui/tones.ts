/**
 * Tons semânticos do design system (DESIGN §3.1). Cada tom mapeia para classes COMPLETAS
 * (o Tailwind só gera CSS para strings literais presentes no código).
 */
export type Tone = "success" | "warning" | "danger" | "neutral" | "info";

export interface ToneClasses {
  /** Texto e ícone sobre o fundo do tom (`*-fg`). */
  fg: string;
  /** Pílula/aviso: fundo + texto + contorno de 1 px. */
  surface: string;
  /** Contorno do tom, em separado (barra lateral do toast). */
  border: string;
}

export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  success: {
    fg: "text-success-fg",
    surface: "border-success-border bg-success-bg text-success-fg",
    border: "border-success-border",
  },
  warning: {
    fg: "text-warning-fg",
    surface: "border-warning-border bg-warning-bg text-warning-fg",
    border: "border-warning-border",
  },
  danger: {
    fg: "text-danger-fg",
    surface: "border-danger-border bg-danger-bg text-danger-fg",
    border: "border-danger-border",
  },
  neutral: {
    fg: "text-neutral-fg",
    surface: "border-neutral-border bg-neutral-bg text-neutral-fg",
    border: "border-neutral-border",
  },
  info: {
    fg: "text-info-fg",
    surface: "border-info-border bg-info-bg text-info-fg",
    border: "border-info-border",
  },
};
