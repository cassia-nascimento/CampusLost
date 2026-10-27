import type { HttpClient } from "./http";
import { asArray, asRecord } from "./mappers";

export interface ApiCatalog {
  categories: string[];
  /** Locais de EXEMPLO (o local do item é texto livre; não valida nem filtra). */
  locations: string[];
  notice: string;
}

/** `GET /catalog`. As telas seguem usando `types/catalog.ts` (categorias; locais são só exemplos); útil para conferir se o servidor concorda. */
export async function fetchCatalog(http: HttpClient): Promise<ApiCatalog> {
  const raw = asRecord(await http.request("GET", "/catalog", { auth: false }), "catálogo");
  const strings = (value: unknown, what: string) => asArray(value, what).filter((v): v is string => typeof v === "string");
  return {
    categories: strings(raw.categories, "categorias"),
    locations: strings(raw.locations, "locais"),
    notice: typeof raw.notice === "string" ? raw.notice : "",
  };
}
