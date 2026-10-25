import { isServiceError, ServiceError, type User, type UserRole } from "@/types/domain";
import type { AuthService, DemoProfile, EmailDispatch, GoogleSignInResult, MyDataExport } from "../contracts";
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
      // O contrato do frontend chama `acceptedTerms`; o backend, `acceptTerms`.
      const { acceptedTerms, ...rest } = input;
      return adopt(await http.request("POST", "/auth/signup", { json: { ...rest, acceptTerms: acceptedTerms }, auth: false }));
    },

    async signIn(input) {
      return adopt(await http.request("POST", "/auth/login", { json: input, auth: false }));
    },

    async signInWithGoogle(credential, options): Promise<GoogleSignInResult> {
      const json = options?.acceptedTerms ? { credential, acceptTerms: true } : { credential };
      const raw = asRecord(await http.request("POST", "/auth/google", { json, auth: false }), "Google");
      if (raw.status === "signed_in") return { status: "signed_in", user: adopt(raw) };
      const profile = asRecord(raw.profile, "perfil");
      if ((raw.status !== "needs_role" && raw.status !== "needs_terms") || typeof raw.profileToken !== "string" || typeof profile.email !== "string") {
        throw new ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.", { cause: new Error("resposta do Google") });
      }
      return {
        status: raw.status,
        profile: { email: profile.email, name: typeof profile.name === "string" ? profile.name : "" },
        ticket: raw.profileToken,
      };
    },

    async completeGoogleSignUp({ ticket, role, acceptedTerms }) {
      const json = { profileToken: ticket, ...(role ? { role } : {}), acceptTerms: acceptedTerms };
      return adopt(await http.request("POST", "/auth/google/complete", { json, auth: false }));
    },

    async verifyEmail(token) {
      // Responde `{verified:true}` (sem usuário). Quem tem sessão relê o usuário pela UI (`changed` refaz as leituras).
      await http.request("POST", "/auth/verify-email", { json: { token }, auth: false });
      changed();
    },

    async resendVerification(turnstileToken): Promise<EmailDispatch> {
      // Logado, o corpo pode ser vazio (o servidor usa o e-mail da sessão); responde 202 genérico.
      await http.request("POST", "/auth/resend-verification", { json: turnstileToken ? { turnstileToken } : {} });
      return {}; // o e-mail é enviado pelo servidor; não há `devLink` na API
    },

    async forgotPassword(email, turnstileToken): Promise<EmailDispatch> {
      await http.request("POST", "/auth/forgot-password", { json: turnstileToken ? { email, turnstileToken } : { email }, auth: false });
      return {};
    },

    async resetPassword(token, password) {
      await http.request("POST", "/auth/reset-password", { json: { token, password }, auth: false });
    },

    async exportMyData(): Promise<MyDataExport> {
      const raw = asRecord(await http.request("GET", "/me/export"), "exportação");
      const account = asRecord(raw.account, "conta");
      return {
        ...(raw as unknown as MyDataExport),
        account: account as unknown as MyDataExport["account"],
        itemsRegistered: asArray(raw.itemsRegistered ?? [], "itemsRegistered").map(mappers.item),
        claims: asArray(raw.claims ?? [], "claims") as MyDataExport["claims"],
        returns: asArray(raw.returns ?? [], "returns") as MyDataExport["returns"],
        sessions: asArray(raw.sessions ?? [], "sessions") as MyDataExport["sessions"],
      };
    },

    async deleteMyAccount(confirmation) {
      const body = confirmation && (confirmation.password !== undefined || confirmation.credential !== undefined) ? confirmation : undefined;
      await http.request("DELETE", "/me", { json: body });
      http.clearToken();
      changed();
    },

    // Na API o e-mail é real: não há link simulado.
    async peekSimulatedEmail() {
      return null;
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
