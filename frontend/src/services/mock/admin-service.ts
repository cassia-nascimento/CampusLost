import { ServiceError, type User } from "@/types/domain";
import type { AdminInvite, AdminUserRow, AuditEntry, CreatedInvite, Page } from "@/types/admin";
import {
  assertAllowed,
  canUpdateUser,
  countOtherActiveAdmins,
  emailFingerprint,
  INVITE_TTL_HOURS,
  inviteStatus,
  paginate,
  passwordIssue,
  PASSWORD_ISSUE_MESSAGE,
  addHours,
  type Capability,
} from "@/lib/rules";
import {
  acceptInviteSchema,
  adminUserFiltersSchema,
  auditFiltersSchema,
  inviteSchema,
  pageParamsSchema,
  userPatchSchema,
} from "@/lib/validation";
import type { AdminService, AuthService } from "../contracts";
import { recordAudit } from "./audit";
import { isActiveAccount, parseInput, type MockContext } from "./context";
import { hashPassword, newSalt, newToken, PBKDF2_ITERATIONS } from "./password";
import type { AccountMeta, Db, InviteRecord } from "./seed";

/** Rota da UI que recebe o token do convite (o link simulado aponta para ela). */
export const ACCEPT_INVITE_PATH = "/aceitar-convite";
const INVITE_INVALID_MESSAGE = "Link inválido ou expirado. Peça um novo.";
const EMAIL_TAKEN_MESSAGE = "Este e-mail já está cadastrado.";

function providerOf(db: Db, userId: string): string {
  return db.credentials.some((c) => c.userId === userId && c.provider === "password") ? "password" : "google";
}

function toUserRow(db: Db, user: User, meta: AccountMeta | undefined, fallbackCreatedAt: string): AdminUserRow {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    provider: providerOf(db, user.id),
    active: !meta?.disabledAt,
    disabledAt: meta?.disabledAt ?? null,
    emailVerified: user.emailVerified,
    twoFactorEnabled: !!user.twoFactorEnabled,
    createdAt: meta?.createdAt ?? fallbackCreatedAt,
  };
}

function toInvite(invite: InviteRecord, now: Date): AdminInvite {
  return {
    id: invite.id,
    email: invite.email,
    status: inviteStatus(invite, now),
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    invitedById: invite.invitedById,
  };
}

/** Um `Page` fora do padrão da API (índice a partir de 1) com os parâmetros já validados. */
function pageOf<T>(all: readonly T[], page?: number, pageSize?: number): Page<T> {
  return paginate(all, page, pageSize);
}

