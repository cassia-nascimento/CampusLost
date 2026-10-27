import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { getApiBaseUrl } from "@/lib/api-config";

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

const SEED_PATH = /^(?:\/uploads)?\/seed\/[a-z0-9-]+\.(?:svg|webp)$/;

/**
 * Imagens ilustrativas do seed (P27): `/seed/*.svg|webp` (mock) ou `<API>/uploads/seed/*.svg|webp` (API). Fotos enviadas
 * pelo usuário (data URL, `/uploads/<uuid>.jpg`) não entram. Só aceita URL absoluta da própria API.
 */
export function isSeedImage(src: string | null | undefined, apiBaseUrl: string = getApiBaseUrl()): boolean {
  if (typeof src !== "string") return false;
  const path = apiBaseUrl && src.startsWith(`${apiBaseUrl}/`) ? src.slice(apiBaseUrl.length) : src;
  return SEED_PATH.test(path);
}

/** Texto alternativo da foto de um item: as ilustrações do seed se declaram ilustrativas (DESIGN §2.5). */
export function itemPhotoAlt(title: string, src: string | null | undefined): string {
  return isSeedImage(src) ? `Imagem ilustrativa: ${title}` : `Foto de ${title}`;
}
