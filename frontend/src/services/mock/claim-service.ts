import { ServiceError, type Claim, type User } from "@/types/domain";
import {
  assertAllowed,
  canIssueReturnCode,
  canViewClaim,
  formatReturnCode,
  generateReturnCode,
  reviewClaim,
  submitClaim,
} from "@/lib/rules";
import { claimSchema } from "@/lib/validation";
import type { ClaimDecisionResult, ClaimService, ClaimView, IssuedReturnCode, ReturnCodeStatus } from "../contracts";
import { recordAudit } from "./audit";
import { findItem, findUser, parseInput, requireSession, requireUser, type MockContext } from "./context";
import { adminReturnCodeStatus, hashReturnCode, ownerReturnCodeStatus } from "./return-code";
import type { Db } from "./seed";
import { toViewerItem } from "./viewer";

function toView(db: Db, claim: Claim, viewer: User): ClaimView {
  return { ...claim, claimant: findUser(db, claim.claimantId), item: toViewerItem(findItem(db, claim.itemId), viewer, db.claims) };
}

export function createClaimService(ctx: MockContext): ClaimService {
  const { store } = ctx;

  const decide = (claimId: string, decision: "accept" | "reject") =>
    ctx.run(`claims.${decision}`, (who): ClaimDecisionResult =>
      store.transaction((db) => {
        const actor = ctx.requireAdmin(db, who, "review_claims");
        const target = db.claims.find((c) => c.id === claimId);
        if (!target) throw new ServiceError("NOT_FOUND", "Reivindicação não encontrada.");
        const item = findItem(db, target.itemId);
        const result = reviewClaim({
          actor,
          item,
          itemClaims: db.claims.filter((c) => c.itemId === item.id),
          claimId,
          decision,
          now: ctx.now(),
        });
        db.claims = db.claims.map((c) => result.claims.find((u) => u.id === c.id) ?? c);
        db.items = db.items.map((i) => (i.id === item.id ? result.item : i));
        recordAudit(ctx, db, {
          actorId: actor.id,
          action: decision === "accept" ? "claim.accept" : "claim.reject",
          target: ["claim", claimId],
          metadata: { itemId: item.id, autoRejected: result.autoRejectedIds.length },
        });
        return { claim: result.claim, item: toViewerItem(result.item, actor, db.claims), autoRejectedIds: result.autoRejectedIds };
      }),
    );

  return {
    create: (itemId, input) =>
      ctx.run("claims.create", (who) => {
        const data = parseInput(claimSchema, input);
        return store.transaction((db) => {
          const actor = requireUser(db, who, "claim_item");
          const item = findItem(db, itemId);
          const { claim, item: nextItem } = submitClaim({
            actor,
            item,
            itemClaims: db.claims.filter((c) => c.itemId === itemId),
            input: data,
            id: ctx.newId("claim"),
            now: ctx.now(),
          });
          db.claims.push(claim);
          db.items = db.items.map((i) => (i.id === itemId ? nextItem : i));
          return claim;
        });
      }),

    listMine: () =>
      ctx.run("claims.listMine", (who) => {
        const db = store.read();
        const user = requireUser(db, who, "view_own_claims");
        return db.claims
          .filter((c) => c.claimantId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((c) => toView(db, c, user));
      }),

    listPending: () =>
      ctx.run("claims.listPending", (who) => {
        const db = store.read();
        const user = requireUser(db, who, "review_claims");
        return db.claims
          .filter((c) => c.status === "pending")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((c) => toView(db, c, user));
      }),

    listByItem: (itemId) =>
      ctx.run("claims.listByItem", (who) => {
        const db = store.read();
        const user = requireUser(db, who, "review_claims");
        findItem(db, itemId);
        return db.claims
          .filter((c) => c.itemId === itemId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((c) => toView(db, c, user));
      }),

    get: (claimId) =>
      ctx.run("claims.get", (who) => {
        const db = store.read();
        const user = requireSession(db, who);
        const claim = db.claims.find((c) => c.id === claimId);
        if (!claim) throw new ServiceError("NOT_FOUND", "Reivindicação não encontrada.");
        assertAllowed(canViewClaim(user, claim));
        return toView(db, claim, user);
      }),

    accept: (claimId) => decide(claimId, "accept"),
    reject: (claimId) => decide(claimId, "reject"),

    issueReturnCode: (claimId) =>
      ctx.run("claims.issueReturnCode", async (who): Promise<IssuedReturnCode> => {
        // O sorteio e o hash (assíncrono) ficam fora da transação síncrona; dentro dela só se grava o hash.
        const code = generateReturnCode(ctx.randomBytes);
        const codeHash = await hashReturnCode(claimId, code);
        return store.transaction((db) => {
          const actor = requireSession(db, who);
          const claim = db.claims.find((c) => c.id === claimId);
          if (!claim) throw new ServiceError("NOT_FOUND", "Reivindicação não encontrada.");
          assertAllowed(canIssueReturnCode(actor, findItem(db, claim.itemId), claim));
          const issuedAt = ctx.now().toISOString();
          const current = db.returnCodes.find((r) => r.claimId === claimId);
          if (current) {
            // Novo código: invalida o anterior e zera a conferência; tentativas e bloqueio permanecem.
            Object.assign(current, { codeHash, issuedAt, verifiedAt: null, verifiedById: null, usedAt: null });
          } else {
            db.returnCodes.push({
              id: ctx.newId("returncode"),
              claimId,
              itemId: claim.itemId,
              codeHash,
              issuedAt,
              failedAttempts: 0,
              lockedUntil: null,
              verifiedAt: null,
              verifiedById: null,
              usedAt: null,
            });
          }
          recordAudit(ctx, db, {
            actorId: actor.id,
            action: "return_code.issue",
            target: ["claim", claimId],
            metadata: { itemId: claim.itemId, reissued: current !== undefined },
          });
          return { code: formatReturnCode(code), issuedAt };
        });
      }),

    getReturnCodeStatus: (claimId) =>
      ctx.run("claims.getReturnCodeStatus", (who): ReturnCodeStatus => {
        const db = store.read();
        const user = requireSession(db, who);
        const claim = db.claims.find((c) => c.id === claimId);
        if (!claim) throw new ServiceError("NOT_FOUND", "Reivindicação não encontrada.");
        const record = db.returnCodes.find((r) => r.claimId === claimId);
        if (user.role === "admin") {
          ctx.requireAdmin(db, who, "register_return");
          return adminReturnCodeStatus(record, ctx.now());
        }
        if (claim.claimantId !== user.id) {
          throw new ServiceError("FORBIDDEN", "Você não tem permissão para ver o código de retirada desta reivindicação.");
        }
        return ownerReturnCodeStatus(record);
      }),
  };
}
