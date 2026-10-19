"use client";

/**
 * Última busca de `/itens` (filtros da URL), guardada na aba (`sessionStorage`) para o "voltar" do header
 * mobile em `/itens/[id]` e `/itens/novo` reabrir a lista com os mesmos filtros (RF03/AC03.3).
 *
 * Só guardamos a query string já normalizada por `filtersToSearch`; na leitura ela passa por
 * `parseFilterParams` de novo, então nada além de filtros válidos chega ao `href`. Se o armazenamento
 * estiver indisponível (janela privada, bloqueio de dados), tudo cai em `""` e o voltar vai a `/itens`.
 */
import { useSyncExternalStore } from "react";
import { filtersToSearch, parseFilterParams } from "./search-params";

const STORAGE_KEY = "campuslost:proto:v1:last-items-search";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Exportada só para os testes; a interface usa `useRememberedItemsSearch`. */
export function readSearch(): string {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? filtersToSearch(parseFilterParams(new URLSearchParams(raw))) : "";
  } catch {
    return "";
  }
}

/** Guarda a busca atual (`""` = sem filtros). Chamado pela tela `/itens` a cada mudança de filtro. */
export function rememberItemsSearch(search: string): void {
  try {
    if (search) sessionStorage.setItem(STORAGE_KEY, search);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem armazenamento: o voltar usa `/itens` puro.
  }
  listeners.forEach((listener) => listener());
}

/** Esquece a última busca (ao sair da conta ou reiniciar a demonstração: a próxima sessão começa sem filtros). */
export function forgetItemsSearch(): void {
  rememberItemsSearch("");
}

/** Query string da última busca (`?categoria=…` ou `""`). No servidor e na hidratação é sempre `""`. */
export function useRememberedItemsSearch(): string {
  return useSyncExternalStore(subscribe, readSearch, () => "");
}
