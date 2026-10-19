import { ServiceError } from "@/types/domain";
import {
  PHOTO_MAX_DIMENSION,
  validatePhotoFile,
} from "@/lib/validation/photo";

/** Converte um arquivo escolhido em data URL pronto para guardar. */
export type PhotoProcessor = (file: File) => Promise<string>;

const JPEG_QUALITIES = [0.8, 0.6, 0.45];
/** Teto do data URL final (≈ 300 KB) para caber no `localStorage`. */
const MAX_DATA_URL_LENGTH = 400_000;

/** Reduz proporcionalmente para caber em `max` × `max` (nunca amplia). */
export function fitWithin(
  width: number,
  height: number,
  max: number = PHOTO_MAX_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Implementação de navegador: valida, redimensiona (≤ 640 px) e exporta JPEG. */
export const processPhotoInBrowser: PhotoProcessor = async (file) => {
  const problem = validatePhotoFile(file);
  if (problem) throw new ServiceError("PHOTO_INVALID", problem);
  if (typeof document === "undefined") {
    throw new ServiceError("PHOTO_INVALID", "Não foi possível processar a foto neste ambiente.");
  }
  try {
    const decoded = await decode(file);
    try {
      const { width, height } = fitWithin(decoded.width, decoded.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas indisponível");
      ctx.fillStyle = "#ffffff"; // PNG/WebP transparentes viram JPEG sobre branco
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(decoded.source, 0, 0, width, height);
      let dataUrl = "";
      for (const quality of JPEG_QUALITIES) {
        dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= MAX_DATA_URL_LENGTH) break;
      }
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        throw new ServiceError(
          "PHOTO_INVALID",
          "A foto continua grande demais mesmo depois de reduzida. Escolha uma imagem mais simples ou menor.",
        );
      }
      return dataUrl;
    } finally {
      decoded.release();
    }
  } catch (cause) {
    if (cause instanceof ServiceError) throw cause;
    throw new ServiceError(
      "PHOTO_INVALID",
      "Não foi possível ler a imagem. Tente outro arquivo.",
      { cause },
    );
  }
};
