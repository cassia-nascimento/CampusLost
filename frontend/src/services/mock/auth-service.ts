import { ServiceError, type User } from "@/types/domain";
import { affiliationForEmail, emailFingerprint, passwordIssue, PASSWORD_ISSUE_MESSAGE } from "@/lib/rules";
import {
  forgotPasswordSchema,
  googleSignUpSchema,
  normalizeEmail,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  verifyEmailSchema,
} from "@/lib/validation";
import {
  DEMO_PROFILE_KEYS,
  type AuthService,
  type DemoProfile,
  type DemoProfileKey,
  type EmailDispatch,
  type GoogleProfile,
  type GoogleSignInResult,
  type MyDataExport,
} from "../contracts";
import { decodeGoogleTicket, encodeGoogleTicket } from "./google";
import { recordAudit, recordAuditSafely } from "./audit";
import { createAcceptInvite } from "./admin-service";
import { findUser, isActiveAccount, parseInput, requireSession, type MockContext } from "./context";
import { toViewerItem } from "./viewer";
import { completeLogin, createTwoFactorMethods } from "./two-factor";
import { hashPassword, newSalt, newToken, PBKDF2_ITERATIONS, verifyAccountPassword } from "./password";
import { DEMO_PROFILE_IDS, DEMO_PROFILE_LABELS, type Db, type TokenKind, type TokenRecord } from "./seed";

export const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos.";

/** Rotas da UI que recebem o token (o link simulado aponta para elas). */
export const VERIFY_EMAIL_PATH = "/verificar-email";
export const RESET_PASSWORD_PATH = "/redefinir-senha";
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const REMOVED_USER_NAME = "Usuário removido";
const REDACTED_TEXT = "[Conteúdo removido a pedido do titular dos dados]";
const TOKEN_INVALID_MESSAGE = "Este link é inválido ou já foi usado. Peça um novo.";
const TOKEN_EXPIRED_MESSAGE = "Este link expirou. Peça um novo.";

function devLinkFor(kind: TokenKind, token: string): string {
  return `${kind === "verify_email" ? VERIFY_EMAIL_PATH : RESET_PASSWORD_PATH}?token=${token}`;
}

/** Cria um token novo para o usuário e invalida (marca como usados) os anteriores do mesmo tipo. */
function issueToken(ctx: MockContext, db: Db, userId: string, kind: TokenKind): TokenRecord {
  const nowIso = ctx.now().toISOString();
  for (const t of db.tokens) if (t.userId === userId && t.kind === kind && !t.usedAt) t.usedAt = nowIso;
  const ttl = kind === "verify_email" ? VERIFY_TOKEN_TTL_MS : RESET_TOKEN_TTL_MS;
  const record: TokenRecord = { token: newToken(), userId, kind, expiresAt: new Date(ctx.now().getTime() + ttl).toISOString() };
  db.tokens.push(record);
  return record;
}

/** Valida e CONSOME o token (uso único). Lança TOKEN_INVALID / TOKEN_EXPIRED. */
function consumeToken(ctx: MockContext, db: Db, token: string, kind: TokenKind): TokenRecord {
  const record = db.tokens.find((t) => t.token === token && t.kind === kind);
  if (!record || record.usedAt) throw new ServiceError("TOKEN_INVALID", TOKEN_INVALID_MESSAGE);
  if (new Date(record.expiresAt).getTime() <= ctx.now().getTime()) throw new ServiceError("TOKEN_EXPIRED", TOKEN_EXPIRED_MESSAGE);
  record.usedAt = ctx.now().toISOString();
  return record;
}

/** Senha nova da política (também validada pelo zod; revalida aqui o contexto e-mail/nome). */
function assertPasswordPolicy(password: string, user?: User): void {
  const issue = passwordIssue(password, { email: user?.email, name: user?.name });
  if (issue) {
    throw new ServiceError("VALIDATION", PASSWORD_ISSUE_MESSAGE[issue], { fieldErrors: { password: PASSWORD_ISSUE_MESSAGE[issue] } });
  }
}


function assertEmailFree(db: Db, email: string): void {
  if (db.users.some((u) => normalizeEmail(u.email) === email)) {
    throw new ServiceError("EMAIL_TAKEN", "Este e-mail já está cadastrado.", {
      fieldErrors: { email: "Este e-mail já está cadastrado." },
    });
  }
}

