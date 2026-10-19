import { ServiceError, type Claim } from "@/types/domain";
import { assertAllowed, reviewClaim, submitClaim } from "@/lib/rules";
import { claimSchema } from "@/lib/validation";
import type { ClaimDecisionResult, ClaimService, ClaimView } from "../contracts";
import { findItem, findUser, parseInput, requireUser, type MockContext } from "./context";
import type { Db } from "./seed";

function toView(db: Db, claim: Claim): ClaimView {
  return { ...claim, claimant: findUser(db, claim.claimantId), item: findItem(db, claim.itemId) };
}

export function createClaimService(ctx: MockContext): ClaimService {
  const { store } = ctx;

  const decide = (claimId: string, decision: "accept" | "reject") =>
    ctx.run(`claims.${decision}`, (): ClaimDecisionResult =>
      store.transaction((db) => {
        const actor = requireUser(ctx, db, "review_claims");
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
        return { claim: result.claim, item: result.item, autoRejectedIds: result.autoRejectedIds };
      }),
    );

  return {
    create: (itemId, input) =>
      ctx.run("claims.create", () => {
        const data = parseInput(claimSchema, input);
        return store.transaction((db) => {
          const actor = requireUser(ctx, db, "claim_item");
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
      ctx.run("claims.listMine", () => {
        const db = store.read();
        const user = requireUser(ctx, db, "view_own_claims");
        return db.claims
          .filter((c) => c.claimantId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((c) => toView(db, c));
      }),

    listPending: () =>
      ctx.run("claims.listPending", () => {
        const db = store.read();
        requireUser(ctx, db, "review_claims");
        return db.claims
          .filter((c) => c.status === "pending")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((c) => toView(db, c));
      }),

    listByItem: (itemId) =>
      ctx.run("claims.listByItem", () => {
        const db = store.read();
        requireUser(ctx, db, "review_claims");
        findItem(db, itemId);
        return db.claims
          .filter((c) => c.itemId === itemId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((c) => toView(db, c));
      }),

    get: (claimId) =>
      ctx.run("claims.get", () => {
        const db = store.read();
        const user = requireUser(ctx, db);
        const claim = db.claims.find((c) => c.id === claimId);
        if (!claim) throw new ServiceError("NOT_FOUND", "Reivindicação não encontrada.");
        if (user.role !== "admin" && claim.claimantId !== user.id) {
          assertAllowed({
            allowed: false,
            code: "FORBIDDEN",
            message: "Você não tem permissão para ver esta reivindicação.",
          });
        }
        return toView(db, claim);
      }),

    accept: (claimId) => decide(claimId, "accept"),
    reject: (claimId) => decide(claimId, "reject"),
  };
}
