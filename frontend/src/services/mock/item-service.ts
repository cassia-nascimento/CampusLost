import { ServiceError, type Item, type PublicUser } from "@/types/domain";
import {
  assertAllowed,
  canClaim,
  canDeleteItem,
  canEditItem,
  canRegisterReturn,
  checkCapability,
  hasCapability,
  isVisibleInSearch,
  searchItems,
  toLocalDateString,
} from "@/lib/rules";
import { createItemSchema, itemFiltersSchema } from "@/lib/validation";
import type { ItemDetail, ItemInput, ItemService, ItemView } from "../contracts";
import { recordAudit } from "./audit";
import {
  findItem,
  findUser,
  parseInput,
  requireSession,
  requireUser,
  toPublicUser,
  type MockContext,
} from "./context";
import { toViewerItem } from "./viewer";

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
      ctx.run("items.list", (actor): ItemView[] => {
        const db = store.read();
        // Visitante permitido (P26); sessão apontando para usuário que sumiu (demo reiniciada) falha.
        const user = actor ? requireUser(db, actor, "search_items") : null;
        assertAllowed(checkCapability(user, "search_items"));
        const parsed = parseInput(itemFiltersSchema, filters ?? {});
        const found = searchItems(db.items, parsed);
        return found.map((i) => toViewerItem(i, user));
      }),

    get: (id) =>
      ctx.run("items.get", (actor): ItemDetail => {
        const db = store.read();
        const user = actor ? requireUser(db, actor, "search_items") : null;
        assertAllowed(checkCapability(user, "search_items"));
        const item = findItem(db, id);
        const itemClaims = db.claims.filter((c) => c.itemId === id);
        const createdBy: PublicUser = toPublicUser(findUser(db, item.createdById));
        if (!user) {
          // Visitante: devolvido é invisível (mesmo erro de item inexistente) e nada de terceiros.
          if (!isVisibleInSearch(item)) throw new ServiceError("NOT_FOUND", "Item não encontrado.");
          return {
            item: toViewerItem(item, null),
            createdBy: null,
            myClaims: [],
            claims: [],
            returnRecord: null,
            viewer: {
              claim: canClaim(null, item, itemClaims),
              edit: canEditItem(null, item),
              delete: canDeleteItem(null, item),
              registerReturn: canRegisterReturn(null, item, itemClaims),
            },
          };
        }
        const canReview = hasCapability(user, "review_claims");
        const canSeeReturns = hasCapability(user, "view_returns");
        return {
          item: toViewerItem(item, user),
          createdBy,
          myClaims: itemClaims
            .filter((c) => c.claimantId === user.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          claims: canReview
            ? itemClaims
                .map((c) => ({ ...c, claimant: findUser(db, c.claimantId) }))
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            : [],
          returnRecord: canSeeReturns ? (db.returns.find((r) => r.itemId === id) ?? null) : null,
          // Calculado aqui com a lista COMPLETA de reivindicações, para a UI explicar o motivo
          // sem receber reivindicações alheias.
          viewer: {
            claim: canClaim(user, item, itemClaims),
            edit: canEditItem(user, item),
            delete: canDeleteItem(user, item),
            registerReturn: canRegisterReturn(user, item, itemClaims),
          },
        };
      }),

    create: (input) =>
      ctx.run("items.create", async (actor) => {
        requireUser(store.read(), actor, "register_item");
        const fields = parseFields(input);
        const photoDataUrl = input.photo ? await ctx.photo(input.photo) : undefined;
        return store.transaction((db) => {
          const user = requireUser(db, actor, "register_item");
          const item: Item = {
            id: ctx.newId("item"),
            ...fields,
            ...(photoDataUrl ? { photoDataUrl } : {}),
            status: "available",
            createdById: user.id,
            createdAt: ctx.now().toISOString(),
          };
          db.items.push(item);
          return toViewerItem(item, user);
        });
      }),

    update: (id, input) =>
      ctx.run("items.update", async (actor) => {
        const before = store.read();
        const preUser = requireSession(before, actor);
        assertAllowed(canEditItem(preUser, findItem(before, id)));
        const fields = parseFields(input);
        const photoDataUrl = input.photo ? await ctx.photo(input.photo) : undefined;
        return store.transaction((db) => {
          const user = requireSession(db, actor);
          const current = findItem(db, id);
          assertAllowed(canEditItem(user, current));
          const { photoDataUrl: previousPhoto, ...rest } = current;
          const nextPhoto = input.photo === null ? undefined : (photoDataUrl ?? previousPhoto);
          const updated: Item = {
            ...rest,
            ...fields,
            ...(nextPhoto ? { photoDataUrl: nextPhoto } : {}),
          };
          db.items[db.items.findIndex((i) => i.id === id)] = updated;
          return toViewerItem(updated, user);
        });
      }),

    delete: (id) =>
      ctx.run("items.delete", (actor) => {
        store.transaction((db) => {
          const user = requireSession(db, actor);
          // Administração sem 2FA (e não isenta) é barrada antes de qualquer outra regra, como no backend.
          if (user.role === "admin") ctx.requireAdmin(db, actor, "delete_item");
          const item = findItem(db, id);
          assertAllowed(canDeleteItem(user, item));
          recordAudit(ctx, db, {
            actorId: user.id,
            action: "item.delete",
            target: ["item", id],
            metadata: { title: item.title, status: item.status },
          });
          db.items = db.items.filter((i) => i.id !== id);
          db.claims = db.claims.filter((c) => c.itemId !== id);
        });
      }),
  };
}
