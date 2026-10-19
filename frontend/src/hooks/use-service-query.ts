"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { services } from "@/services";
import { ServiceError, isServiceError } from "@/types/domain";

export type QueryStatus = "loading" | "success" | "error";

export interface QueryResult<T> {
  data: T | undefined;
  error: ServiceError | undefined;
  status: QueryStatus;
  /** Refaz a leitura mostrando o estado de carregamento (ex.: "Tentar novamente"). */
  refetch: () => void;
}

type Settled<T> = { key: string; data: T; error?: undefined } | { key: string; data?: undefined; error: ServiceError };

/**
 * Lê dados dos serviços e os mantém atualizados (base do AC04.8).
 *
 * - Roda só no navegador, em efeito: nunca lê dados durante a renderização no servidor.
 * - Reexecuta quando `deps` muda (volta a `loading`) e quando `services.subscribe` dispara
 *   (atualiza em silêncio: os dados anteriores continuam na tela, sem piscar o esqueleto).
 * - Respostas obsoletas são descartadas (troca de filtro, desmontagem, nova leitura em voo).
 *
 * `deps` deve conter apenas valores serializáveis em JSON (ids, filtros). O `fetcher` pode ser uma
 * função nova a cada render: vale sempre a mais recente.
 */
export function useServiceQuery<T>(fetcher: () => Promise<T>, deps: readonly unknown[] = []): QueryResult<T> {
  const key = JSON.stringify(deps);
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => services.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let stale = false;
    fetcherRef.current().then(
      (data) => {
        if (!stale) setSettled({ key, data });
      },
      (cause: unknown) => {
        if (stale) return;
        const error = isServiceError(cause)
          ? cause
          : new ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.", { cause });
        setSettled({ key, error });
      },
    );
    return () => {
      stale = true;
    };
  }, [key, version]);

  const refetch = useCallback(() => {
    setSettled(null);
    setVersion((v) => v + 1);
  }, []);

  // Resultado de outra chave (filtro mudou) conta como carregando.
  const current = settled && settled.key === key ? settled : null;
  const status: QueryStatus = !current ? "loading" : current.error ? "error" : "success";
  return { data: current?.data, error: current?.error, status, refetch };
}
