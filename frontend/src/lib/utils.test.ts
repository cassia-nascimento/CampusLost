import { describe, expect, it } from "vitest";
import { cn, isSeedImage, itemPhotoAlt } from "./utils";

describe("cn", () => {
  it("junta classes e ignora valores falsos", () => {
    expect(cn("a", false, null, undefined, "b", { c: true, d: false })).toBe("a b c");
  });

  it("resolve conflitos de cor mantendo o último", () => {
    expect(cn("text-ink", "text-primary")).toBe("text-primary");
    expect(cn("bg-surface", "bg-primary-soft")).toBe("bg-primary-soft");
  });

  it("não remove tamanho de texto do design system ao lado de cor de texto", () => {
    expect(cn("text-body", "text-ink")).toBe("text-body text-ink");
    expect(cn("text-meta", "text-ink-subtle")).toBe("text-meta text-ink-subtle");
    expect(cn("text-ink", "text-lead")).toBe("text-ink text-lead");
  });

  it("resolve conflito entre tamanhos de texto do design system", () => {
    expect(cn("text-body", "text-lead")).toBe("text-lead");
    expect(cn("text-h2 font-bold", "text-h3")).toBe("font-bold text-h3");
  });

  it("não confunde sombras do design system com cor de sombra", () => {
    expect(cn("shadow-card", "shadow-raised")).toBe("shadow-raised");
  });

  it("resolve larguras máximas do design system", () => {
    expect(cn("max-w-form", "max-w-page")).toBe("max-w-page");
    expect(cn("max-w-md", "max-w-admin")).toBe("max-w-admin");
  });

  it("não funde tokens de alvo de toque entre si de forma indevida", () => {
    expect(cn("touch-target", "touch-target-lg")).toBe("touch-target-lg");
    expect(cn("touch-target", "px-4")).toBe("touch-target px-4");
  });
});

describe("isSeedImage", () => {
  it("reconhece só os caminhos das imagens ilustrativas do seed", () => {
    expect(isSeedImage("/seed/mochila.svg")).toBe(true);
    expect(isSeedImage("/seed/bone.webp")).toBe(true);
    expect(isSeedImage("/seed/bone.png")).toBe(false);
    expect(isSeedImage("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isSeedImage("blob:http://localhost/abc")).toBe(false);
    expect(isSeedImage("https://exemplo.com/seed/x.svg")).toBe(false);
    expect(isSeedImage("")).toBe(false);
    expect(isSeedImage(null)).toBe(false);
    expect(isSeedImage(undefined)).toBe(false);
  });
});

describe("itemPhotoAlt", () => {
  it("declara a imagem do seed como ilustrativa e descreve as fotos enviadas", () => {
    expect(itemPhotoAlt("Mochila preta", "/seed/mochila.svg")).toBe("Imagem ilustrativa: Mochila preta");
    expect(itemPhotoAlt("Mochila preta", "data:image/jpeg;base64,AAAA")).toBe("Foto de Mochila preta");
    expect(itemPhotoAlt("Mochila preta", undefined)).toBe("Foto de Mochila preta");
  });
});
