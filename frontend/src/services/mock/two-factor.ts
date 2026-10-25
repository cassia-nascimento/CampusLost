/**
 * 2FA (TOTP) do mock: login em duas etapas, configurar/ligar/desligar. Espelha `backend/app/routers/twofa.py`.
 * O TOTP é real (`lib/rules/totp`, RFC 6238): um aplicativo autenticador de verdade gera os códigos.
 */
import { ServiceError } from "@/types/domain";
import type { TwoFactorChallenge } from "@/types/admin";
import {
  newRecoveryCodes,
  newTotpSecret,
  normalizeRecoveryCode,
  otpauthUri,
  sha1Hex,
  verifyTotp,
} from "@/lib/rules";
import { disableTwoFactorSchema, enableTwoFactorSchema, verifyTwoFactorSchema } from "@/lib/validation";
import type { AuthService, SignInResult } from "../contracts";
import { recordAudit, recordAuditSafely } from "./audit";
import { isDisabled, parseInput, requireSession, type MockContext } from "./context";
import { verifyAccountPassword } from "./password";
import type { Db, TwoFactorRecord } from "./seed";

export const BAD_CODE_MESSAGE = "Código incorreto ou expirado.";
const CHALLENGE_EXPIRED_MESSAGE = "A verificação expirou. Entre novamente.";
const DISABLED_MESSAGE = "Esta conta está desativada. Fale com a administração do campus.";
const ALREADY_ON_MESSAGE = "A verificação em duas etapas já está ativa.";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_PREFIX = "mock-2fa.";

/* ---------- desafio (equivale ao JWT de 5 min da API) ---------- */

function encodeChallenge(userId: string, expiresAtMs: number): string {
  return CHALLENGE_PREFIX + btoa(JSON.stringify({ u: userId, e: expiresAtMs })).replace(/=+$/, "");
}

/** `null` se inválido ou expirado. Não é assinado (mock), como o ticket do Google. */
function decodeChallenge(token: string, nowMs: number): string | null {
  if (typeof token !== "string" || !token.startsWith(CHALLENGE_PREFIX)) return null;
  try {
    const data = JSON.parse(atob(token.slice(CHALLENGE_PREFIX.length))) as { u?: unknown; e?: unknown };
    if (typeof data.u === "string" && typeof data.e === "number" && data.e > nowMs) return data.u;
  } catch {
    /* inválido */
  }
  return null;
}

/* ---------- login ---------- */

/** O registro de 2FA LIGADO do usuário, se houver. */
export function enabledTwoFactor(db: Db, userId: string): TwoFactorRecord | undefined {
  return db.twoFactor.find((t) => t.userId === userId && t.enabledAt);
}

/**
 * Conclusão do login (senha, Google): conta desativada -> `ACCOUNT_DISABLED`; 2FA ligado -> desafio (nenhuma sessão);
 * senão abre a sessão. Credenciais já conferidas por quem chama.
 */
