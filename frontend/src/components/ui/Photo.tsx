import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { isRenderablePhotoSrc } from "@/lib/validation/photo";

export interface PhotoProps {
  /** Caminho (`/seed/*.svg|webp`), data URL, blob ou URL de `/uploads/*` da API (qualquer outro valor vira o placeholder). Sem valor, mostra o placeholder de etiqueta (DESIGN §2.5). */
  src?: string | null;
  /** Vazio (`""`) quando a foto é decorativa (o título do item já a descreve). */
  alt: string;
  /** Proporção. Padrão: preenche o contêiner (use `className` para definir o tamanho). */
  aspect?: "square" | "landscape";
  /** Tamanho do ícone do placeholder. */
  iconSize?: "md" | "lg";
  /** Imagem principal da tela (acima da dobra): carrega já, com prioridade. As demais ficam preguiçosas. */
  eager?: boolean;
  className?: string;
}

/**
 * Foto do item com placeholder. `<img>` simples: as imagens são imagens do seed (`/seed/*.svg|webp`; fotos reais e ilustrações), data
 * URLs ou blobs do protótipo, que o otimizador do Next não trata (DESIGN §2.5).
 */
export function Photo({ src, alt, aspect, iconSize = "md", eager = false, className }: PhotoProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-sunken",
        aspect === "square" && "aspect-square",
        aspect === "landscape" && "aspect-[4/3]",
        className,
      )}
    >
      {src && isRenderablePhotoSrc(src) ? (
        // eslint-disable-next-line @next/next/no-img-element -- ver o comentário do componente
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
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
