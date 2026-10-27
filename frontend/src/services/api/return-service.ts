import type { ReturnService } from "../contracts";
import type { HttpClient } from "./http";
import { asArray, type Mappers } from "./mappers";

export function createReturnService(http: HttpClient, mappers: Mappers, changed: () => void): ReturnService {
  return {
    async register(itemId) {
      const view = mappers.returnView(await http.request("POST", `/items/${encodeURIComponent(itemId)}/return`));
      changed();
      return view;
    },
    async verifyCode(claimId, code) {
      const status = mappers.returnCodeStatus(
        await http.request("POST", `/claims/${encodeURIComponent(claimId)}/return-code/verify`, {
          json: { code },
          keepRateLimitMessage: true,
        }),
      );
      changed();
      return status;
    },
    async list(period) {
      const raw = await http.request("GET", "/returns", { query: { from: period?.from, to: period?.to } });
      return asArray(raw, "devoluções").map(mappers.returnView);
    },
  };
}
