"use client";

import { useSearchParams } from "next/navigation";
import { NEXT_PARAM, parseNext } from "./next-param";

/** Destino `?next=` já validado pela lista de permissão (ou `null`). Exige `<Suspense>` acima (`useSearchParams`). */
export function useNextPath(): string | null {
  return parseNext(useSearchParams().get(NEXT_PARAM));
}
