import type { TwoFactorChallenge } from "@/types/admin";
import { isServiceError, ServiceError, type User } from "@/types/domain";
import type { TwoFactorEnabled, TwoFactorSetup } from "@/types/admin";
import type { AuthService, DemoProfile, DemoProfileKey, EmailDispatch, GoogleSignInResult, MyDataExport, SignInResult } from "../contracts";
import type { HttpClient } from "./http";
import { asArray, asRecord, type Mappers } from "./mappers";

interface SessionJson {
  user: unknown;
}

function unexpected(what: string): ServiceError {
  return new ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.", { cause: new Error(`Resposta inesperada da API: ${what}`) });
}

function challenge(raw: Record<string, unknown>): TwoFactorChallenge {
  if (typeof raw.challengeToken !== "string" || !raw.challengeToken) throw unexpected("desafio de 2FA");
  return { status: "needs_2fa", challengeToken: raw.challengeToken };
}

export function createAuthService(http: HttpClient, mappers: Mappers, changed: () => void): AuthService {
  /**
   * Resposta de sessão: o servidor já definiu os cookies HttpOnly. O `token` do corpo (modo Bearer, ainda enviado
   * pelo backend) é IGNORADO e nunca guardado. Devolve o usuário.
   */
  function adopt(raw: unknown): User {
    const session = asRecord(raw, "sessão") as unknown as SessionJson;
    const user = mappers.user(session.user);
    http.markSession();
    changed();
    return user;
  }

  return {
    async getCurrentUser() {
      if (!http.hasSession()) return null;
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
      // Campos EXPLÍCITOS: um `role` extra (vindo de chamada não tipada) nunca sai do cliente. A conta nasce `user`.
      const { name, email, password, acceptedTerms, turnstileToken } = input;
      const json = { name, email, password, acceptTerms: acceptedTerms, ...(turnstileToken ? { turnstileToken } : {}) };
      return adopt(await http.request("POST", "/auth/signup", { json, auth: false }));
    },

    async signIn(input): Promise<SignInResult> {
      const raw = asRecord(await http.request("POST", "/auth/login", { json: input, auth: false }), "login");
      if (raw.status === "needs_2fa") return challenge(raw);
      return { status: "signed_in", user: adopt(raw) };
    },

    async verifyTwoFactor({ challengeToken, code, recoveryCode }) {
      // Exatamente um dos dois vai no corpo (o backend dá prioridade a `recoveryCode` quando presente).
      const json = recoveryCode?.trim() ? { challengeToken, recoveryCode } : { challengeToken, code };
      return adopt(await http.request("POST", "/auth/2fa/verify", { json, auth: false }));
    },

    async setupTwoFactor(): Promise<TwoFactorSetup> {
      const raw = asRecord(await http.request("POST", "/auth/2fa/setup"), "2FA");
      if (typeof raw.secret !== "string" || typeof raw.otpauthUri !== "string") throw unexpected("2FA");
      return { secret: raw.secret, otpauthUri: raw.otpauthUri };
    },

    async enableTwoFactor(code): Promise<TwoFactorEnabled> {
      const raw = asRecord(await http.request("POST", "/auth/2fa/enable", { json: { code } }), "2FA");
      changed();
      return { recoveryCodes: asArray(raw.recoveryCodes, "recoveryCodes").filter((c): c is string => typeof c === "string") };
    },

    async disableTwoFactor({ password, code }) {
      await http.request("POST", "/auth/2fa/disable", { json: password !== undefined && password !== "" ? { password, code } : { code } });
      changed();
    },

    async acceptInvite({ token, name, password }) {
      // `acceptedTerms` não vai: o convite não grava aceite de termos.
      return adopt(await http.request("POST", "/auth/accept-invite", { json: { token, name, password }, auth: false }));
    },

    async signInWithGoogle(credential, options): Promise<GoogleSignInResult> {
      const json = options?.acceptedTerms ? { credential, acceptTerms: true } : { credential };
      const raw = asRecord(await http.request("POST", "/auth/google", { json, auth: false }), "Google");
      if (raw.status === "signed_in") return { status: "signed_in", user: adopt(raw) };
      if (raw.status === "needs_2fa") return challenge(raw);
      const profile = asRecord(raw.profile, "perfil");
      if (raw.status !== "needs_terms" || typeof raw.profileToken !== "string" || typeof profile.email !== "string") {
        throw new ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.", { cause: new Error("resposta do Google") });
      }
      return {
        status: raw.status,
        profile: { email: profile.email, name: typeof profile.name === "string" ? profile.name : "" },
        ticket: raw.profileToken,
      };
    },

    async completeGoogleSignUp({ ticket, acceptedTerms }) {
      // Sem `role`: a conta nasce `user`; o vínculo vem do domínio do e-mail, no servidor.
      const json = { profileToken: ticket, acceptTerms: acceptedTerms };
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
      http.clearSession();
      changed();
    },

    // Na API o e-mail é real: não há link simulado.
    async peekSimulatedEmail() {
      return null;
    },

    async signInAsDemo(profile: DemoProfileKey) {
      return adopt(await http.request("POST", `/demo/login/${encodeURIComponent(profile)}`, { auth: false }));
    },

    async listDemoProfiles() {
      try {
        const raw = asArray(await http.request("GET", "/demo/profiles", { auth: false }), "perfis");
        return raw.map((entry): DemoProfile => {
          const r = asRecord(entry, "perfil");
          return { key: String(r.key ?? r.role) as DemoProfileKey, label: String(r.label ?? ""), user: mappers.user(r.user) };
        });
      } catch (error) {
        // Demonstração desligada no servidor: sem atalhos, sem erro.
        if (isServiceError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) return [];
        throw error;
      }
    },

    async signOut() {
      // Revoga a sessão no servidor e limpa os cookies. Falha de rede/servidor não impede sair daqui: o estado
      // local é limpo sempre. Sem `changed()`: a sessão (SessionProvider) já limpa a si mesma, e reler agora
      // faria as telas abertas pedirem dados autenticados sem sessão (401 inútil).
      try {
        await http.request("POST", "/auth/logout", { auth: false });
      } catch {
        // ignorado de propósito
      }
      http.clearSession();
    },
  };
}
