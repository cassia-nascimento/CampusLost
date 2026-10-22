/**
 * ÚNICO ponto que escolhe a implementação dos serviços.
 *  - `NEXT_PUBLIC_API_URL` definida: API REST (FastAPI), `services/api`.
 *  - Ausente: mock com dados de exemplo no navegador, `services/mock` (comportamento do deploy de demonstração).
 * ATENÇÃO: `NEXT_PUBLIC_*` é embutida no código em tempo de BUILD. Trocar o valor exige novo build/deploy.
 * A UI só importa `services` daqui — nunca `services/api/*` nem `services/mock/*`.
 */
import type { Services } from "./contracts";
import { getApiBaseUrl } from "@/lib/api-config";
import { getAllowedGoogleDomains } from "@/lib/rules";
import { createApiServices } from "./api";
import { createMockServices } from "./mock";

const apiBaseUrl = getApiBaseUrl();

export const services: Services = apiBaseUrl
  ? createApiServices({ baseUrl: apiBaseUrl })
  : createMockServices({ allowedGoogleDomains: getAllowedGoogleDomains() });

export type * from "./contracts";
