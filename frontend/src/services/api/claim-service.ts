import type { ClaimService } from "../contracts";
import type { HttpClient } from "./http";
import { asArray, type Mappers } from "./mappers";

export function createClaimService(http: HttpClient, mappers: Mappers, changed: () => void): ClaimService {
  const enc = encodeURIComponent;
  const list = async (path: string) => asArray(await http.request("GET", path), "reivindicações").map(mappers.claimView);
  const decide = async (claimId: string, decision: "accept" | "reject") => {
    const result = mappers.claimDecision(await http.request("POST", `/claims/${enc(claimId)}/${decision}`));
    changed();
    return result;
  };

  return {
    async create(itemId, input) {
      const claim = mappers.claim(await http.request("POST", `/items/${enc(itemId)}/claims`, { json: input }));
      changed();
      return claim;
    },
    listMine: () => list("/claims/mine"),
    listPending: () => list("/claims/pending"),
    listByItem: (itemId) => list(`/items/${enc(itemId)}/claims`),
    async get(claimId) {
      return mappers.claimView(await http.request("GET", `/claims/${enc(claimId)}`));
    },
    accept: (claimId) => decide(claimId, "accept"),
    reject: (claimId) => decide(claimId, "reject"),
  };
}
