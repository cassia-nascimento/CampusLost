"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRememberedItemsSearch } from "@/components/items/last-search";
import { getRouteChrome, ORIGIN_PARAM, type RouteChrome } from "./navigation";

/**
 * Caminho atual e tipo de header (topo ou detalhe com voltar) para os shells. A origem (`?de=`) é validada por
 * `getRouteChrome`. Lê `useSearchParams`: quem usa precisa estar dentro de `<Suspense>`.
 */
export function useRouteChrome(): { pathname: string; chrome: RouteChrome } {
  const pathname = usePathname();
  const itemsSearch = useRememberedItemsSearch();
  const origin = useSearchParams().get(ORIGIN_PARAM);
  return { pathname, chrome: getRouteChrome(pathname, itemsSearch, origin) };
}
