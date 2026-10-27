import { ServiceError, type ReturnRecord, type User } from "@/types/domain";
import {
  RETURN_CODE_NOT_ISSUED_MESSAGE,
  RETURN_CODE_REQUIRED_MESSAGE,
  assertAllowed,
  attemptReturnCode,
  canRegisterReturn,
  canVerifyReturnCode,
  checkReturnCodeForDelivery,
  filterReturnsByPeriod,
  normalizeReturnCode,
  registerReturn,
  returnCodeLockedMessage,
  sortReturns,
  wrongReturnCodeMessage,
} from "@/lib/rules";
import { periodSchema } from "@/lib/validation";
import type { ReturnCodeStatus, ReturnService, ReturnView } from "../contracts";
import { recordAudit } from "./audit";
import {
  findItem,
  findUser,
  parseInput,
  toPublicUser,
  type MockContext,
} from "./context";
import { adminReturnCodeStatus, hashReturnCode } from "./return-code";
import { safeEqual } from "./password";
import type { Db } from "./seed";
import { toViewerItem } from "./viewer";

function toView(db: Db, record: ReturnRecord, viewer: User): ReturnView {
  return {
    ...record,
    item: toViewerItem(findItem(db, record.itemId), viewer, db.claims),
    returnedTo: findUser(db, record.returnedToId),
    registeredBy: toPublicUser(findUser(db, record.registeredById)),
    codeVerifiedAt: db.returnCodes.find((c) => c.claimId === record.claimId && c.usedAt !== null)?.verifiedAt ?? null,
  };
}

/** Resultado de uma tentativa, decidido DENTRO da transação (que grava) e traduzido em erro FORA dela. */
type VerifyOutcome =
  | { kind: "verified"; status: ReturnCodeStatus }
  | { kind: "wrong"; attemptsLeft: number }
  | { kind: "locked"; remainingMs: number };

export function createReturnService(ctx: MockContext): ReturnService {
  const { store } = ctx;
  return {
    register: (itemId) =>
      ctx.run("returns.register", (who) =>
        store.transaction((db) => {
          const actor = ctx.requireAdmin(db, who, "register_return");
          const item = findItem(db, itemId);
          const itemClaims = db.claims.filter((c) => c.itemId === itemId);
          // Estado do item e da reivindicação primeiro (devolução duplicada = ITEM_RETURNED); depois a conferência
          // do código, sem exceção para a administração. Tudo na mesma transação que consome a conferência.
          assertAllowed(canRegisterReturn(actor, item, itemClaims));
          const accepted = itemClaims.find((c) => c.status === "accepted");
          const code = db.returnCodes.find((c) => c.claimId === accepted?.id);
          assertAllowed(checkReturnCodeForDelivery(code, ctx.now()));
          const { item: nextItem, record } = registerReturn({
            actor,
            item,
            itemClaims,
            id: ctx.newId("return"),
            now: ctx.now(),
          });
          if (code) code.usedAt = ctx.now().toISOString();
          db.items = db.items.map((i) => (i.id === itemId ? nextItem : i));
          db.returns.push(record);
          recordAudit(ctx, db, {
            actorId: actor.id,
            action: "return.register",
            target: ["item", itemId],
            metadata: { returnId: record.id, claimId: record.claimId, codeVerified: true },
          });
          return toView(db, record, actor);
        }),
      ),

    verifyCode: (claimId, code) =>
      ctx.run("returns.verifyCode", async (who): Promise<ReturnCodeStatus> => {
        const normalized = normalizeReturnCode(typeof code === "string" ? code : "");
        // Hash fora da transação (síncrona); a comparação dos hashes acontece dentro dela.
        const typedHash = normalized ? await hashReturnCode(claimId, normalized) : "";
        const outcome = store.transaction((db): VerifyOutcome => {
          const actor = ctx.requireAdmin(db, who, "register_return");
          if (!normalized) {
            throw new ServiceError("VALIDATION", "Confira os campos destacados.", {
              fieldErrors: { code: RETURN_CODE_REQUIRED_MESSAGE },
            });
          }
          const claim = db.claims.find((c) => c.id === claimId);
          if (!claim) throw new ServiceError("NOT_FOUND", "Reivindicação não encontrada.");
          assertAllowed(canVerifyReturnCode(actor, findItem(db, claim.itemId), claim));
          const record = db.returnCodes.find((r) => r.claimId === claimId);
          if (!record) throw new ServiceError("INVALID_TRANSITION", RETURN_CODE_NOT_ISSUED_MESSAGE);

          const now = ctx.now();
          const attempt = attemptReturnCode(record, safeEqual(typedHash, record.codeHash), now);
          Object.assign(record, attempt.next);
          const target: [string, string] = ["claim", claimId];
          switch (attempt.outcome) {
            case "verified":
              record.verifiedById = actor.id;
              recordAudit(ctx, db, { actorId: actor.id, action: "return_code.verify", target, metadata: { itemId: claim.itemId } });
              return { kind: "verified", status: adminReturnCodeStatus(record, now) };
            case "wrong":
              recordAudit(ctx, db, {
                actorId: actor.id,
                action: "return_code.failure",
                target,
                metadata: { itemId: claim.itemId, attemptsLeft: attempt.attemptsLeft },
              });
              return { kind: "wrong", attemptsLeft: attempt.attemptsLeft };
            case "locked":
              recordAudit(ctx, db, { actorId: actor.id, action: "return_code.failure", target, metadata: { itemId: claim.itemId, attemptsLeft: 0 } });
              recordAudit(ctx, db, { actorId: actor.id, action: "return_code.locked", target, metadata: { itemId: claim.itemId } });
              return { kind: "locked", remainingMs: attempt.remainingMs };
            case "blocked":
              return { kind: "locked", remainingMs: attempt.remainingMs };
          }
        });
        // A falha foi gravada acima; só agora ela vira erro (uma transação que lança não grava).
        if (outcome.kind === "wrong") {
          throw new ServiceError("VALIDATION", "Confira os campos destacados.", {
            fieldErrors: { code: wrongReturnCodeMessage(outcome.attemptsLeft) },
          });
        }
        if (outcome.kind === "locked") throw new ServiceError("RATE_LIMITED", returnCodeLockedMessage(outcome.remainingMs));
        return outcome.status;
      }),

    list: (period) =>
      ctx.run("returns.list", (who) => {
        const db = store.read();
        const admin = ctx.requireAdmin(db, who, "view_returns");
        const parsed = parseInput(periodSchema, period ?? {});
        return sortReturns(filterReturnsByPeriod(db.returns, parsed)).map((r) => toView(db, r, admin));
      }),
  };
}

