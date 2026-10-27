import { getApiBaseUrl } from "@/lib/api-config";

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

/** Nome de arquivo servido pela API: `/uploads/<uuid>.jpg|png|webp` ou `/uploads/seed/<slug>.svg|webp`. */
const API_UPLOAD_PATH = /^\/uploads\/(?:[a-f0-9]{16,64}\.(?:jpe?g|png|webp)|seed\/[a-z0-9-]+\.(?:svg|webp))$/i;

/**
 * Caminho relativo `photoUrl` da API -> caminho aceito, ou `null`. Recusa qualquer coisa fora de
 * `/uploads/...` (esquemas, `//host`, `..`, barras invertidas).
 */
export function isApiUploadPath(path: string): boolean {
  return API_UPLOAD_PATH.test(path);
}

/**
 * Valor aceito em `Item.photoDataUrl` (P27; nome histórico do campo): data URL de imagem, caminho público
 * ilustrativo `/seed/<slug>.svg|webp` OU, em modo API, URL absoluta de `/uploads/...` DA PRÓPRIA API
 * (`apiBaseUrl`, de `getApiBaseUrl()`). Qualquer outro esquema (`javascript:`, `http://outro-host/...`) é recusado.
 * Usado só para checar o que já está guardado; a escolha de arquivo usa `validatePhotoFile`.
 */
const STORED_PHOTO_PATTERN = /^(data:image\/(jpeg|png|webp);base64,|\/seed\/[a-z0-9-]+\.(?:svg|webp)$)/;
export function isStoredPhotoSrc(value: string, apiBaseUrl: string = getApiBaseUrl()): boolean {
  if (STORED_PHOTO_PATTERN.test(value)) return true;
  if (!apiBaseUrl || !value.startsWith(`${apiBaseUrl}/`)) return false;
  return isApiUploadPath(value.slice(apiBaseUrl.length));
}

/** O que `<Photo>` pode exibir: o que pode ser guardado mais `blob:` (pré-visualização de arquivo escolhido). */
export function isRenderablePhotoSrc(value: string, apiBaseUrl: string = getApiBaseUrl()): boolean {
  return isStoredPhotoSrc(value, apiBaseUrl) || /^blob:/i.test(value);
}
