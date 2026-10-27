"use client";

import { useEffect, useState } from "react";

/**
 * Relógio em milissegundos que avança a cada `intervalMs` enquanto `active` (contagem regressiva de bloqueio e
 * prazo da conferência do código de retirada). Inativo, não agenda nada.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const sync = () => setNow(Date.now());
    const first = setTimeout(sync, 0); // ao ativar, corrige já o valor que ficou parado
    const timer = setInterval(sync, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active, intervalMs]);
  return now;
}
