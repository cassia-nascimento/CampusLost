"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { forgetItemsSearch } from "@/components/items/last-search";
import { services } from "@/services";
import type { DeleteAccountConfirmation, GoogleSignInResult, GoogleSignUpInput, SignInResult } from "@/services";
import type { SignInValues, SignUpValues } from "@/lib/validation";
import type { User, UserRole } from "@/types/domain";

/** `loading` só até a sessão ser lida do armazenamento; depois `ready` (com ou sem usuário). */
export type SessionStatus = "loading" | "ready";

export interface SessionValue {
  user: User | null;
  status: SessionStatus;
  /**
   * Entra com e-mail e senha. Lança `ServiceError` (`INVALID_CREDENTIALS`, `VALIDATION`). Conta com 2FA ligado devolve
   * `needs_2fa` e NÃO abre sessão: a tela guarda o `challengeToken` e chama `verifyTwoFactor`.
   */
  signIn(input: SignInValues): Promise<SignInResult>;
  /** Conclui o login com 2FA (código do aplicativo OU de recuperação) e abre a sessão. Lança `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `ACCOUNT_DISABLED`. */
  verifyTwoFactor(input: { challengeToken: string; code?: string; recoveryCode?: string }): Promise<User>;
  /** Aceita o convite de administração e abre a sessão. Lança `TOKEN_INVALID`, `VALIDATION`, `EMAIL_TAKEN`. */
  acceptInvite(input: { token: string; name: string; password: string }): Promise<User>;
  /** Cria a conta com senha e abre a sessão. Lança `ServiceError` (`EMAIL_TAKEN`, `VALIDATION`). */
  signUp(input: SignUpValues): Promise<User>;
  /**
   * "Entrar com Google": recebe o ID token bruto (`credential`); o serviço o verifica no servidor. A sessão só é
   * adotada quando o resultado é `signed_in`; em `needs_role`/`needs_terms` nada muda e a tela pede o papel (guardando
   * o `ticket`); em `needs_2fa` a tela pede o código.
   * Lança `FORBIDDEN_DOMAIN`.
   */
  signInWithGoogle(credential: string): Promise<GoogleSignInResult>;
  /** Conclui o cadastro via Google (aluno/professor, com o `ticket`) e abre a sessão. Lança `FORBIDDEN_DOMAIN`, `EMAIL_TAKEN`, `UNAUTHENTICATED` (ticket expirado). */
  completeGoogleSignUp(input: GoogleSignUpInput): Promise<User>;
  /** Perfis de demonstração (AC01.3). */
  signInAsDemo(role: UserRole): Promise<User>;
  signOut(): Promise<void>;
  /** Relê a sessão no serviço (ex.: depois de confirmar o e-mail, que não devolve o usuário). */
  refreshUser(): Promise<void>;
  /**
   * Exclui a conta atual (LGPD) e encerra a sessão. Conta por senha exige `password`; conta só-Google, `credential`
   * (`INVALID_CREDENTIALS` se errada). Administração não pode (`FORBIDDEN`; a única administração, `CONFLICT`).
   */
  deleteAccount(confirmation?: DeleteAccountConfirmation): Promise<void>;
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
          if (!current) forgetItemsSearch(); // sem sessão (saiu, ou a demonstração foi reiniciada)
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
      signIn: async (input) => {
        const result = await services.auth.signIn(input);
        if (result.status === "signed_in") adopt(result.user);
        return result;
      },
      verifyTwoFactor: async (input) => {
        const verified = adopt(await services.auth.verifyTwoFactor(input));
        // Relê a sessão: garante `twoFactorEnabled` mesmo que a resposta do login não o traga.
        try {
          const read = ++latestRead.current;
          const current = await services.auth.getCurrentUser();
          if (read === latestRead.current && current) setUser(current);
        } catch {
          // a sessão já está aberta; a leitura é só um reforço
        }
        return verified;
      },
      acceptInvite: async (input) => adopt(await services.auth.acceptInvite(input)),
      signUp: async (input) => adopt(await services.auth.signUp(input)),
      signInWithGoogle: async (credential) => {
        const result = await services.auth.signInWithGoogle(credential);
        if (result.status === "signed_in") adopt(result.user);
        return result;
      },
      completeGoogleSignUp: async (input) => adopt(await services.auth.completeGoogleSignUp(input)),
      signInAsDemo: async (role) => adopt(await services.auth.signInAsDemo(role)),
      signOut: async () => {
        await services.auth.signOut();
        latestRead.current++;
        forgetItemsSearch(); // a próxima pessoa não herda os filtros desta
        setUser(null);
      },
      refreshUser: async () => {
        const read = ++latestRead.current;
        const current = await services.auth.getCurrentUser();
        if (read === latestRead.current) setUser(current);
      },
      deleteAccount: async (confirmation) => {
        await services.auth.deleteMyAccount(confirmation);
        latestRead.current++;
        forgetItemsSearch();
        setUser(null);
      },
    }),
    [user, status, adopt],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