/** Cria a conta Google (sem senha, já verificada, papel `user`). `EMAIL_TAKEN` se o e-mail já existe. */
function createGoogleUser(ctx: MockContext, profile: GoogleProfile): User {
  return ctx.store.transaction((db) => {
    assertEmailFree(db, profile.email);
    const created: User = {
      id: ctx.newId("user"),
      name: profile.name,
      email: profile.email,
      role: "user",
      affiliation: affiliationForEmail(profile.email, ctx.allowedGoogleDomains),
      emailVerified: true,
      hasPassword: false,
    };
    db.users.push(created);
    db.credentials.push({ userId: created.id, provider: "google" });
    db.accounts.push({ userId: created.id, createdAt: ctx.now().toISOString() });
    recordAudit(ctx, db, {
      actorId: created.id,
      action: "signup",
      target: ["user", created.id],
      metadata: { role: created.role, affiliation: created.affiliation, provider: "google" },
    });
    return created;
  });
}

/** E-mail normalizado; nome aparado, limitado a 80 caracteres e, se curto demais, a parte local do e-mail. */
function normalizeGoogleProfile(profile: GoogleProfile): GoogleProfile {
  const email = normalizeEmail(String(profile?.email ?? ""));
  let name = String(profile?.name ?? "").trim().slice(0, 80).trim();
  if (name.length < 2) name = email.split("@")[0] ?? "";
  return { email, name };
}

