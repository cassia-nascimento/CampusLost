/** Limites da foto do item (AC02.2). A foto é opcional (P6). */
export const PHOTO_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 640;
export const PHOTO_ACCEPT_ATTR = PHOTO_ACCEPTED_TYPES.join(",");

/** `null` quando válida; senão a mensagem em pt-BR. Aceita qualquer objeto com `type` e `size` (ex.: `File`). */
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!(PHOTO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Formato não aceito. Use JPG, PNG ou WebP.";
  }
  if (file.size <= 0) return "O arquivo está vazio.";
  if (file.size > PHOTO_MAX_BYTES) {
    return `A foto passa de ${PHOTO_MAX_BYTES / (1024 * 1024)} MB. Escolha uma menor.`;
  }
  return null;
}

/**
 * Valor aceito em `Item.photoDataUrl` (P27): data URL de imagem OU caminho público ilustrativo
 * `/seed/<slug>.svg`. Usado só para checar o que já está guardado; a escolha de arquivo usa `validatePhotoFile`.
 */
const STORED_PHOTO_PATTERN = /^(data:image\/(jpeg|png|webp);base64,|\/seed\/[a-z0-9-]+\.svg$)/;
export function isStoredPhotoSrc(value: string): boolean {
  return STORED_PHOTO_PATTERN.test(value);
}
