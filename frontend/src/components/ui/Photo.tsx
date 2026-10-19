import Image from "next/image";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PhotoProps {
  /** URL, data URL ou blob. Sem valor, mostra o placeholder de etiqueta (DESIGN §2.5). */
  src?: string | null;
  /** Vazio (`""`) quando a foto é decorativa (o título do item já a descreve). */
  alt: string;
  /** Proporção. Padrão: preenche o contêiner (use `className` para definir o tamanho). */
  aspect?: "square" | "landscape";
  /** Tamanho do ícone do placeholder. */
  iconSize?: "md" | "lg";
  sizes?: string;
  className?: string;
}

/** Foto do item com placeholder. Fotos são data URLs do protótipo, por isso sem otimização do Next. */
export function Photo({ src, alt, aspect, iconSize = "md", sizes = "100vw", className }: PhotoProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-sunken",
        aspect === "square" && "aspect-square",
        aspect === "landscape" && "aspect-[4/3]",
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={alt} fill unoptimized sizes={sizes} className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Tag
            aria-hidden="true"
            className={cn("tag-shape text-ink-subtle", iconSize === "lg" ? "size-10" : "size-6")}
          />
          {alt ? <span className="sr-only">Sem foto</span> : null}
        </div>
      )}
    </div>
  );
}