export function createAuthService(ctx: MockContext): AuthService {
  const { store } = ctx;
  return {
    // O usuário capturado por `run` já é o da sessão; revalida contra o banco atual.
    getCurrentUser: () =>
      ctx.run(
        "auth.getCurrentUser",
        (actor) => (actor ? (store.read().users.find((u) => u.id === actor.id) ?? null) : null),
        { instant: true },
      ),

    signUp: (input) =>
      ctx.run("auth.signUp", async () => {
        const data = parseInput(signUpSchema, input);
        const salt = newSalt();
        const hash = await hashPassword(data.password, salt);
        const user = store.transaction((db) => {
          assertEmailFree(db, data.email);
          const created: User = {
            id: ctx.newId("user"),
            name: data.name,
            email: data.email,
            role: "user", // nunca vem do formulário: administração só por convite/seed
            affiliation: affiliationForEmail(data.email, ctx.allowedGoogleDomains),
            emailVerified: false,
            hasPassword: true,
          };
          db.users.push(created);
          db.credentials.push({
            userId: created.id,
            provider: "password",
            salt,
            hash,
            iterations: PBKDF2_ITERATIONS,
          });
          db.accounts.push({ userId: created.id, createdAt: ctx.now().toISOString() });
          recordAudit(ctx, db, {
            actorId: created.id,
            action: "signup",
            target: ["user", created.id],
            metadata: { role: created.role, affiliation: created.affiliation, provider: "password" },
          });
          return created;
        });
        store.setSessionUserId(user.id);
        return user;
      }),

    signIn: (input) =>
      ctx.run("auth.signIn", async () => {
        const data = parseInput(signInSchema, input);
        const db = store.read();
        const user = db.users.find((u) => normalizeEmail(u.email) === data.email);
        // Sempre calcula um hash (mesmo sem conta/senha) para não distinguir os casos pelo tempo.
        const ok = await verifyAccountPassword(db.credentials, user?.id, data.password);
        if (!user || !ok) {
          recordAuditSafely(ctx, {
            actorId: user?.id ?? null,
            action: "login.failure",
            ...(user ? { target: ["user", user.id] as [string, string] } : {}),
            metadata: { method: "password", emailRef: emailFingerprint(data.email) },
          });
          throw new ServiceError("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
        }
        return completeLogin(ctx, user.id, "password");
      }),

    signInWithGoogle: (credential, options) =>
      ctx.run("auth.signInWithGoogle", async (): Promise<GoogleSignInResult> => {
        const normalized = normalizeGoogleProfile(await ctx.verifyGoogleCredential(credential));
        const existing = store.read().users.find((u) => normalizeEmail(u.email) === normalized.email);
        if (existing) return completeLogin(ctx, existing.id, "google");
        const ticket = encodeGoogleTicket(normalized);
        // Conta nova (qualquer domínio): sem aceite dos termos nada é criado (espelha a API).
        if (options?.acceptedTerms !== true) return { status: "needs_terms", profile: normalized, ticket };
        const user = createGoogleUser(ctx, normalized);
        store.setSessionUserId(user.id);
        return { status: "signed_in", user };
      }),

    completeGoogleSignUp: (input) =>
      ctx.run("auth.completeGoogleSignUp", () => {
        const profile = normalizeGoogleProfile(decodeGoogleTicket(input?.ticket));
        const parsed = googleSignUpSchema.safeParse({ ...profile, acceptedTerms: input?.acceptedTerms });
        if (!parsed.success) {
          throw new ServiceError("VALIDATION", "Confira os campos destacados.", { fieldErrors: toFieldErrors(parsed.error) });
        }
        const user = createGoogleUser(ctx, { email: parsed.data.email, name: parsed.data.name });
        store.setSessionUserId(user.id);
        return user;
      }),

    signInAsDemo: (profile: DemoProfileKey) =>
      ctx.run("auth.signInAsDemo", () => {
        const user = findUser(store.read(), DEMO_PROFILE_IDS[profile]);
        recordAuditSafely(ctx, { actorId: user.id, action: "login.success", target: ["user", user.id], metadata: { method: "demo" } });
        store.setSessionUserId(user.id);
        return user;
      }),

    listDemoProfiles: () =>
      ctx.run("auth.listDemoProfiles", (): DemoProfile[] => {
        const db = store.read();
        return DEMO_PROFILE_KEYS.map((key) => ({
          key,
          label: DEMO_PROFILE_LABELS[key],
          user: findUser(db, DEMO_PROFILE_IDS[key]),
        }));
      }),

    verifyEmail: (token) =>
      ctx.run("auth.verifyEmail", () => {
        const data = parseInput(verifyEmailSchema, { token });
        return store.transaction((db) => {
          const record = consumeToken(ctx, db, data.token, "verify_email");
          const user = db.users.find((u) => u.id === record.userId);
          if (!user) throw new ServiceError("TOKEN_INVALID", TOKEN_INVALID_MESSAGE);
          user.emailVerified = true;
          recordAudit(ctx, db, { actorId: user.id, action: "email.verify", target: ["user", user.id] });
        });
      }),

    resendVerification: () =>
      ctx.run("auth.resendVerification", (actor): EmailDispatch => {
        const dispatch = store.transaction((db) => {
          const user = requireSession(db, actor);
          if (user.emailVerified) return {};
          return { devLink: devLinkFor("verify_email", issueToken(ctx, db, user.id, "verify_email").token) };
        });
        return dispatch;
      }),

    forgotPassword: (email) =>
      ctx.run("auth.forgotPassword", (): EmailDispatch => {
        const data = parseInput(forgotPasswordSchema, { email });
        return store.transaction((db) => {
          const user = db.users.find((u) => normalizeEmail(u.email) === data.email);
          const hasPassword = user && db.credentials.some((c) => c.userId === user.id && c.provider === "password");
          // Sem revelar se a conta existe: a resposta é sempre sucesso; o link só aparece quando há conta.
          if (!user || !hasPassword) return {};
          return { devLink: devLinkFor("reset_password", issueToken(ctx, db, user.id, "reset_password").token) };
        });
      }),

    resetPassword: (token, password) =>
      ctx.run("auth.resetPassword", async () => {
        const data = parseInput(resetPasswordSchema, { token, password });
        const salt = newSalt();
        const hash = await hashPassword(data.password, salt);
        store.transaction((db) => {
          const record = consumeToken(ctx, db, data.token, "reset_password");
          const user = db.users.find((u) => u.id === record.userId);
          if (!user) throw new ServiceError("TOKEN_INVALID", TOKEN_INVALID_MESSAGE);
          assertPasswordPolicy(data.password, user);
          const cred = db.credentials.find((c) => c.userId === user.id && c.provider === "password");
          if (cred) Object.assign(cred, { salt, hash, iterations: PBKDF2_ITERATIONS });
          else db.credentials.push({ userId: user.id, provider: "password", salt, hash, iterations: PBKDF2_ITERATIONS });
          recordAudit(ctx, db, { actorId: user.id, action: "password.reset", target: ["user", user.id] });
        });
      }),

    exportMyData: () =>
      ctx.run("auth.exportMyData", (actor): MyDataExport => {
        const db = store.read();
        const user = requireSession(db, actor);
        const hasPassword = db.credentials.some((c) => c.userId === user.id && c.provider === "password");
        return {
          format: "campuslost-export-v1",
          exportedAt: ctx.now().toISOString(),
          account: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            affiliation: user.affiliation,
            provider: hasPassword ? "password" : "google",
            createdAt: null,
            emailVerifiedAt: null,
            termsAcceptedAt: null,
            termsVersion: null,
          },
          itemsRegistered: db.items.filter((i) => i.createdById === user.id).map((i) => toViewerItem(i, user, db.claims)),
          claims: db.claims
            .filter((c) => c.claimantId === user.id)
            .map((c) => ({ ...c, itemTitle: db.items.find((i) => i.id === c.itemId)?.title ?? null })),
          returns: db.returns
            .filter((r) => r.returnedToId === user.id || r.registeredById === user.id)
            .map((r) => ({ ...r, role: r.returnedToId === user.id ? ("returnedTo" as const) : ("registeredBy" as const) })),
          sessions: [],
        };
      }),

    deleteMyAccount: (confirmation) =>
      ctx.run("auth.deleteMyAccount", async (actor) => {
        const db0 = store.read();
        const user0 = requireSession(db0, actor);
        const cred = db0.credentials.find((c) => c.userId === user0.id && c.provider === "password");
        let confirmed = false;
        if (cred?.hash) {
          const password = confirmation?.password;
          confirmed = !!password && (await verifyAccountPassword(db0.credentials, user0.id, password));
        } else if (confirmation?.credential?.trim()) {
          const profile = normalizeGoogleProfile(await ctx.verifyGoogleCredential(confirmation.credential.trim()));
          confirmed = profile.email === normalizeEmail(user0.email);
        }
        if (!confirmed) {
          throw new ServiceError("INVALID_CREDENTIALS", "Confirmação incorreta. A conta não foi excluída.", {
            fieldErrors: { password: "Confirmação incorreta." },
          });
        }
        store.transaction((db) => {
          const id = user0.id;
          const user = db.users.find((u) => u.id === id);
          if (!user) return;
          const activeAdmins = db.users.filter((u) => u.role === "admin" && isActiveAccount(db, u.id));
          if (user.role === "admin" && activeAdmins.length <= 1) {
            throw new ServiceError("CONFLICT", "Você é a única conta de administração. Crie outra antes de excluir esta.");
          }
          const nowIso = ctx.now().toISOString();
          // Reivindicações em aberto são encerradas; o item volta a Disponível se não restar nenhuma ativa.
          // Os textos de prova (dados pessoais livres) são apagados em todas.
          for (const claim of db.claims.filter((c) => c.claimantId === id)) {
            const item = db.items.find((i) => i.id === claim.itemId);
            if ((claim.status === "pending" || claim.status === "accepted") && item && item.status !== "returned") {
              claim.status = "rejected";
              claim.reviewedAt = nowIso;
              const others = db.claims.filter((c) => c.itemId === item.id && c.id !== claim.id);
              if (item.status === "under_claim" && !others.some((c) => c.status === "pending" || c.status === "accepted")) {
                item.status = "available";
              }
            }
            claim.proofDetails = REDACTED_TEXT;
            claim.lostWhereWhen = REDACTED_TEXT;
          }
          // Anonimiza (não apaga): itens e devoluções seguem apontando para "Usuário removido".
          user.name = REMOVED_USER_NAME;
          user.email = `removido-${id}@excluido.invalid`;
          user.emailVerified = false;
          user.hasPassword = false;
          user.twoFactorEnabled = false;
          db.credentials = db.credentials.filter((c) => c.userId !== id);
          db.tokens = db.tokens.filter((t) => t.userId !== id);
          db.twoFactor = db.twoFactor.filter((t) => t.userId !== id);
          const meta = db.accounts.find((a) => a.userId === id);
          if (meta) meta.deletedAt = nowIso;
          recordAudit(ctx, db, { actorId: id, action: "account.delete", target: ["user", id] });
        });
        store.setSessionUserId(null);
      }),

    peekSimulatedEmail: () =>
      ctx.run(
        "auth.peekSimulatedEmail",
        (actor) => {
          if (!actor) return null;
          const db = store.read();
          const user = db.users.find((u) => u.id === actor.id);
          if (!user || user.emailVerified) return null;
          const now = ctx.now().getTime();
          const t = [...db.tokens].reverse().find((x) => x.userId === user.id && x.kind === "verify_email" && !x.usedAt && new Date(x.expiresAt).getTime() > now);
          return t ? { kind: "verify_email" as const, devLink: devLinkFor("verify_email", t.token) } : null;
        },
        { instant: true },
      ),

    ...createTwoFactorMethods(ctx),
    acceptInvite: createAcceptInvite(ctx),

    signOut: () =>
      ctx.run(
        "auth.signOut",
        (actor) => {
          if (actor) recordAuditSafely(ctx, { actorId: actor.id, action: "logout", target: ["user", actor.id] });
          store.setSessionUserId(null);
        },
        { instant: true },
      ),
  };
}
