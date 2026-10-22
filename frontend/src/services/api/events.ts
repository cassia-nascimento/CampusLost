/**
 * `subscribe` da API. O servidor não notifica, então o aviso vem de dois lugares:
 *  - `notify()`: depois de cada mudança feita por esta aba (leitura imediata);
 *  - releitura periódica leve (AC04.8: "Minhas reivindicações" reflete decisões da administração), SÓ com a aba
 *    visível, a cada `pollMs`; ao voltar a ficar visível relê uma vez (no máximo uma a cada `minGapMs`).
 * O temporizador existe só enquanto há ouvintes; todos compartilham um único.
 */
export interface ChangeFeedOptions {
  pollMs?: number;
  /** Intervalo mínimo entre avisos originados por tempo/visibilidade (não limita `notify()`). */
  minGapMs?: number;
  /** Injetável nos testes. Padrão: `document.visibilityState`. */
  isVisible?: () => boolean;
  now?: () => number;
}

export interface ChangeFeed {
  subscribe(listener: () => void): () => void;
  notify(): void;
}

export function createChangeFeed(options: ChangeFeedOptions = {}): ChangeFeed {
  const pollMs = options.pollMs ?? 15_000;
  const minGapMs = options.minGapMs ?? 5_000;
  const isVisible = options.isVisible ?? (() => typeof document === "undefined" || document.visibilityState === "visible");
  const now = options.now ?? (() => Date.now());
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastAt = 0;

  function fire() {
    lastAt = now();
    // cópia: um ouvinte pode se cancelar durante o aviso
    for (const listener of [...listeners]) listener();
  }

  function poll() {
    if (!isVisible() || now() - lastAt < minGapMs) return;
    fire();
  }

  function onVisibility() {
    if (isVisible()) poll();
  }

  function start() {
    if (timer !== null) return;
    timer = setInterval(poll, pollMs);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
  }

  function stop() {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    notify: fire,
  };
}