export function completeLogin(ctx: MockContext, userId: string, method: "password" | "google"): SignInResult {
  const db = ctx.store.read();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new ServiceError("INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
  if (isDisabled(db, user.id)) {
    recordAuditSafely(ctx, {
      actorId: user.id,
      action: "login.failure",
      target: ["user", user.id],
      metadata: { reason: "disabled", method },
    });
    throw new ServiceError("ACCOUNT_DISABLED", DISABLED_MESSAGE);
  }
  if (enabledTwoFactor(db, user.id)) {
    const challenge: TwoFactorChallenge = {
      status: "needs_2fa",
      challengeToken: encodeChallenge(user.id, ctx.now().getTime() + CHALLENGE_TTL_MS),
    };
    return challenge;
  }
  recordAuditSafely(ctx, { actorId: user.id, action: "login.success", target: ["user", user.id], metadata: { method } });
  ctx.store.setSessionUserId(user.id);
  return { status: "signed_in", user };
}

/* ---------- segundo fator ---------- */

type SecondFactor = "totp" | "recovery";

/** Confere e CONSOME um TOTP (anti-reuso) ou código de recuperação; altera `record` dentro da transação. */
function consumeSecondFactor(
  record: TwoFactorRecord,
  input: { code?: string; recoveryCode?: string },
  now: Date,
): SecondFactor | null {
  const tryTotp = input.recoveryCode === undefined && input.code !== undefined;
  const raw = input.recoveryCode ?? input.code;
  if (tryTotp) {
    const step = verifyTotp(record.secret, raw, now, record.lastStep);
    if (step !== null) {
      record.lastStep = step;
      return "totp";
    }
  }
  const normalized = normalizeRecoveryCode(raw);
  if (normalized) {
    const hash = sha1Hex(normalized);
    const match = record.recoveryCodes.find((c) => c.hash === hash && !c.usedAt);
    if (match) {
      match.usedAt = now.toISOString();
      return "recovery";
    }
  }
  return null;
}

type TwoFactorMethods = Pick<
  AuthService,
  "verifyTwoFactor" | "setupTwoFactor" | "enableTwoFactor" | "disableTwoFactor"
>;

export function createTwoFactorMethods(ctx: MockContext): TwoFactorMethods {
  const { store } = ctx;
  const badCode = () => new ServiceError("VALIDATION", "Confira os campos destacados.", { fieldErrors: { code: BAD_CODE_MESSAGE } });

  return {
    verifyTwoFactor: (input) =>
      ctx.run("auth.verifyTwoFactor", () => {
        const data = parseInput(verifyTwoFactorSchema, input);
        const userId = decodeChallenge(data.challengeToken, ctx.now().getTime());
        const db0 = store.read();
        const user0 = userId ? db0.users.find((u) => u.id === userId) : undefined;
        if (!user0 || !enabledTwoFactor(db0, user0.id)) throw new ServiceError("UNAUTHENTICATED", CHALLENGE_EXPIRED_MESSAGE);
        if (isDisabled(db0, user0.id)) throw new ServiceError("ACCOUNT_DISABLED", DISABLED_MESSAGE);
        const method = store.transaction((db): SecondFactor | null => {
          const record = enabledTwoFactor(db, user0.id)!;
          const used = consumeSecondFactor(
            record,
            data.recoveryCode?.trim() ? { recoveryCode: data.recoveryCode } : { code: data.code },
            ctx.now(),
          );
          recordAudit(
            ctx,
            db,
            used
              ? { actorId: user0.id, action: "login.success", target: ["user", user0.id], metadata: { method: "2fa", second: used } }
              : { actorId: user0.id, action: "login.failure", target: ["user", user0.id], metadata: { method: "2fa" } },
          );
          return used;
        });
        if (!method) {
          throw new ServiceError("INVALID_CREDENTIALS", BAD_CODE_MESSAGE, { fieldErrors: { code: BAD_CODE_MESSAGE } });
        }
        store.setSessionUserId(user0.id);
        return user0;
      }),

    setupTwoFactor: () =>
      ctx.run("auth.setupTwoFactor", (actor) =>
        store.transaction((db) => {
          const user = requireSession(db, actor);
          if (enabledTwoFactor(db, user.id)) throw new ServiceError("CONFLICT", ALREADY_ON_MESSAGE);
          const secret = newTotpSecret(ctx.randomBytes(20));
          db.twoFactor = db.twoFactor.filter((t) => t.userId !== user.id);
          db.twoFactor.push({ userId: user.id, secret, recoveryCodes: [] });
          return { secret, otpauthUri: otpauthUri(secret, user.email) };
        }),
      ),

    enableTwoFactor: (code) =>
      ctx.run("auth.enableTwoFactor", (actor) => {
        const parsed = enableTwoFactorSchema.safeParse({ code });
        const result = store.transaction((db) => {
          const user = requireSession(db, actor);
          const record = db.twoFactor.find((t) => t.userId === user.id);
          if (record?.enabledAt) throw new ServiceError("CONFLICT", ALREADY_ON_MESSAGE);
          if (!record) throw new ServiceError("CONFLICT", "Gere o segredo primeiro.");
          const step = parsed.success ? verifyTotp(record.secret, parsed.data.code, ctx.now(), record.lastStep) : null;
          if (step === null) {
            recordAudit(ctx, db, { actorId: user.id, action: "2fa.failure", target: ["user", user.id], metadata: { stage: "enable" } });
            return null;
          }
          const codes = newRecoveryCodes(ctx.randomBytes(80));
          record.enabledAt = ctx.now().toISOString();
          record.lastStep = step;
          record.recoveryCodes = codes.map((c) => ({ hash: sha1Hex(c) }));
          const stored = db.users.find((u) => u.id === user.id);
          if (stored) stored.twoFactorEnabled = true;
          recordAudit(ctx, db, { actorId: user.id, action: "2fa.enable", target: ["user", user.id] });
          return { recoveryCodes: codes };
        });
        if (!result) throw badCode();
        return result;
      }),

    disableTwoFactor: (input) =>
      ctx.run("auth.disableTwoFactor", async (actor) => {
        const data = parseInput(disableTwoFactorSchema, input);
        const db0 = store.read();
        const user0 = requireSession(db0, actor);
        if (!enabledTwoFactor(db0, user0.id)) {
          throw new ServiceError("CONFLICT", "A verificação em duas etapas não está ativa.");
        }
        const hasPassword = db0.credentials.some((c) => c.userId === user0.id && c.provider === "password");
        const passwordOk = !hasPassword || (!!data.password && (await verifyAccountPassword(db0.credentials, user0.id, data.password)));
        const outcome = store.transaction((db): SecondFactor | null | "denied" => {
          const record = enabledTwoFactor(db, user0.id);
          if (!record) throw new ServiceError("CONFLICT", "A verificação em duas etapas não está ativa.");
          const method = passwordOk ? consumeSecondFactor(record, { code: data.code }, ctx.now()) : null;
          if (!passwordOk || !method) {
            recordAudit(ctx, db, { actorId: user0.id, action: "2fa.failure", target: ["user", user0.id], metadata: { stage: "disable" } });
            return "denied";
          }
          db.twoFactor = db.twoFactor.filter((t) => t.userId !== user0.id);
          const stored = db.users.find((u) => u.id === user0.id);
          if (stored) stored.twoFactorEnabled = false;
          recordAudit(ctx, db, { actorId: user0.id, action: "2fa.disable", target: ["user", user0.id], metadata: { with: method } });
          return method;
        });
        if (outcome === "denied" || outcome === null) {
          throw new ServiceError("INVALID_CREDENTIALS", "Senha ou código incorretos. A verificação em duas etapas continua ativa.", {
            fieldErrors: { password: "Confira a senha e o código." },
          });
        }
      }),
  };
}

