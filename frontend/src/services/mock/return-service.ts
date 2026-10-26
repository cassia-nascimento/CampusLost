import type { ReturnRecord } from "@/types/domain";
import { filterReturnsByPeriod, registerReturn, sortReturns } from "@/lib/rules";
import { periodSchema } from "@/lib/validation";
import type { ReturnService, ReturnView } from "../contracts";
import { recordAudit } from "./audit";
import {
  findItem,
  findUser,
  parseInput,
  toPublicUser,
  type MockContext,
} from "./context";
import type { Db } from "./seed";

function toView(db: Db, record: ReturnRecord): ReturnView {
  return {
    ...record,
    item: findItem(db, record.itemId),
    returnedTo: findUser(db, record.returnedToId),
    registeredBy: toPublicUser(findUser(db, record.registeredById)),
  };
}

export function createReturnService(ctx: MockContext): ReturnService {
  const { store } = ctx;
  return {
    register: (itemId) =>
      ctx.run("returns.register", (who) =>
        store.transaction((db) => {
          const actor = ctx.requireAdmin(db, who, "register_return");
          const item = findItem(db, itemId);
          const { item: nextItem, record } = registerReturn({
            actor,
            item,
            itemClaims: db.claims.filter((c) => c.itemId === itemId),
            id: ctx.newId("return"),
            now: ctx.now(),
          });
          db.items = db.items.map((i) => (i.id === itemId ? nextItem : i));
          db.returns.push(record);
          recordAudit(ctx, db, {
            actorId: actor.id,
            action: "return.register",
            target: ["item", itemId],
            metadata: { returnId: record.id, claimId: record.claimId },
          });
          return toView(db, record);
        }),
      ),

    list: (period) =>
      ctx.run("returns.list", (who) => {
        const db = store.read();
        ctx.requireAdmin(db, who, "view_returns");
        const parsed = parseInput(periodSchema, period ?? {});
        return sortReturns(filterReturnsByPeriod(db.returns, parsed)).map((r) => toView(db, r));
      }),
  };
}

