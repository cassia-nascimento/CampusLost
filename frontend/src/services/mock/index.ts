import type { Services } from "../contracts";
import { createAdminService } from "./admin-service";
import { createAuthService } from "./auth-service";
import { createClaimService } from "./claim-service";
import { createContext, type MockServicesOptions } from "./context";
import { createItemService } from "./item-service";
import { createReturnService } from "./return-service";

export type { MockServicesOptions } from "./context";
export { createMemoryStorage, type KeyValueStorage } from "./storage";
export type { PhotoProcessor } from "./photo";

/** Implementação mockada de `Services` (localStorage versionado + latência simulada). */
export function createMockServices(options: MockServicesOptions = {}): Services {
  const ctx = createContext(options);
  return {
    auth: createAuthService(ctx),
    items: createItemService(ctx),
    claims: createClaimService(ctx),
    returns: createReturnService(ctx),
    admin: createAdminService(ctx),
    demo: {
      reset: () => ctx.run("demo.reset", () => ctx.store.reset()),
      persistence: () => ctx.store.persistence(),
    },
    subscribe: (listener) => ctx.store.subscribe(listener),
  };
}
