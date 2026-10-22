import { isServiceError, ServiceError, type User, type UserRole } from "@/types/domain";
import type { AuthService, DemoProfile, GoogleSignInResult } from "../contracts";
import type { HttpClient } from "./http";
import { asArray, asRecord, type Mappers } from "./mappers";

interface SessionJson {
  token: string;
  user: unknown;
}

export function createAuthService(http: HttpClient, mappers: Mappers, changed: () => void): AuthService {
  /** Guarda o token da sessão e devolve o usuário. */
  function adopt(raw: unknown): User {
    const session = asRecord(raw, "sessão") as unknown as SessionJson;
    if (typeof session.token !== "string" || !session.token) {
      throw new ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.", { cause: new Error("sessão sem token") });
    }
    http.setToken(session.token);
    const user = mappers.user(session.user);
    changed();
    return user;
  }

  return {
    async getCurrentUser() {
      if (!http.getToken()) return null;
      try {
        return mappers.user(await http.request("GET", "/auth/me"));
      } catch (error) {
        // 401: o cliente já descartou o token; quem pergunta recebe "sem sessão".
        if (isServiceError(error) && error.code === "UNAUTHENTICATED") return null;
        throw error;
      }
    },

    async signUp(input) {
      return adopt(await http.request("POST", "/auth/signup", { json: input, auth: false }));
    },

    async signIn(input) {
      return adopt(await http.request("POST", "/auth/login", { json: input, auth: false }));
    },

    async signInWithGoogle(credential): Promise<GoogleSignInResult> {
      const raw = asRecord(await http.request("POST", "/auth/google", { json: { credential }, auth: false }), "Google");
      if (raw.status === "signed_in") return { status: "signed_in", user: adopt(raw) };
      const profile = asRecord(raw.profile, "perfil");
      if (raw.status !== "needs_role" || typeof raw.profileToken !== "string" || typeof profile.email !== "string") {
        throw new ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.", { cause: new Error("resposta do Google") });
      }
      return {
        status: "needs_role",
        profile: { email: profile.email, name: typeof profile.name === "string" ? profile.name : "" },
        ticket: raw.profileToken,
      };
    },

    async completeGoogleSignUp({ ticket, role }) {
      return adopt(await http.request("POST", "/auth/google/complete", { json: { profileToken: ticket, role }, auth: false }));
    },

    async signInAsDemo(role: UserRole) {
      return adopt(await http.request("POST", `/demo/login/${encodeURIComponent(role)}`, { auth: false }));
    },

    async listDemoProfiles() {
      try {
        const raw = asArray(await http.request("GET", "/demo/profiles", { auth: false }), "perfis");
        return raw.map((entry): DemoProfile => {
          const r = asRecord(entry, "perfil");
          return { role: r.role as UserRole, label: String(r.label ?? ""), user: mappers.user(r.user) };
        });
      } catch (error) {
        // Demonstração desligada no servidor: sem atalhos, sem erro.
        if (isServiceError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) return [];
        throw error;
      }
    },

    async signOut() {
      // A API não tem logout: sair é descartar o token. Sem `changed()`: a sessão (SessionProvider) já limpa a si
      // mesma, e reler agora faria as telas abertas pedirem dados autenticados sem token (401 inútil).
      http.clearToken();
    },
  };
}
