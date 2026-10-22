/**
 * Tradução do JSON da API (docs/api/API.md §3) para os tipos do frontend. A única diferença estrutural é a
 * foto: a API envia `photoUrl` (caminho relativo ou `null`) e o frontend usa `photoDataUrl?` (nome histórico)
 * com a URL absoluta. Caminho fora de `/uploads/...` é descartado (o item segue sem foto).
 */
import { isApiUploadPath } from "@/lib/validation/photo";
import { ServiceError, type Claim, type Item, type PublicUser, type ReturnRecord, type User } from "@/types/domain";
import type {
  ClaimDecisionResult,
  ClaimView,
  ClaimWithClaimant,
  ItemDetail,
  ItemView,
  ItemViewerPermissions,
  ReturnView,
} from "../contracts";

type Raw = Record<string, unknown>;

function unexpected(what: string): ServiceError {
  return new ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.", {
    cause: new Error(`Resposta inesperada da API: ${what}`),
  });
}

export function asRecord(value: unknown, what = "objeto"): Raw {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw unexpected(what);
  return value as Raw;
}

export function asArray(value: unknown, what = "lista"): unknown[] {
  if (!Array.isArray(value)) throw unexpected(what);
  return value;
}

/** `photoUrl` relativo da API -> URL absoluta, ou `undefined` (sem foto ou caminho suspeito). */
export function absolutePhotoUrl(baseUrl: string, photoUrl: unknown): string | undefined {
  if (typeof photoUrl !== "string" || !isApiUploadPath(photoUrl)) return undefined;
  return `${baseUrl}${photoUrl}`;
}

export interface Mappers {
  item(raw: unknown): Item;
  itemView(raw: unknown): ItemView;
  claim(raw: unknown): Claim;
  claimView(raw: unknown): ClaimView;
  claimWithClaimant(raw: unknown): ClaimWithClaimant;
  claimDecision(raw: unknown): ClaimDecisionResult;
  returnRecord(raw: unknown): ReturnRecord;
  returnView(raw: unknown): ReturnView;
  itemDetail(raw: unknown): ItemDetail;
  user(raw: unknown): User;
}

export function createMappers(baseUrl: string): Mappers {
  /** Troca `photoUrl` por `photoDataUrl` (ausente quando não há foto). */
  function withPhoto<T extends Raw>(raw: unknown, what: string): T {
    const { photoUrl, ...rest } = asRecord(raw, what);
    const photo = absolutePhotoUrl(baseUrl, photoUrl);
    return (photo ? { ...rest, photoDataUrl: photo } : rest) as T;
  }

  const item = (raw: unknown): Item => withPhoto<Raw>(raw, "item") as unknown as Item;
  const itemView = (raw: unknown): ItemView => withPhoto<Raw>(raw, "item") as unknown as ItemView;
  const claim = (raw: unknown): Claim => asRecord(raw, "reivindicação") as unknown as Claim;
  const user = (raw: unknown): User => asRecord(raw, "usuário") as unknown as User;
  const claimWithClaimant = (raw: unknown): ClaimWithClaimant => {
    const r = asRecord(raw, "reivindicação");
    return { ...claim(r), claimant: user(r.claimant) };
  };
  const claimView = (raw: unknown): ClaimView => {
    const r = asRecord(raw, "reivindicação");
    return { ...claimWithClaimant(r), item: item(r.item) };
  };
  const returnRecord = (raw: unknown): ReturnRecord => asRecord(raw, "devolução") as unknown as ReturnRecord;
  const returnView = (raw: unknown): ReturnView => {
    const r = asRecord(raw, "devolução");
    return {
      ...returnRecord(r),
      item: item(r.item),
      returnedTo: user(r.returnedTo),
      registeredBy: asRecord(r.registeredBy, "usuário") as unknown as PublicUser,
    };
  };
  const claimDecision = (raw: unknown): ClaimDecisionResult => {
    const r = asRecord(raw, "decisão");
    return {
      claim: claim(r.claim),
      item: item(r.item),
      autoRejectedIds: asArray(r.autoRejectedIds, "autoRejectedIds").filter((id): id is string => typeof id === "string"),
    };
  };
  const itemDetail = (raw: unknown): ItemDetail => {
    const r = asRecord(raw, "detalhe");
    return {
      item: itemView(r.item),
      createdBy: r.createdBy == null ? null : (asRecord(r.createdBy, "usuário") as unknown as PublicUser),
      myClaims: asArray(r.myClaims, "myClaims").map(claim),
      claims: asArray(r.claims, "claims").map(claimWithClaimant),
      returnRecord: r.returnRecord == null ? null : returnRecord(r.returnRecord),
      viewer: asRecord(r.viewer, "viewer") as unknown as ItemViewerPermissions,
    };
  };

  return { item, itemView, claim, claimView, claimWithClaimant, claimDecision, returnRecord, returnView, itemDetail, user };
}
