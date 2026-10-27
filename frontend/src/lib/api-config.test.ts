import { afterEach, describe, expect, it, vi } from "vitest";
import { API_PROXY_PREFIX, getApiBaseUrl, getApiTargetUrl, parseApiBaseUrl } from "./api-config";
import { isRenderablePhotoSrc, isStoredPhotoSrc } from "./validation/photo";
import { isSeedImage, itemPhotoAlt } from "./utils";

const API = "http://127.0.0.1:8000";
const UUID = "0123456789abcdef0123456789abcdef";

describe("parseApiBaseUrl", () => {
  it("remove barras finais e espaços; ausente/inválido/esquema estranho = vazio (modo mock)", () => {
    expect(parseApiBaseUrl("http://localhost:8000/")).toBe("http://localhost:8000");
    expect(parseApiBaseUrl(" https://api.exemplo.com// ")).toBe("https://api.exemplo.com");
    expect(parseApiBaseUrl(undefined)).toBe("");
    expect(parseApiBaseUrl("")).toBe("");
    expect(parseApiBaseUrl("localhost:8000")).toBe("");
    expect(parseApiBaseUrl("javascript:alert(1)")).toBe("");
    expect(parseApiBaseUrl("ftp://x.test")).toBe("");
  });
});

describe("base same-origin (cookie HttpOnly)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("com NEXT_PUBLIC_API_URL válida o cliente usa o prefixo /backend; o destino real fica à parte", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000/");
    expect(API_PROXY_PREFIX).toBe("/backend");
    expect(getApiBaseUrl()).toBe("/backend");
    expect(getApiTargetUrl()).toBe("http://127.0.0.1:8000");
  });

  it("ausente ou inválida = modo mock (base vazia)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(getApiBaseUrl()).toBe("");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "javascript:alert(1)");
    expect(getApiBaseUrl()).toBe("");
  });

  it("fotos da API no prefixo same-origin são aceitas; outro host ou // não", () => {
    const ok = `/backend/uploads/${UUID}.jpg`;
    expect(isStoredPhotoSrc(ok, "/backend")).toBe(true);
    expect(isStoredPhotoSrc(`/backend/uploads/seed/mochila.webp`, "/backend")).toBe(true);
    expect(isStoredPhotoSrc(`//evil.test/backend/uploads/${UUID}.jpg`, "/backend")).toBe(false);
    expect(isStoredPhotoSrc(`/backend/uploads/../x.jpg`, "/backend")).toBe(false);
    expect(isSeedImage("/backend/uploads/seed/mochila.webp", "/backend")).toBe(true);
  });
});

describe("guardas de foto com a API", () => {
  it("aceita data URL, /seed e /uploads da própria API; recusa o resto", () => {
    for (const ok of ["data:image/png;base64,AAAA", "/seed/mochila.webp", `${API}/uploads/${UUID}.jpg`, `${API}/uploads/seed/mochila.webp`]) {
      expect(isStoredPhotoSrc(ok, API), ok).toBe(true);
    }
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html;base64,AAAA",
      "data:image/svg+xml;base64,AAAA",
      `http://evil.test/uploads/${UUID}.jpg`,
      `${API}.evil.test/uploads/${UUID}.jpg`,
      `${API}/uploads/../etc.png`,
      `${API}/uploads/${UUID}.html`,
      `${API}/outra/${UUID}.jpg`,
      `${API}/uploads/seed/x.svg?x=1`,
      `${API}@evil.test/uploads/${UUID}.jpg`,
      "",
    ]) {
      expect(isStoredPhotoSrc(bad, API), bad).toBe(false);
    }
  });

  it("sem API configurada, URL absoluta nunca vale", () => {
    expect(isStoredPhotoSrc(`${API}/uploads/${UUID}.jpg`, "")).toBe(false);
    expect(isStoredPhotoSrc("//evil.test/seed/x.svg", "")).toBe(false);
  });

  it("isRenderablePhotoSrc também aceita blob: (pré-visualização)", () => {
    expect(isRenderablePhotoSrc("blob:http://localhost/abc", API)).toBe(true);
    expect(isRenderablePhotoSrc("javascript:alert(1)", API)).toBe(false);
  });

  it("isSeedImage: só ilustrações do seed (legenda 'Imagem ilustrativa')", () => {
    expect(isSeedImage("/seed/mochila.webp", API)).toBe(true);
    expect(isSeedImage(`${API}/uploads/seed/bone.webp`, API)).toBe(true);
    expect(isStoredPhotoSrc(`${API}/uploads/seed/bone.webp`, API)).toBe(true);
    expect(isStoredPhotoSrc("/seed/bone.webp", API)).toBe(true);
    expect(isStoredPhotoSrc("/seed/../bone.webp", API)).toBe(false);
    expect(isSeedImage(`${API}/uploads/seed/mochila.webp`, API)).toBe(true);
    expect(isSeedImage(`${API}/uploads/${UUID}.png`, API)).toBe(false);
    expect(isSeedImage("https://exemplo.com/uploads/seed/x.svg", API)).toBe(false);
    expect(isSeedImage(`${API}/uploads/seed/x.svg.png`, API)).toBe(false);
    expect(itemPhotoAlt("Mochila", `${API}/uploads/seed/mochila.webp`)).toBe("Foto de Mochila"); // base vem do ambiente (vazio nos testes)
    expect(itemPhotoAlt("Mochila", "/seed/mochila.webp")).toBe("Imagem ilustrativa: Mochila");
  });
});
