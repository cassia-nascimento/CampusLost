import type { Item } from "@/types/domain";
import {
  canDeleteItem,
  canEditItem,
  canRegisterItem,
  assertAllowed,
  hasCapability,
  searchItems,
  toLocalDateString,
} from "@/lib/rules";
import { createItemSchema, itemFiltersSchema } from "@/lib/validation";
import type { ItemDetail, ItemInput, ItemService } from "../contracts";
import {
  currentUser,
  findItem,
  findUser,
  parseInput,
  requireUser,
  toPublicUser,
  type MockContext,
} from "./context";

export function createItemService(ctx: MockContext): ItemService {
  const { store } = ctx;
  const itemSchema = createItemSchema(() => toLocalDateString(ctx.now()));

  /** Valida os campos de texto; a foto é tratada à parte. */
  const parseFields = (input: ItemInput) => {
    const { photo: _photo, ...fields } = input;
    void _photo;
    return parseInput(itemSchema, fields);
  };

  return {
    list: (filters) =>
      ctx.run("items.list", () => {
        const db = store.read();
        requireUser(ctx, db, "search_items");
        const parsed = parseInput(itemFiltersSchema, filters ?? {});
        return searchItems(db.items, parsed);
      }),

    get: (id) =>
      ctx.run("items.get", (): ItemDetail => {
        const db = store.read();
        const user = requireUser(ctx, db, "search_items");
        const item = findItem(db, id);
        const itemClaims = db.claims.filter((c) => c.itemId === id);
        const admin = hasCapability(user, "review_claims");
        return {
          item,
          createdBy: toPublicUser(findUser(db, item.createdById)),
          myClaims: itemClaims
            .filter((c) => c.claimantId === user.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          claims: admin
            ? itemClaims
                .map((c) => ({ ...c, claimant: findUser(db, c.claimantId) }))
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            : [],
          returnRecord: admin ? (db.returns.find((r) => r.itemId === id) ?? null) : null,
        };
      }),

    create: (input) =>
      ctx.run("items.create", async () => {
        assertAllowed(canRegisterItem(currentUser(ctx, store.read())));
        const fields = parseFields(input);
        const photoDataUrl = input.photo ? await ctx.photo(input.photo) : undefined;
        return store.transaction((db) => {
          const user = requireUser(ctx, db, "register_item");
          const item: Item = {
            id: ctx.newId("item"),
            ...fields,
            ...(photoDataUrl ? { photoDataUrl } : {}),
            status: "available",
            createdById: user.id,
            createdAt: ctx.now().toISOString(),
          };
          db.items.push(item);
          return item;
        });
      }),

    update: (id, input) =>
      ctx.run("items.update", async () => {
        const before = store.read();
        requireUser(ctx, before);
        assertAllowed(canEditItem(currentUser(ctx, before), findItem(before, id)));
        const fields = parseFields(input);
        const photoDataUrl = input.photo ? await ctx.photo(input.photo) : undefined;
        return store.transaction((db) => {
          const current = findItem(db, id);
          assertAllowed(canEditItem(currentUser(ctx, db), current));
          const { photoDataUrl: previousPhoto, ...rest } = current;
          const nextPhoto =
            input.photo === null ? undefined : (photoDataUrl ?? previousPhoto);
          const updated: Item = { ...rest, ...fields, ...(nextPhoto ? { photoDataUrl: nextPhoto } : {}) };
          db.items[db.items.findIndex((i) => i.id === id)] = updated;
          return updated;
        });
      }),

    delete: (id) =>
      ctx.run("items.delete", () => {
        store.transaction((db) => {
          requireUser(ctx, db);
          const item = findItem(db, id);
          assertAllowed(canDeleteItem(currentUser(ctx, db), item));
          db.items = db.items.filter((i) => i.id !== id);
          db.claims = db.claims.filter((c) => c.itemId !== id);
        });
      }),
  };
}

