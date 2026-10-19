/** Abstração mínima de armazenamento (compatível com `Storage`). Exclusiva do mock. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function probeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const ls = window.localStorage;
    const probe = "__campuslost_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return null; // bloqueado, modo privado, SSR...
  }
}

/**
 * `localStorage` quando disponível; caso contrário memória do processo.
 * A escolha é feita a cada acesso (e o sucesso, memorizado), então um módulo
 * carregado no servidor/SSR passa a usar o `localStorage` assim que roda no navegador.
 */
export function createDefaultStorage(): KeyValueStorage {
  const memory = createMemoryStorage();
  let browser: Storage | null = null;
  const pick = (): KeyValueStorage => {
    browser ??= probeLocalStorage();
    return browser ?? memory;
  };
  return {
    getItem: (key) => pick().getItem(key),
    setItem: (key, value) => pick().setItem(key, value),
    removeItem: (key) => pick().removeItem(key),
  };
}
