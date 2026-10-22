import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge conhece só a escala padrão do Tailwind. Os tokens do design system
 * (globals.css) precisam ser declarados aqui; senão `text-body` seria tratado como cor
 * e removido ao lado de `text-ink`, e `shadow-card` conflitaria com cores de sombra.
 */
const twMerge = extendTailwindMerge<"touch-target">({
  extend: {
    theme: {
      text: ["meta", "body", "lead", "h3", "h2", "h1", "display"],
      shadow: ["card", "raised", "overlay", "bar"],
      container: ["form", "page", "admin"],
    },
    classGroups: {
      "touch-target": [{ "touch-target": ["", "lg"] }],
      animate: [{ animate: ["rise", "fade"] }],
    },
  },
});

/** Junta classes condicionais (clsx) e resolve conflitos do Tailwind (tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Imagens ilustrativas do seed (P27) ficam em `/seed/*.svg`; fotos enviadas pelo usuário são data URLs. */
export function isSeedImage(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith("/seed/");
}

/** Texto alternativo da foto de um item: as ilustrações do seed se declaram ilustrativas (DESIGN §2.5). */
export function itemPhotoAlt(title: string, src: string | null | undefined): string {
  return isSeedImage(src) ? `Imagem ilustrativa: ${title}` : `Foto de ${title}`;
}
