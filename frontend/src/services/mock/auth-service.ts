import { ServiceError, type User, type UserRole } from "@/types/domain";
import { isAllowedGoogleEmail } from "@/lib/rules";
import { googleSignUpSchema, normalizeEmail, signInSchema, signUpSchema } from "@/lib/validation";
import type { AuthService, DemoProfile, GoogleProfile, GoogleSignInResult } from "../contracts";
import { findUser, parseInput, type MockContext } from "./context";
import { hashPassword, newSalt, PBKDF2_ITERATIONS, safeEqual } from "./password";
import { DEMO_PROFILE_IDS, DEMO_PROFILE_LABELS, type Db } from "./seed";

export const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos.";
const DUMMY_SALT = "00".repeat(16);

function assertEmailFree(db: Db, email: string): void {
  if (db.users.some((u) => normalizeEmail(u.email) === email)) {
    throw new ServiceError("EMAIL_TAKEN", "Este e-mail já está cadastrado.", {
      fieldErrors: { email: "Este e-mail já está cadastrado." },
    });
  }
}

function assertInstitutional(ctx: MockContext, email: string): void {
  if (!isAllowedGoogleEmail(email, ctx.allowedGoogleDomains)) {
    throw new ServiceError("FORBIDDEN_DOMAIN", "Use o e-mail institucional da UNDB.");
  }
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
            role: data.role,
          };
          db.users.push(created);
          db.credentials.push({
            userId: created.id,
            provider: "password",
            salt,
            hash,
            iterations: PBKDF2_ITERATIONS,
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
        const cred = user && db.credentials.find((c) => c.userId === user.id && c.provider === "password");
        // Sempre calcula um hash (mesmo sem conta/senha) para não distinguir os casos pelo tempo.
        const computed = await hashPassword(
          data.password,
          cred?.salt ?? DUMMY_SALT,
          cred?.iterations ?? PBKDF2_ITERATIONS,
        );
        if (!user || !cred?.hash || !safeEqual(computed, cred.hash)) {
          throw new ServiceError("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
        }
        store.setSessionUserId(user.id);
        return user;
      }),

    signInWithGoogle: (profile) =>
      ctx.run("auth.signInWithGoogle", (): GoogleSignInResult => {
        const normalized = normalizeGoogleProfile(profile);
        assertInstitutional(ctx, normalized.email);
        const user = store.read().users.find((u) => normalizeEmail(u.email) === normalized.email);
        if (!user) return { status: "needs_role", profile: normalized };
        store.setSessionUserId(user.id);
        return { status: "signed_in", user };
      }),

    completeGoogleSignUp: (input) =>
      ctx.run("auth.completeGoogleSignUp", () => {
        const profile = normalizeGoogleProfile(input);
        assertInstitutional(ctx, profile.email);
        const data = parseInput(googleSignUpSchema, { ...profile, role: input?.role });
        const user = store.transaction((db) => {
          assertEmailFree(db, data.email);
          const created: User = {
            id: ctx.newId("user"),
            name: data.name,
            email: data.email,
            role: data.role,
          };
          db.users.push(created);
          db.credentials.push({ userId: created.id, provider: "google" });
          return created;
        });
        store.setSessionUserId(user.id);
        return user;
      }),

    signInAsDemo: (role: UserRole) =>
      ctx.run("auth.signInAsDemo", () => {
        const user = findUser(store.read(), DEMO_PROFILE_IDS[role]);
        store.setSessionUserId(user.id);
        return user;
      }),

    listDemoProfiles: () =>
      ctx.run("auth.listDemoProfiles", (): DemoProfile[] => {
        const db = store.read();
        return (["student", "teacher", "admin"] as const).map((role) => ({
          role,
          label: DEMO_PROFILE_LABELS[role],
          user: findUser(db, DEMO_PROFILE_IDS[role]),
        }));
      }),

    signOut: () => ctx.run("auth.signOut", () => store.setSessionUserId(null), { instant: true }),
  };
}
