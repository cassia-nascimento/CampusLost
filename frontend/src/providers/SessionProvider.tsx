"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { services } from "@/services";
import type { SignInValues, SignUpValues } from "@/lib/validation";
import type { User, UserRole } from "@/types/domain";

/** `loading` só até a sessão ser lida do armazenamento; depois `ready` (com ou sem usuário). */
export type SessionStatus = "loading" | "ready";

export interface SessionValue {
  user: User | null;
  status: SessionStatus;
  /** Entra pelo e-mail. Lança `ServiceError` (`USER_NOT_FOUND`, `VALIDATION`). */
  signIn(input: SignInValues): Promise<User>;
  signUp(input: SignUpValues): Promise<User>;
  /** Perfis de demonstração (AC01.3). */
  signInAsDemo(role: UserRole): Promise<User>;
  signOut(): Promise<void>;
}

export const SessionContext = createContext<SessionValue | null>(null);

/**
 * Restaura a sessão ao carregar (AC01.4) e a mantém em dia: `services.subscribe` avisa quando outra aba
 * sai da conta ou quando a demonstração é reiniciada. A "sessão" é simulada (RNF01).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  // Contador de leituras da sessão: invalida respostas em voo quando o estado muda por outro caminho.
  const latestRead = useRef(0);

  useEffect(() => {
    // Lê a sessão atual; só a última leitura vale (respostas antigas, atrasadas, são descartadas).
    function refresh() {
      const read = ++latestRead.current;
      services.auth.getCurrentUser().then(
        (current) => {
          if (read !== latestRead.current) return;
          setUser(current);
          setStatus("ready");
        },
        () => {
          if (read !== latestRead.current) return;
          setUser(null); // sem leitura confiável, trata como visitante
          setStatus("ready");
        },
      );
    }
    refresh();
    return services.subscribe(refresh);
  }, []);

  const adopt = useCallback((next: User) => {
    latestRead.current++; // invalida leituras em voo, que podem trazer o estado anterior
    setUser(next);
    setStatus("ready");
    return next;
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      status,
      signIn: async (input) => adopt(await services.auth.signIn(input)),
      signUp: async (input) => adopt(await services.auth.signUp(input)),
      signInAsDemo: async (role) => adopt(await services.auth.signInAsDemo(role)),
      signOut: async () => {
        await services.auth.signOut();
        latestRead.current++;
        setUser(null);
      },
    }),
    [user, status, adopt],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
