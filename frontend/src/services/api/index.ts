import { ServiceError } from "@/types/domain";
import type { Services } from "../contracts";
import { createAdminService } from "./admin-service";
import { createAuthService } from "./auth-service";
import { createClaimService } from "./claim-service";
import { createItemService } from "./item-service";
import { createReturnService } from "./return-service";
import { createChangeFeed, type ChangeFeedOptions } from "./events";
import { createHttpClient, type HttpOptions } from "./http";
import { createMappers } from "./mappers";

export { fetchCatalog } from "./catalog";
export { LEGACY_TOKEN_STORAGE_KEY, SESSION_HINT_KEY } from "./http";

export interface ApiServicesOptions extends Omit<HttpOptions, "onSessionExpired"> {
  polling?: ChangeFeedOptions;
}

/** Implementação de `Services` que fala com a API REST (FastAPI, `docs/api/API.md`). */
export function createApiServices(options: ApiServicesOptions): Services {
  const feed = createChangeFeed(options.polling);
  const http = createHttpClient({ ...options, onSessionExpired: feed.notify });
  const mappers = createMappers(http.baseUrl);

  return {
    auth: createAuthService(http, mappers, feed.notify),
    items: createItemService(http, mappers, feed.notify),
    claims: createClaimService(http, mappers, feed.notify),
    returns: createReturnService(http, mappers, feed.notify),
    admin: createAdminService(http, feed.notify),
    demo: {
      async reset() {
        try {
          await http.request("POST", "/demo/reset", { auth: false });
        } catch (error) {
          if (error instanceof ServiceError && error.code === "NOT_FOUND") {
            throw new ServiceError("NOT_FOUND", "A demonstração não está disponível neste servidor.", { cause: error });
          }
          throw error;
        }
        feed.notify();
      },
      persistence: () => "durable", // os dados ficam no servidor
    },
    subscribe: feed.subscribe,
  };
}