export function createAdminService(ctx: MockContext): AdminService {
  const { store } = ctx;

  const requireAdmin = (db: Db, who: User | null, capability: Capability): User => ctx.requireAdmin(db, who, capability);

  return {
    listUsers: (filters) =>
      ctx.run("admin.listUsers", (who) => {
        const db = store.read();
        requireAdmin(db, who, "manage_users");
        const f = parseInput(adminUserFiltersSchema, filters ?? {});
        const epoch = new Date(0).toISOString();
        const q = f.q?.toLowerCase();
        const rows = db.users
          .filter((u) => !db.accounts.find((a) => a.userId === u.id)?.deletedAt)
          .map((u) => toUserRow(db, u, db.accounts.find((a) => a.userId === u.id), epoch))
          .filter((r) => !f.role || r.role === f.role)
          .filter((r) => !f.status || r.active === (f.status === "active"))
          .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
        return pageOf(rows, f.page, f.pageSize);
      }),

    updateUser: (id, patch) =>
      ctx.run("admin.updateUser", (who) => {
        const data = parseInput(userPatchSchema, patch ?? {});
        return store.transaction((db) => {
          const actor = requireAdmin(db, who, "manage_users");
          const user = db.users.find((u) => u.id === id);
          const meta = db.accounts.find((a) => a.userId === id);
          if (!user || meta?.deletedAt) throw new ServiceError("NOT_FOUND", "Usuário não encontrado.");
          const accounts = db.users.map((u) => ({ id: u.id, role: u.role, active: isActiveAccount(db, u.id) }));
          assertAllowed(
            canUpdateUser(actor, { id, role: user.role, active: !meta?.disabledAt }, data, countOtherActiveAdmins(accounts, id)),
          );
          if (data.role !== undefined && data.role !== user.role) {
            recordAudit(ctx, db, {
              actorId: actor.id,
              action: "user.role_change",
              target: ["user", id],
              metadata: { from: user.role, to: data.role },
            });
            user.role = data.role;
          }
          const nowIso = ctx.now().toISOString();
          const account = meta ?? (db.accounts[db.accounts.push({ userId: id, createdAt: nowIso }) - 1] as AccountMeta);
          if (data.active === false && !account.disabledAt) {
            account.disabledAt = nowIso; // a sessão dela deixa de valer na próxima chamada
            recordAudit(ctx, db, { actorId: actor.id, action: "user.disable", target: ["user", id] });
          } else if (data.active === true && account.disabledAt) {
            delete account.disabledAt;
            recordAudit(ctx, db, { actorId: actor.id, action: "user.enable", target: ["user", id] });
          }
          return toUserRow(db, user, account, nowIso);
        });
      }),

    createInvite: (email) =>
      ctx.run("admin.createInvite", (who): CreatedInvite => {
        const data = parseInput(inviteSchema, { email });
        return store.transaction((db) => {
          const actor = requireAdmin(db, who, "manage_users");
          if (db.users.some((u) => u.email.trim().toLowerCase() === data.email)) {
            throw new ServiceError("EMAIL_TAKEN", EMAIL_TAKEN_MESSAGE, { fieldErrors: { email: EMAIL_TAKEN_MESSAGE } });
          }
          const now = ctx.now();
          for (const old of db.invites) {
            // um convite aberto por e-mail
            if (old.email === data.email && !old.usedAt && !old.revokedAt) old.revokedAt = now.toISOString();
          }
          const invite: InviteRecord = {
            id: ctx.newId("invite"),
            email: data.email,
            token: newToken() + newToken(),
            invitedById: actor.id,
            createdAt: now.toISOString(),
            expiresAt: addHours(now, INVITE_TTL_HOURS).toISOString(),
          };
          db.invites.push(invite);
          recordAudit(ctx, db, {
            actorId: actor.id,
            action: "invite.create",
            target: ["invite", invite.id],
            metadata: { emailRef: emailFingerprint(data.email) },
          });
          return { ...toInvite(invite, now), devLink: `${ACCEPT_INVITE_PATH}?token=${invite.token}` };
        });
      }),

    listInvites: (filters) =>
      ctx.run("admin.listInvites", (who) => {
        const db = store.read();
        requireAdmin(db, who, "manage_users");
        const f = parseInput(pageParamsSchema, filters ?? {});
        const now = ctx.now();
        const rows = [...db.invites]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
          .map((i) => toInvite(i, now));
        return pageOf(rows, f.page, f.pageSize);
      }),

    revokeInvite: (id) =>
      ctx.run("admin.revokeInvite", (who) => {
        store.transaction((db) => {
          const actor = requireAdmin(db, who, "manage_users");
          const invite = db.invites.find((i) => i.id === id);
          if (!invite) throw new ServiceError("NOT_FOUND", "Convite não encontrado.");
          if (invite.usedAt) throw new ServiceError("CONFLICT", "Este convite já foi aceito.");
          if (!invite.revokedAt) {
            invite.revokedAt = ctx.now().toISOString();
            recordAudit(ctx, db, { actorId: actor.id, action: "invite.revoke", target: ["invite", invite.id] });
          }
        });
      }),

    listAuditLog: (filters) =>
      ctx.run("admin.listAuditLog", (who) => {
        const db = store.read();
        requireAdmin(db, who, "view_audit");
        const f = parseInput(auditFiltersSchema, filters ?? {});
        const rows: AuditEntry[] = db.audit
          .map((r, index) => ({ r, index }))
          .filter(({ r }) => (!f.action || r.action === f.action) && (!f.actor || r.actorId === f.actor))
          .sort((a, b) => b.r.at.localeCompare(a.r.at) || b.index - a.index)
          .map(({ r }) => ({
            id: r.id,
            at: r.at,
            actorId: r.actorId,
            actorName: (r.actorId && db.users.find((u) => u.id === r.actorId)?.name) || null,
            action: r.action,
            targetType: r.targetType,
            targetId: r.targetId,
            ip: null,
            metadata: r.metadata,
          }));
        return pageOf(rows, f.page, f.pageSize);
      }),
  };
}

/** `AuthService.acceptInvite`: cria a conta `admin` (e-mail verificado, SEM 2FA) e abre a sessão. */
export function createAcceptInvite(ctx: MockContext): AuthService["acceptInvite"] {
  const { store } = ctx;
  return (input) =>
    ctx.run("auth.acceptInvite", async () => {
      const token = typeof input?.token === "string" ? input.token.trim() : "";
      const usable = (db: Db) => {
        const invite = db.invites.find((i) => i.token === token);
        if (!invite || inviteStatus(invite, ctx.now()) !== "pending") {
          throw new ServiceError("TOKEN_INVALID", INVITE_INVALID_MESSAGE);
        }
        return invite;
      };
      usable(store.read()); // token ruim: erro sem revelar nada além disso (antes de validar os campos)
      const data = parseInput(acceptInviteSchema, input);
      const invite0 = usable(store.read());
      const issue = passwordIssue(data.password, { email: invite0.email, name: data.name });
      if (issue) {
        throw new ServiceError("VALIDATION", "Confira os campos destacados.", {
          fieldErrors: { password: PASSWORD_ISSUE_MESSAGE[issue] },
        });
      }
      const salt = newSalt();
      const hash = await hashPassword(data.password, salt);
      const user = store.transaction((db) => {
        const invite = usable(db);
        if (db.users.some((u) => u.email.trim().toLowerCase() === invite.email)) {
          throw new ServiceError("EMAIL_TAKEN", EMAIL_TAKEN_MESSAGE, { fieldErrors: { email: EMAIL_TAKEN_MESSAGE } });
        }
        const nowIso = ctx.now().toISOString();
        invite.usedAt = nowIso;
        const created: User = {
          id: ctx.newId("user"),
          name: data.name,
          email: invite.email,
          role: "admin",
          emailVerified: true,
          hasPassword: true,
          twoFactorEnabled: false,
        };
        db.users.push(created);
        db.credentials.push({ userId: created.id, provider: "password", salt, hash, iterations: PBKDF2_ITERATIONS });
        db.accounts.push({ userId: created.id, createdAt: nowIso });
        recordAudit(ctx, db, { actorId: created.id, action: "invite.accept", target: ["invite", invite.id] });
        return created;
      });
      store.setSessionUserId(user.id);
      return user;
    });
}
