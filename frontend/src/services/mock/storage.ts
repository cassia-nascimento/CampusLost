/** Abstração mínima de armazenamento (compatível com `Storage`). Exclusiva do mock. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /**
   * `false` quando o conteúdo se perde ao recarregar a página (memória do processo). Opcional: um
   * armazenamento que não informa é tratado como durável.
   */
  isDurable?(): boolean;
}

export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    isDurable: () => false,
  };
}

export type BrowserStorageKind = "local" | "session";

function probeBrowserStorage(kind: BrowserStorageKind): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const area = kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "__campuslost_probe__";
    area.setItem(probe, "1");
    area.removeItem(probe);
    return area;
  } catch {
    return null; // bloqueado, modo privado, SSR...
  }
}

/**
 * `localStorage` (banco, compartilhado entre abas) ou `sessionStorage` (sessão, por aba;
 * sobrevive a recarregar) quando disponíveis; caso contrário memória do processo.
 * A escolha é feita a cada acesso (e o sucesso, memorizado), então um módulo
 * carregado no servidor/SSR passa a usar o armazenamento do navegador assim que roda nele.
 */
export function createDefaultStorage(kind: BrowserStorageKind = "local"): KeyValueStorage {
  const memory = createMemoryStorage();
  let browser: Storage | null = null;
  const pick = (): KeyValueStorage => {
    browser ??= probeBrowserStorage(kind);
    return browser ?? memory;
  };
  return {
    getItem: (key) => pick().getItem(key),
    setItem: (key, value) => pick().setItem(key, value),
    removeItem: (key) => pick().removeItem(key),
    isDurable: () => pick() !== memory,
  };
}
