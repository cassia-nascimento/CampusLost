import type { HttpClient } from "./http";
import { asArray, asRecord } from "./mappers";

export interface ApiCatalog {
  categories: string[];
  locations: string[];
  notice: string;
}

/** `GET /catalog`. As telas seguem usando `types/catalog.ts` (mesmas listas); útil para conferir se o servidor concorda. */
export async function fetchCatalog(http: HttpClient): Promise<ApiCatalog> {
  const raw = asRecord(await http.request("GET", "/catalog", { auth: false }), "catálogo");
  const strings = (value: unknown, what: string) => asArray(value, what).filter((v): v is string => typeof v === "string");
  return {
    categories: strings(raw.categories, "categorias"),
    locations: strings(raw.locations, "locais"),
    notice: typeof raw.notice === "string" ? raw.notice : "",
  };
}
