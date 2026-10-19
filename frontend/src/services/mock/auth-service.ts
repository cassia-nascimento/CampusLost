import { ServiceError, type User, type UserRole } from "@/types/domain";
import { normalizeEmail, signInSchema, signUpSchema } from "@/lib/validation";
import type { AuthService, DemoProfile } from "../contracts";
import { findUser, parseInput, type MockContext } from "./context";
import { DEMO_PROFILE_IDS, DEMO_PROFILE_LABELS } from "./seed";

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
      ctx.run("auth.signUp", () => {
        const data = parseInput(signUpSchema, input);
        const user = store.transaction((db) => {
          if (db.users.some((u) => normalizeEmail(u.email) === data.email)) {
            throw new ServiceError("EMAIL_TAKEN", "Este e-mail já está cadastrado.", {
              fieldErrors: { email: "Este e-mail já está cadastrado." },
            });
          }
          const created: User = {
            id: ctx.newId("user"),
            name: data.name,
            email: data.email,
            role: data.role,
          };
          db.users.push(created);
          return created;
        });
        store.setSessionUserId(user.id);
        return user;
      }),

    signIn: (input) =>
      ctx.run("auth.signIn", () => {
        const data = parseInput(signInSchema, input);
        const user = store.read().users.find((u) => normalizeEmail(u.email) === data.email);
        if (!user) {
          throw new ServiceError("USER_NOT_FOUND", "Não encontramos uma conta com este e-mail.", {
            fieldErrors: { email: "Não encontramos uma conta com este e-mail." },
          });
        }
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
